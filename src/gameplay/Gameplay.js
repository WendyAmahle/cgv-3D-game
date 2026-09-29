import * as THREE from 'three';
import { events, say } from '../core/Events.js';
import { RECIPES, tagLabel } from './Recipes.js';
import { CookerStation, createStation } from './Stations.js';
import { CustomerManager } from './Customers.js';
import { disposeItem, itemLabel, itemTags } from './Items.js';
import { pick, randomRange } from '../utils/Constants.js';

// One shift in one level: stations, customers, timer, money and win/lose.
// `world` comes from LevelManager.build(): { stations: [{config, view}], customerSlots }.
// `physics` (Physics.js) takes over items that are thrown or dropped.
export class Gameplay {
  constructor(level, world, player, physics) {
    this.level = level;
    this.player = player;
    this.physics = physics;
    this.stations = world.stations.map(({ config, view }) => createStation(config, view));
    this.customers = new CustomerManager(level, world.customerSlots);
    this.stats = {
      money: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      served: 0,
      missed: 0,
      timeLeft: level.duration,
    };
    this.elapsed = 0;
    this.result = null; // 'complete' | 'failed'
    this.rushStarted = false;
    this.overclockTimer = level.overclock ? randomRange(level.overclock.interval) : Infinity;
    this.targets = this.buildTargets();
    const trash = this.stations.find((station) => station.type === 'trash');
    // The bin's opening, for throws. Station roots sit directly under the level root at the origin.
    this.bin = trash && { rim: trash.view.root.position.clone().add({ x: 0, y: 0.98, z: 0 }), radius: 0.26 };
    this.unsubscribe = events.on('order:missed', () => this.onMissed());
  }

  // Everything the player can point at, for mouse picking and keyboard navigation.
  buildTargets() {
    const stationTargets = this.stations.map((station) => ({
      kind: 'station',
      ref: station,
      row: station.config.row,
      x: station.config.x,
      object: station.view.root,
      focus: station.view.root,
      title: () => station.name,
      status: () => station.status(),
    }));

    const customerTargets = this.customers.slots.map((slot) => ({
      kind: 'customer',
      ref: slot,
      row: 'customers',
      x: slot.view.position.x,
      object: slot.view.root,
      focus: slot.view.focus,
      title: () => (slot.customer?.state === 'waiting' ? RECIPES[slot.customer.recipeId].name : 'Customer spot'),
      status: () => {
        const customer = slot.customer;
        if (!customer) return 'Nobody here yet';
        if (customer.state !== 'waiting') return customer.state === 'arriving' ? 'Arriving…' : 'Leaving';
        return RECIPES[customer.recipeId].ingredients.map(tagLabel).join(' + ');
      },
    }));

    return [...stationTargets, ...customerTargets];
  }

  interact(target) {
    if (this.result) return;
    if (target.kind === 'station' && target.ref.type === 'trash' && !this.player.isEmpty) this.binHeld();
    else if (target.kind === 'station') target.ref.interact(this.player);
    else this.serve(target.ref);
  }

  serve(slot) {
    const customer = slot.customer;
    if (!customer || customer.state !== 'waiting') {
      say('Nobody is waiting here yet.');
      return;
    }

    const recipe = RECIPES[customer.recipeId];
    if (this.player.isEmpty) {
      say(`They want ${recipe.name}: ${recipe.ingredients.map(tagLabel).join(' + ')}`);
      return;
    }

    const outcome = this.customers.serve(slot, itemTags(this.player.held));
    if (!outcome.ok) {
      this.stats.combo = 0;
      events.emit('order:wrong', { customer });
      say(`"That's not what I ordered!" They want ${recipe.name}.`);
      return;
    }

    disposeItem(this.player.release());

    const tip = Math.round(recipe.price * 0.5 * outcome.ratio);
    const reward = recipe.price + tip;
    const stats = this.stats;
    stats.combo += 1;
    stats.bestCombo = Math.max(stats.bestCombo, stats.combo);
    stats.served += 1;
    stats.money += reward;
    stats.score += Math.round(reward * 10 * (1 + 0.25 * Math.min(stats.combo - 1, 8)));

    const position = slot.view.focus.getWorldPosition(customer.model.position.clone());
    position.y += 1.8;
    events.emit('order:served', { customer, reward, tip, combo: stats.combo, position });
    say(`${recipe.name} served! +$${reward}${tip ? ` (incl. $${tip} tip)` : ''}`);
  }

