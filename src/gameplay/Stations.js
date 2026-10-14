import { events, say } from '../core/Events.js';
import { ITEMS, MIX_SHOTS, SYRUPS, mixColor, mixFormula, mixKey, searStage } from './Recipes.js';
import {
  addToPlate,
  advanceCooking,
  createItem,
  createPlate,
  disposeItem,
  isPlate,
  itemLabel,
  refreshItem,
} from './Items.js';

const MAX_PLATE_ITEMS = 6;

// Station logic. Visuals come from world/Stations.js as a `view`:
//   { root, anchor, label, parts }
// Items placed on a station are parented to view.anchor.
class Station {
  constructor(config, view) {
    this.config = config;
    this.type = config.type;
    this.view = view;
    this.item = null;
  }

  get name() {
    return this.view.label;
  }

  place(item) {
    this.item = item;
    item.mesh.position.set(0, 0, 0);
    item.mesh.rotation.set(0, 0, 0);
    this.view.anchor.add(item.mesh);
  }

  takeItem() {
    const item = this.item;
    this.item = null;
    item.mesh.removeFromParent();
    return item;
  }

  interact() {}

  // Drag and drop: can an item be dragged off this station?
  canGive() {
    return Boolean(this.item);
  }

  // Drag and drop: can `item` be dropped here?
  canAccept() {
    return false;
  }

  // A drag that started here was dropped somewhere invalid: take the item back.
  receiveBack(item) {
    if (this.item) disposeItem(item);
    else this.place(item);
  }

  update() {}

  status() {
    return '';
  }

  dispose() {
    if (this.item) disposeItem(this.item);
    this.item = null;
  }
}

export class CrateStation extends Station {
  interact(player) {
    if (!player.isEmpty) {
      say('Your hands are full. Use the board, or bin it (X).');
      return;
    }
    player.hold(createItem(this.config.item));
  }

  canGive() {
    return true;
  }

  receiveBack(item) {
    disposeItem(item);
  }

  status() {
    return `Drag out ${ITEMS[this.config.item].label.toLowerCase()}`;
  }
}

// Grill, fryer and pot: cook whatever matches `ITEMS[type].cook.station`.
export class CookerStation extends Station {
  constructor(config, view) {
    super(config, view);
    this.overclock = 0; // seconds of Level 3 power surge left
  }

  accepts(item) {
    return ITEMS[item.type]?.cook?.station === this.type;
  }

  canAccept(item) {
    return !this.item && !isPlate(item) && this.accepts(item);
  }

  receiveBack(item) {
    if (this.item) {
      disposeItem(item);
      return;
    }
    this.place(item);
    item.heating = true;
    refreshItem(item);
  }

  interact(player) {
    if (!player.isEmpty) {
      const held = player.held;
      if (this.item) {
        say(`The ${this.name.toLowerCase()} is busy.`);
      } else if (isPlate(held) || !this.accepts(held)) {
        say(`You can't cook ${itemLabel(held).toLowerCase()} here.`);
      } else {
        this.place(player.release());
        this.item.heating = true;
        events.emit('cook:start', { station: this, item: this.item });
      }
      return;
    }

    if (!this.item) {
      say(`The ${this.name.toLowerCase()} is empty.`);
      return;
    }

    const item = this.takeItem();
    item.heating = false;
    refreshItem(item);
    player.hold(item);
  }

  update(dt) {
    if (this.overclock > 0) {
      this.overclock = Math.max(0, this.overclock - dt);
      if (this.overclock === 0) events.emit('overclock:end', { station: this });
    }
    if (!this.item) return;

    const speed = this.overclock > 0 ? 2.2 : 1;
    this.cook(dt * speed);
  }

  // Advances the food on the heat by `dt` (already sped up by a power surge).
  cook(dt) {
    const changed = advanceCooking(this.item, dt);
    if (changed === 'cooked') events.emit('cook:done', { station: this, item: this.item });
    if (changed === 'burnt') events.emit('cook:burnt', { station: this, item: this.item });
  }

