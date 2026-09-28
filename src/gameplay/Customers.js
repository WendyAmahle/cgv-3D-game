import * as THREE from 'three';
import { events } from '../core/Events.js';
import { RECIPES, matchesRecipe } from './Recipes.js';
import { createCustomerModel, createOrderBubble } from '../world/Models.js';
import { disposeObject } from '../utils/Dispose.js';
import { pick, randomRange } from '../utils/Constants.js';

const WALK_SPEED = 2.6;
const WRONG_ORDER_PENALTY = 4; // seconds of patience lost

let nextCustomerId = 1;

// Customers walk in to a free slot, wait with a patience timer, then leave
// happy (served) or angry (patience ran out → order:missed).
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

    const model = createCustomerModel(this.level.theme, nextCustomerId);
    model.position.set(side * 9, 0, 3);
    const bubble = createOrderBubble(RECIPES[recipeId].name);
    bubble.position.set(0, 2.55, 0);
    bubble.visible = false;
    model.add(bubble);
    slot.view.root.add(model);

    slot.customer = {
      id: nextCustomerId++,
      slot,
      recipeId,
      patience,
      maxPatience: patience,
      state: 'arriving',
      side,
      model,
      bubble,
      time: Math.random() * 10,
    };
    return true;
  }

  updateCustomer(slot, customer, dt) {
    const { model } = customer;
    customer.time += dt;

    if (customer.state === 'arriving' || customer.state === 'leaving') {
      if (customer.state === 'arriving') this.target.set(0, 0, 0);
      else this.target.set(customer.side * 10, 0, 3.5);

      const arrived = walkTowards(model, this.target, WALK_SPEED * dt, customer.time);
      if (!arrived) return;

      if (customer.state === 'arriving') {
        customer.state = 'waiting';
        model.rotation.y = Math.PI; // face the kitchen
        model.position.y = 0;
        customer.bubble.visible = true;
        events.emit('order:new', { customer });
      } else {
        this.remove(slot);
      }
      return;
    }

    if (customer.state === 'waiting') {
      customer.patience -= dt;
      const ratio = Math.max(0, customer.patience / customer.maxPatience);
      customer.bubble.userData.setPatience(ratio);

      // Idle sway that turns into impatient bouncing as patience runs out.
      const agitation = ratio < 0.3 ? 1 : 0;
      model.position.y = Math.abs(Math.sin(customer.time * (3 + agitation * 9))) * 0.05 * (1 + agitation * 2);
      model.rotation.z = Math.sin(customer.time * 1.5) * 0.03;

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
      return { ok: false, recipe };
    }

    const ratio = customer.patience / customer.maxPatience;
    this.leave(slot, true);
    return { ok: true, recipe, ratio };
  }

  leave(slot, happy) {
    const customer = slot.customer;
    customer.state = 'leaving';
    customer.happy = happy;
    customer.bubble.visible = false;
    customer.model.rotation.z = 0;
    if (!happy) events.emit('order:missed', { customer });
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

// Moves `model` towards `target` (slot-local) with a walking bob. Returns true on arrival.
function walkTowards(model, target, step, time) {
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
  model.position.y = Math.abs(Math.sin(time * 10)) * 0.08;
  model.rotation.y = Math.atan2(dx, dz);
  return false;
}