  // ---- Drag and drop (mouse) ---------------------------------------------

  // Starts a drag from a station: its item goes into the player's hands.
  pickUp(target) {
    if (this.result || !this.player.isEmpty || target.kind !== 'station') return false;
    const station = target.ref;
    if (!station.canGive()) return false;
    station.interact(this.player);
    return !this.player.isEmpty;
  }

  canDrop(target) {
    const item = this.player.held;
    if (!item || this.result || !target) return false;
    if (target.kind === 'customer') return target.ref.customer?.state === 'waiting';
    return target.ref.canAccept(item);
  }

  // Drops the dragged item on `target`. Anything not accepted (an invalid spot,
  // or a customer rejecting the dish) goes back to where the drag started.
  drop(target, source) {
    if (target && target !== source) {
      if (this.canDrop(target)) this.interact(target);
      else say(`You can't put ${itemLabel(this.player.held).toLowerCase()} there.`);
    }
    if (!this.player.isEmpty) this.returnHeld(source);
  }

  returnHeld(source) {
    const item = this.player.release();
    if (item) source.ref.receiveBack(item);
  }

  // Released over empty space: the item falls under physics and is wasted.
  spill(source, velocity) {
    const item = this.player.held;
    if (!item) return;
    if (this.result) {
      this.returnHeld(source);
      return;
    }
    const label = itemLabel(item).toLowerCase();
    const from = item.mesh.getWorldPosition(new THREE.Vector3());
    this.player.release();
    this.physics.drop(item, from, velocity);
    events.emit('item:dropped', { item });
    say(`Oops, you dropped the ${label}!`);
  }

  // Throws what you're holding into the bin along a ballistic arc. The bin
  // sound plays when it lands (Physics emits item:trash).
  binHeld() {
    const item = this.player.held;
    if (!item) return;
    const from = item.mesh.getWorldPosition(new THREE.Vector3());
    this.player.release();
    if (this.bin) {
      this.physics.throwInto(item, from, this.bin);
    } else {
      disposeItem(item);
      events.emit('item:trash', { item });
    }
  }

  discardHeld() {
    this.binHeld();
  }

  onMissed() {
    this.stats.missed += 1;
    this.stats.combo = 0;
    say('A customer walked out!');
    if (this.stats.missed >= this.level.maxMisses) this.finish(false, 'Too many customers walked out.');
  }

  update(dt) {
    if (this.result) return;

    this.elapsed += dt;
    this.stats.timeLeft = Math.max(0, this.level.duration - this.elapsed);

    const rush = this.level.rushHour;
    if (rush && !this.rushStarted && this.elapsed >= this.level.duration * rush.at) {
      this.rushStarted = true;
      this.customers.spawnScale = rush.spawnScale;
      this.customers.spawnTimer = Math.min(this.customers.spawnTimer, 1);
      events.emit('rush:start');
      say('Rush hour! Customers are pouring in.');
    }

    if (this.level.overclock) {
      this.overclockTimer -= dt;
      if (this.overclockTimer <= 0) {
        this.overclockTimer = randomRange(this.level.overclock.interval);
        this.triggerOverclock();
      }
    }

    for (const station of this.stations) station.update(dt);
    this.customers.update(dt);

    if (this.stats.timeLeft === 0 && !this.result) {
      const success = this.stats.money >= this.level.targetMoney;
      this.finish(success, success ? '' : `Earned $${this.stats.money} of the $${this.level.targetMoney} target.`);
    }
  }

  triggerOverclock() {
    const cookers = this.stations.filter((station) => station instanceof CookerStation && station.overclock === 0);
    if (!cookers.length) return;
    const station = pick(cookers);
    station.overclock = this.level.overclock.duration;
    events.emit('overclock:start', { station });
    say(`Power surge! The ${station.name.toLowerCase()} is overclocked. Food cooks twice as fast.`);
  }

  finish(success, reason) {
    this.result = success ? 'complete' : 'failed';
    this.resultReason = reason;
    events.emit(success ? 'level:complete' : 'level:failed', { stats: this.stats, reason });
  }

  dispose() {
    this.unsubscribe();
    this.stations.forEach((station) => station.dispose());
    this.customers.dispose();
    this.player.clear();
    this.physics.clear();
  }
}