  status() {
    if (!this.item) return this.overclock > 0 ? 'OVERCLOCKED · empty' : 'Empty';
    const { cookedAt } = ITEMS[this.item.type].cook;
    const surge = this.overclock > 0 ? ' · OVERCLOCKED' : '';
    if (this.item.stage === 'raw') {
      return `Cooking ${Math.floor((this.item.cookTime / cookedAt) * 100)}%${surge}`;
    }
    if (this.item.stage === 'cooked') return `Ready! Grab it before it burns${surge}`;
    return 'Burnt! Bin it';
  }
}

// ---- Level 3 Laser Searer ----------------------------------------------------

const FLIP_TIME = 0.4; // seconds the flip animation takes (the laser pauses)

// Plasma steaks are seared one side at a time: the laser sears the top, the
// player clicks to flip the steak, the laser sears the other side, then the
// player drags it off. Leaving a side under the laser too long chars it.
// The laser fires by itself, so the chef is free to work elsewhere meanwhile.
export class LaserStation extends CookerStation {
  constructor(config, view) {
    super(config, view);
    this.time = 0;
    this.wasFiring = false;
  }

  get firing() {
    return Boolean(this.item) && this.item.flip === 0 && this.item.stage !== 'burnt';
  }

  get canFlip() {
    return Boolean(this.item) && this.item.stage === 'half' && !this.item.flipped && this.item.flip === 0;
  }

  place(item) {
    super.place(item);
    if (item.flipped) {
      item.mesh.rotation.x = Math.PI;
      item.mesh.position.y = item.mesh.userData.height;
    }
  }

  // Click: flip the steak when its first side is done; otherwise as any cooker.
  interact(player) {
    if (player.isEmpty && this.canFlip) {
      this.item.flipped = true;
      this.item.flip = FLIP_TIME;
      events.emit('laser:flip', { station: this });
      return;
    }
    super.interact(player);
  }

  // Dragging always takes the steak off, even when it's waiting to be flipped.
  give(player) {
    super.interact(player);
  }

  cook(dt) {
    const item = this.item;
    if (item.flip > 0) {
      item.flip = Math.max(0, item.flip - dt);
      const t = 1 - item.flip / FLIP_TIME;
      item.mesh.rotation.x = Math.PI * t;
      item.mesh.position.y = Math.sin(Math.PI * t) * 0.35 + item.mesh.userData.height * t;
      return;
    }

    const before = item.stage;
    item.sides[item.flipped ? 1 : 0] += dt;
    item.stage = searStage(item.type, item.sides);
    refreshItem(item);
    if (item.stage === before) return;
    if (item.stage === 'half') {
      events.emit('laser:flipReady', { station: this, item });
      say('One side seared: click the Laser Searer to flip the steak!');
    }
    if (item.stage === 'cooked') events.emit('cook:done', { station: this, item });
    if (item.stage === 'burnt') events.emit('cook:burnt', { station: this, item });
  }

  update(dt) {
    super.update(dt);
    this.time += dt;
    const { head, beam, light } = this.view.parts;
    const firing = this.firing;
    if (firing && !this.wasFiring) events.emit('laser:fire', { station: this });
    this.wasFiring = firing;

    // The head sweeps the beam across the steak, faster during a power surge.
    beam.visible = firing;
    if (firing) head.position.x = Math.sin(this.time * (this.overclock > 0 ? 10 : 5)) * 0.24;
    else head.position.x *= Math.exp(-dt * 4);
    light.intensity = firing ? 2.5 + 2.5 * Math.abs(Math.sin(this.time * 37)) : 0;
  }

