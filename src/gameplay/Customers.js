import * as THREE from 'three';
import { events } from '../core/Events.js';
import { RECIPES, matchesRecipe } from './Recipes.js';
import { createOrderBubble } from '../world/Models.js';
import { createCustomer } from '../world/Characters.js';
import { disposeObject } from '../utils/Dispose.js';
import { pick, randomRange } from '../utils/Constants.js';

const WALK_SPEED = 1.5; // m/s, matches the walk animation
const ENTRY_DISTANCE = 7;
const WRONG_ORDER_PENALTY = 4; // seconds of patience lost
const THANKS_TIME = 1.4; // seconds spent nodding before leaving

let nextCustomerId = 1;

// Customers walk in to a free slot, wait with a patience timer, then leave
// happy (served) or angry (patience ran out → order:missed).
// States: arriving → waiting → (thanking →) leaving.
// Slot views come from world/Environment.js: { root, focus, position }.
export class CustomerManager {
  constructor(level, slotViews) {
    this.level = level;
    this.slots = slotViews.map((view, index) => ({ index, view, customer: null }));
    this.spawnTimer = 1.5;
    this.spawnScale = 1; // < 1 spawns faster (Level 2 rush hour)
    this.target = new THREE.Vector3();
  }

  get waiting() {
    return this.slots.filter((slot) => slot.customer?.state === 'waiting').map((slot) => slot.customer);
  }

  update(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.trySpawn() ? randomRange(this.level.spawnInterval) * this.spawnScale : 1;
    }

    for (const slot of this.slots) {
      if (slot.customer) this.updateCustomer(slot, slot.customer, dt);
    }
  }

  trySpawn() {
    const free = this.slots.filter((slot) => !slot.customer);
    if (!free.length) return false;

    const slot = pick(free);
    const recipeId = pick(this.level.recipes);
    const patience = randomRange(this.level.patience);
    const side = slot.view.position.x < 0 ? -1 : 1;

    const { root, animator, height } = createCustomer(this.level.theme, nextCustomerId);
    root.position.set(side * ENTRY_DISTANCE, 0, 2.5);
    const bubble = createOrderBubble(RECIPES[recipeId].name);
    bubble.position.set(0, height + 0.45, 0);
    bubble.visible = false;
    root.add(bubble);
    slot.view.root.add(root);
    animator.play('walk', { fade: 0 });

    slot.customer = {
      id: nextCustomerId++,
      slot,
      recipeId,
      patience,
      maxPatience: patience,
      state: 'arriving',
      side,
      model: root,
      animator,
      bubble,
      time: Math.random() * 10,
      fidget: 3 + Math.random() * 3,
    };
    return true;
  }

  updateCustomer(slot, customer, dt) {
    const { model, animator } = customer;
    customer.time += dt;
    animator.update(dt);

    if (customer.state === 'arriving' || customer.state === 'leaving') {
      if (customer.state === 'arriving') this.target.set(0, 0, 0);
      else this.target.set(customer.side * (ENTRY_DISTANCE + 2), 0, 3);

      const arrived = walkTowards(model, this.target, WALK_SPEED * dt * (customer.happy === false ? 0.8 : 1), dt);
      if (!animator.animated) model.position.y = arrived ? 0 : Math.abs(Math.sin(customer.time * 10)) * 0.06;
      if (!arrived) return;

      if (customer.state === 'arriving') {
        customer.state = 'waiting';
        customer.facing = Math.PI; // face the kitchen
        customer.bubble.visible = true;
        animator.play('idle');
        events.emit('order:new', { customer });
      } else {
        this.remove(slot);
      }
      return;
    }

    turnTowards(model, customer.facing ?? Math.PI, dt);

    if (customer.state === 'thanking') {
      customer.thanks -= dt;
      if (customer.thanks <= 0) this.startLeaving(customer);
      return;
    }

    if (customer.state === 'waiting') {
      customer.patience -= dt;
      const ratio = Math.max(0, customer.patience / customer.maxPatience);
      customer.bubble.userData.setPatience(ratio);

      // Impatient customers fidget: idle speeds up and they shake their head.
      if (ratio < 0.3) {
        if (animator.current === animator.actions.idle) animator.play('idle', { timeScale: 1.8 });
        customer.fidget -= dt;
        if (customer.fidget <= 0) {
          customer.fidget = 4 + Math.random() * 2;
          animator.play('headShake', { then: 'idle' });
        }
      }

      if (customer.patience <= 0) this.leave(slot, false);
    }
  }

  // Returns { ok, recipe, ratio } or null if nobody is waiting in this slot.
  serve(slot, tags) {
    const customer = slot.customer;
    if (!customer || customer.state !== 'waiting') return null;

    const recipe = RECIPES[customer.recipeId];
    if (!matchesRecipe(tags, customer.recipeId)) {
      customer.patience = Math.max(0.5, customer.patience - WRONG_ORDER_PENALTY);
      customer.animator.play('headShake', { then: 'idle' });
      return { ok: false, recipe };
    }

    const ratio = customer.patience / customer.maxPatience;
    this.leave(slot, true);
    return { ok: true, recipe, ratio };
  }

  leave(slot, happy) {
    const customer = slot.customer;
    customer.happy = happy;
    customer.bubble.visible = false;
    if (happy) {
      customer.state = 'thanking';
      customer.thanks = THANKS_TIME;
      customer.animator.play('agree');
    } else {
      customer.state = 'thanking';
      customer.thanks = 1.2;
      customer.animator.play('headShake');
      events.emit('order:missed', { customer });
    }
  }

  startLeaving(customer) {
    customer.state = 'leaving';
    customer.animator.play('walk', { timeScale: customer.happy ? 1 : 0.8 });
  }

  remove(slot) {
    const { model } = slot.customer;
    model.removeFromParent();
    disposeObject(model);
    slot.customer = null;
  }

  dispose() {
    for (const slot of this.slots) {
      if (slot.customer) this.remove(slot);
    }
  }
}

// Moves `model` towards `target` (slot-local), turning to face the way it walks.
// Returns true on arrival.
function walkTowards(model, target, step, dt) {
  const dx = target.x - model.position.x;
  const dz = target.z - model.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= step) {
    model.position.x = target.x;
    model.position.z = target.z;
    return true;
  }
  model.position.x += (dx / distance) * step;
  model.position.z += (dz / distance) * step;
  turnTowards(model, Math.atan2(dx, dz), dt);
  return false;
}

function turnTowards(model, angle, dt) {
  const delta = Math.atan2(Math.sin(angle - model.rotation.y), Math.cos(angle - model.rotation.y));
  model.rotation.y += delta * Math.min(1, dt * 8);
}
