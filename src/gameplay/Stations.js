import { events, say } from '../core/Events.js';
import { ITEMS } from './Recipes.js';
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

  status() {
    return `Grab ${ITEMS[this.config.item].label.toLowerCase()}`;
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
    const changed = advanceCooking(this.item, dt * speed);
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

// Drinks / broth: click to start pouring, click again when full to take it.
export class DispenserStation extends Station {
  constructor(config, view) {
    super(config, view);
    this.pouring = false;
  }

  get liquid() {
    return ITEMS[this.config.item].liquid;
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
    return `${label} ready`;
  }
}

// Assembly board: drop items onto the plate, pick the whole plate up to serve.
export class BoardStation extends Station {
  constructor(config, view) {
    super(config, view);
    this.plate = createPlate();
    this.view.anchor.add(this.plate.mesh);
  }

  interact(player) {
    const held = player.held;

    if (isPlate(held)) {
      if (this.plate.contents.length) {
        say('There is already a plate on the board.');
        return;
      }
      disposeItem(this.plate);
      this.plate = player.release();
      this.plate.mesh.position.set(0, 0, 0);
      this.plate.mesh.rotation.set(0, 0, 0);
      this.view.anchor.add(this.plate.mesh);
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

export class TrashStation extends Station {
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
  dispenser: DispenserStation,
  board: BoardStation,
  trash: TrashStation,
};

export function createStation(config, view) {
  const StationType = STATION_TYPES[config.type];
  if (!StationType) throw new Error(`Unknown station type: ${config.type}`);
  return new StationType(config, view);
}