  status() {
    const item = this.item;
    const surge = this.overclock > 0 ? ' · OVERCLOCKED' : '';
    if (!item) return `${surge ? 'OVERCLOCKED · ' : ''}Empty: drop a plasma steak here`;
    const { cookedAt } = ITEMS[item.type].cook;
    const side = item.flipped ? 1 : 0;
    const percent = Math.min(99, Math.floor((item.sides[side] / cookedAt) * 100));
    if (item.flip > 0) return 'Flipping…';
    if (item.stage === 'burnt') return 'Charred! Bin it';
    if (item.stage === 'cooked') return `Seared! Drag it off before it chars${surge}`;
    if (this.canFlip) return `Side 1 seared: click to flip it!${surge}`;
    return `Searing side ${side + 1}: ${percent}%${surge}`;
  }
}

// Drinks / broth: click to start pouring, click again when full to take it.
export class DispenserStation extends Station {
  constructor(config, view) {
    super(config, view);
    this.pouring = false;
  }

  get liquid() {
    return ITEMS[this.config.item].liquid;
  }

  canGive() {
    return Boolean(this.item) && !this.pouring;
  }

  interact(player) {
    if (!this.item) {
      const vessel = createItem(this.config.item);
      vessel.fill = 0;
      refreshItem(vessel);
      this.place(vessel);
      this.pouring = true;
      events.emit('pour:start', { station: this });
      return;
    }
    if (this.pouring) {
      say('Still pouring…');
      return;
    }
    if (!player.isEmpty) {
      say('Free your hands to take it.');
      return;
    }
    player.hold(this.takeItem());
  }

  update(dt) {
    if (!this.pouring) return;
    this.item.fill = Math.min(1, this.item.fill + dt / this.liquid.pourTime);
    refreshItem(this.item);
    if (this.item.fill >= 1) {
      this.pouring = false;
      events.emit('pour:done', { station: this });
    }
  }

  status() {
    const label = ITEMS[this.config.item].label;
    if (!this.item) return `Click to pour ${label.toLowerCase()}`;
    if (this.pouring) return `Pouring ${Math.floor(this.item.fill * 100)}%`;
    return `${label} ready: drag it to the board`;
  }
}

// Assembly board: drop items onto the plate, pick the whole plate up to serve.
export class BoardStation extends Station {
  constructor(config, view) {
    super(config, view);
    this.plate = createPlate();
    this.view.anchor.add(this.plate.mesh);
  }

  canGive() {
    return this.plate.contents.length > 0;
  }

  canAccept(item) {
    return isPlate(item) ? this.plate.contents.length === 0 : this.plate.contents.length < MAX_PLATE_ITEMS;
  }

  receiveBack(item) {
    if (!isPlate(item)) {
      addToPlate(this.plate, item);
    } else if (this.plate.contents.length) {
      disposeItem(item);
    } else {
      this.putPlate(item);
    }
  }

  putPlate(plate) {
    disposeItem(this.plate);
    this.plate = plate;
    plate.mesh.position.set(0, 0, 0);
    plate.mesh.rotation.set(0, 0, 0);
    this.view.anchor.add(plate.mesh);
  }

  interact(player) {
    const held = player.held;

    if (isPlate(held)) {
      if (this.plate.contents.length) {
        say('There is already a plate on the board.');
        return;
      }
      this.putPlate(player.release());
      events.emit('item:place', { item: this.plate });
      return;
    }

    if (held) {
      if (this.plate.contents.length >= MAX_PLATE_ITEMS) {
        say('That plate is full.');
        return;
      }
      const item = player.release();
      addToPlate(this.plate, item);
      events.emit('item:place', { item });
      return;
    }

    if (!this.plate.contents.length) {
      say('Bring ingredients here to build a dish.');
      return;
    }

    const plate = this.plate;
    plate.mesh.removeFromParent();
    player.hold(plate);
    this.plate = createPlate();
    this.view.anchor.add(this.plate.mesh);
  }

  status() {
    if (!this.plate.contents.length) return 'Empty plate';
    return itemLabel(this.plate).replace('Plate: ', '');
  }

  dispose() {
    disposeItem(this.plate);
  }
}

// ---- Level 3 Mixology Bar ---------------------------------------------------

const SHOT_TIME = 0.45; // seconds to pour one shot once the glass is under the tap
const BLEND_TIME = 2.2; // seconds on the magnetic stirrer
const SLIDE_RATE = 12; // how fast the glass slides between taps

