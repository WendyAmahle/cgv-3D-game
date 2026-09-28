import { events, say } from '../core/Events.js';
import { RECIPES, tagLabel } from './Recipes.js';
import { CookerStation, createStation } from './Stations.js';
import { CustomerManager } from './Customers.js';
import { disposeItem, itemTags } from './Items.js';
import { pick, randomRange } from '../utils/Constants.js';

// One shift in one level: stations, customers, timer, money and win/lose.
// `world` comes from LevelManager.build(): { stations: [{config, view}], customerSlots }.
export class Gameplay {
  constructor(level, world, player) {
    this.level = level;
    this.player = player;
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
    if (target.kind === 'station') target.ref.interact(this.player);
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

  discardHeld() {
    if (this.player.isEmpty) return;
    const item = this.player.release();
    disposeItem(item);
    events.emit('item:trash', { item });
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
  }
}
