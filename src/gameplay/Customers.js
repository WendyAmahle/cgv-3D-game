import * as THREE from 'three';
import { events } from '../core/Events.js';
import { COCKTAILS, RECIPES, matchParts, matchesRecipe, mixFormula, orderParts, tagColor } from './Recipes.js';
import { createOrderBubble, createOrderHologram } from '../world/Models.js';
import { createCustomer } from '../world/Characters.js';
import { disposeObject } from '../utils/Dispose.js';
import { SERVE_DRINKS_SEPARATELY, pick, randomRange } from '../utils/Constants.js';

const WALK_SPEED = 1.5; // m/s, matches the walk animation
const ENTRY_DISTANCE = 7;
const WRONG_ORDER_PENALTY = 4; // seconds of patience lost (default; a level can set wrongOrderPenalty)
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
    const bubble = createOrderDisplay(this.level, RECIPES[recipeId]);
    bubble.position.set(0, height + 0.45, 0);
    bubble.visible = false;
    root.add(bubble);
    slot.view.root.add(root);
    animator.play('walk', { fade: 0 });

    slot.customer = {
      id: nextCustomerId++,
      slot,
      recipeId,
      parts: orderParts(RECIPES[recipeId].ingredients), // still to be served
      delivered: [], // tags already handed over
      patience,
      maxPatience: patience,
      state: 'arriving',
      side,
      model: root,
      animator,
      bubble,
      time: Math.random() * 10,
      fidget: 3 + Math.random() * 3,
      grace: this.level.patienceGrace ?? 0, // seconds before patience starts draining
      urgency: 0, // 1 once below 30% patience, 2 once below 15% (order:urgent)
    };
    return true;
  }

  updateCustomer(slot, customer, dt) {
    const { model, animator } = customer;
    customer.time += dt;
    animator.update(dt);
    customer.bubble.userData.update?.(dt);

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
      if (customer.grace > 0) customer.grace -= dt; // the bar stays full during the grace period
      else customer.patience -= dt;
      const ratio = Math.max(0, customer.patience / customer.maxPatience);
      customer.bubble.userData.setPatience(ratio);

      // Warn once as patience drops below 30%, and once more below 15%.
      const urgency = ratio < 0.15 ? 2 : ratio < 0.3 ? 1 : 0;
      if (urgency > customer.urgency) {
        customer.urgency = urgency;
        events.emit('order:urgent', { customer, ratio });
      }

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

  // Indices of the customer's remaining order parts that `tags` would
  // complete, or null if they wouldn't take it. With SERVE_DRINKS_SEPARATELY
  // off, only the whole order at once is accepted.
  partsFor(customer, tags) {
    if (SERVE_DRINKS_SEPARATELY) return matchParts(customer.parts, tags);
    return matchesRecipe(tags, customer.recipeId) ? customer.parts.map((_, index) => index) : null;
  }

  // Would the customer in `slot` take `tags` right now?
  accepts(slot, tags) {
    const customer = slot.customer;
    return customer?.state === 'waiting' && this.partsFor(customer, tags) !== null;
  }

  // Returns { ok, recipe, complete, delivered, ratio } or null if nobody is
  // waiting in this slot. `complete` is false while parts are still missing.
  serve(slot, tags) {
    const customer = slot.customer;
    if (!customer || customer.state !== 'waiting') return null;

    const recipe = RECIPES[customer.recipeId];
    const indices = this.partsFor(customer, tags);
    if (!indices) {
      customer.patience = Math.max(0.5, customer.patience - (this.level.wrongOrderPenalty ?? WRONG_ORDER_PENALTY));
      customer.animator.play('headShake', { then: 'idle' });
      return { ok: false, recipe };
    }

    const delivered = indices.flatMap((index) => customer.parts[index]);
    customer.delivered.push(...delivered);
    customer.parts = customer.parts.filter((_, index) => !indices.includes(index));
    if (customer.parts.length) return { ok: true, recipe, complete: false, delivered };

    const ratio = customer.patience / customer.maxPatience;
    this.leave(slot, true);
    return { ok: true, recipe, complete: true, delivered, ratio };
  }

  leave(slot, happy) {
    const customer = slot.customer;
    customer.happy = happy;
    if (customer.bubble.userData.dismiss) customer.bubble.userData.dismiss();
    else customer.bubble.visible = false;
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

// What floats over a customer: a bubble, or in levels with
// `orderDisplay: 'hologram'` (Level 3) a hologram that also shows a
// cocktail's colour and recipe.
function createOrderDisplay(level, recipe) {
  if (level.orderDisplay !== 'hologram') return createOrderBubble(recipe.name);
  const cocktail = recipe.ingredients.find((tag) => tagColor(tag) !== null);
  if (!cocktail) return createOrderHologram(recipe.name);
  const key = cocktail.split(':')[1];
  const detail = recipe.ingredients.length === 1 ? mixFormula(key) : `with ${COCKTAILS[key]}`;
  return createOrderHologram(recipe.name, { swatch: tagColor(cocktail), detail });
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