// One syrup tap. Each tap is its own mouse/keyboard target (Gameplay builds
// targets from a station's `controls`) and hands everything to its MixerStation.
class MixerTap {
  constructor(mixer, part) {
    this.mixer = mixer;
    this.part = part;
    this.type = mixer.type;
    this.config = { ...mixer.config, x: mixer.config.x + part.offset };
    this.view = { root: part.root, label: `${SYRUPS[part.syrup].label} Tap` };
  }

  get name() {
    return this.view.label;
  }

  interact(player) {
    this.mixer.useTap(this, player);
  }

  give(player) {
    this.mixer.give(player);
  }

  canGive() {
    return this.mixer.canGive();
  }

  canAccept(item) {
    return this.mixer.canAccept(item);
  }

  receiveBack(item) {
    this.mixer.receiveBack(item, this);
  }

  status() {
    return this.mixer.tapStatus(this);
  }
}

// Molecular cocktails: click taps to pour shots of cyan, magenta and yellow
// syrup (clicks queue up). After MIX_SHOTS shots the glass slides onto the
// stirrer and the mix shader swirls the layers into one colour. The ratio of
// shots decides the cocktail; pour order doesn't matter.
export class MixerStation extends Station {
  constructor(config, view) {
    super(config, view);
    this.carriage = view.parts.carriage;
    this.controls = view.parts.taps.map((part) => new MixerTap(this, part));
    this.home = this.controls[1]; // the stirrer sits under the middle tap
    this.at = this.home;
    this.queue = []; // taps clicked while another shot is pouring
    this.pour = null; // { tap, time }
  }

  get blending() {
    return Boolean(this.item) && this.item.shots.length === MIX_SHOTS && this.item.mix < 1;
  }

  get busy() {
    return Boolean(this.pour) || this.queue.length > 0 || this.blending;
  }

  get ready() {
    return Boolean(this.item) && this.item.mix >= 1;
  }

  // Shots poured, pouring and queued.
  get planned() {
    return this.item ? this.item.shots.length + (this.pour ? 1 : 0) + this.queue.length : 0;
  }

  // Slides the glass to `tap` (snaps there if `snap`).
  moveTo(tap, snap = false) {
    if (this.at !== tap) {
      this.view.root.updateWorldMatrix(true, true);
      tap.part.root.attach(this.carriage);
      this.at = tap;
    }
    if (snap) this.carriage.position.x = 0;
  }

  place(item, tap = this.at) {
    this.item = item;
    this.moveTo(tap, true);
    item.mesh.position.set(0, 0, 0);
    item.mesh.rotation.set(0, 0, 0);
    this.carriage.add(item.mesh);
  }

  takeItem() {
    this.queue.length = 0;
    this.pour = null;
    this.controls.forEach((tap) => (tap.part.stream.visible = false));
    return super.takeItem();
  }

  useTap(tap, player) {
    const held = player.held;
    if (held && ITEMS[held.type]?.mix && !this.item) {
      this.place(player.release(), tap);
      events.emit('item:place', { item: this.item });
      return;
    }
    if (this.ready) {
      if (!player.isEmpty) say('Free your hands to take the drink.');
      else player.hold(this.takeItem());
      return;
    }
    if (this.blending && !this.pour && !this.queue.length) {
      say('Blending… nearly there.');
      return;
    }
    if (this.planned >= MIX_SHOTS) {
      say(`That glass is full: ${MIX_SHOTS} shots per drink.`);
      return;
    }
    if (!this.item) this.place(createItem('cocktail'), tap);
    this.queue.push(tap);
  }

  give(player) {
    if (this.canGive()) player.hold(this.takeItem());
  }

  canGive() {
    return Boolean(this.item) && !this.busy;
  }

  canAccept(item) {
    return !this.item && Boolean(ITEMS[item.type]?.mix);
  }

  receiveBack(item, tap = this.at) {
    if (this.item) disposeItem(item);
    else this.place(item, tap);
  }

  update(dt) {
    const carriage = this.carriage;
    carriage.position.x *= Math.exp(-dt * SLIDE_RATE);
    const arrived = Math.abs(carriage.position.x) < 0.02;
    const item = this.item;

    if (item && !this.pour && this.queue.length) {
      const next = this.queue[0];
      if (this.at !== next) this.moveTo(next);
      else if (arrived) {
        this.queue.shift();
        this.pour = { tap: next, time: 0 };
        item.pending = next.part.syrup;
        next.part.stream.visible = true;
        events.emit('pour:start', { station: this });
      }
    }

    if (this.pour) {
      this.pour.time += dt;
      const progress = Math.min(1, this.pour.time / SHOT_TIME);
      item.fill = (item.shots.length + progress) / MIX_SHOTS;
      if (progress >= 1) {
        item.shots.push(item.pending);
        item.pending = null;
        this.pour.tap.part.stream.visible = false;
        this.pour = null;
        events.emit('pour:done', { station: this });
      }
    } else if (this.blending && !this.queue.length) {
      if (this.at !== this.home) this.moveTo(this.home);
      else if (arrived) this.stir(item, dt);
    }

    if (item) refreshItem(item);
    this.updateLights();
  }

  stir(item, dt) {
    if (item.mix === 0) {
      this.view.parts.stirrer.emissive.setHex(mixColor(mixKey(item.shots)));
      events.emit('mix:start', { station: this });
    }
    item.mix = Math.min(1, item.mix + dt / BLEND_TIME);
    item.spin = Math.sqrt(Math.sin(Math.PI * item.mix));
    item.mesh.rotation.y += dt * 14 * item.spin;
    if (item.mix >= 1) {
      item.spin = 0;
      events.emit('mix:done', { station: this, item });
      say(`${itemLabel(item)} is ready! Drag it to a customer or the board.`);
    }
  }

  updateLights() {
    for (const tap of this.controls) {
      const pouring = this.pour?.tap === tap;
      const queued = this.queue.includes(tap);
      tap.part.light.emissiveIntensity = pouring ? 2.4 : queued ? 1.4 : 0.5;
    }
    const spin = this.item?.spin ?? 0;
    const stirrer = this.view.parts.stirrer;
    stirrer.emissiveIntensity = 0.4 + spin * 2.2;
    if (!this.item) stirrer.emissive.setHex(0x7c3aed);
  }

  tapStatus(tap) {
    const label = SYRUPS[tap.part.syrup].label.toLowerCase();
    const item = this.item;
    if (!item) return `Click to pour a shot of ${label} (${MIX_SHOTS} shots per drink)`;
    if (this.ready) return `${itemLabel(item)}: drag it to a customer`;
    if (this.blending && !this.pour && !this.queue.length) return `Blending ${Math.floor(item.mix * 100)}%`;
    const poured = item.shots.length ? mixFormula(mixKey(item.shots)) : 'empty';
    const queued = this.queue.length ? ` · ${this.queue.length} queued` : '';
    return `Shots ${item.shots.length}/${MIX_SHOTS}: ${poured}${queued}`;
  }
}

export class TrashStation extends Station {
  canGive() {
    return false;
  }

  canAccept() {
    return true;
  }

  interact(player) {
    if (player.isEmpty) {
      say('Nothing to throw away.');
      return;
    }
    const item = player.release();
    disposeItem(item);
    events.emit('item:trash', { item });
  }

  status() {
    return 'Bin what you are holding';
  }
}

const STATION_TYPES = {
  crate: CrateStation,
  grill: CookerStation,
  fryer: CookerStation,
  pot: CookerStation,
  laser: LaserStation,
  dispenser: DispenserStation,
  mixer: MixerStation,
  board: BoardStation,
  trash: TrashStation,
};

export function createStation(config, view) {
  const StationType = STATION_TYPES[config.type];
  if (!StationType) throw new Error(`Unknown station type: ${config.type}`);
  return new StationType(config, view);
}
