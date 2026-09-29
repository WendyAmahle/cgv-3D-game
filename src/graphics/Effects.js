import * as THREE from 'three';
import { events } from '../core/Events.js';
import { createParticleMaterial, createSteamMaterial } from './Shaders.js';
import { disposeObject } from '../utils/Dispose.js';

const COOKERS = new Set(['grill', 'fryer', 'pot']);
const random = (min, max) => min + Math.random() * (max - min);

// CPU-simulated particles drawn as one THREE.Points with the custom particle shader.
export class ParticleEmitter {
  constructor({
    max = 100,
    rate = 0,
    lifetime = [1, 2],
    size = [0.2, 0.4],
    velocity = new THREE.Vector3(0, 0.6, 0),
    spread = new THREE.Vector3(0.1, 0.1, 0.1),
    spawnBox = new THREE.Vector3(0.2, 0, 0.2),
    gravity = 0,
    colorStart = 0xffffff,
    colorEnd,
    opacity = 0.8,
    additive = false,
  } = {}) {
    Object.assign(this, { max, rate, lifetime, size, velocity, spread, spawnBox, gravity });
    this.origin = new THREE.Vector3();
    this.accumulator = 0;
    this.cursor = 0;

    this.positions = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.ages = new Float32Array(max).fill(1);
    this.lifetimes = new Float32Array(max).fill(1);
    this.sizes = new Float32Array(max);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aAge', new THREE.BufferAttribute(this.ages, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

    this.points = new THREE.Points(geometry, createParticleMaterial({ colorStart, colorEnd, opacity, additive }));
    this.points.frustumCulled = false;
  }

  emit(count) {
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;
      this.positions[i3] = this.origin.x + (Math.random() - 0.5) * this.spawnBox.x;
      this.positions[i3 + 1] = this.origin.y + (Math.random() - 0.5) * this.spawnBox.y;
      this.positions[i3 + 2] = this.origin.z + (Math.random() - 0.5) * this.spawnBox.z;
      this.velocities[i3] = this.velocity.x + (Math.random() - 0.5) * this.spread.x;
      this.velocities[i3 + 1] = this.velocity.y + (Math.random() - 0.5) * this.spread.y;
      this.velocities[i3 + 2] = this.velocity.z + (Math.random() - 0.5) * this.spread.z;
      this.ages[i] = 0;
      this.lifetimes[i] = random(...this.lifetime);
      this.sizes[i] = random(...this.size);
    }
  }

  burst(position, count) {
    this.origin.copy(position);
    this.emit(count);
  }

  update(dt) {
    this.accumulator += this.rate * dt;
    const count = Math.floor(this.accumulator);
    if (count > 0) {
      this.accumulator -= count;
      this.emit(count);
    }

    for (let i = 0; i < this.max; i += 1) {
      if (this.ages[i] >= 1) continue;
      const i3 = i * 3;
      this.ages[i] = Math.min(1, this.ages[i] + dt / this.lifetimes[i]);
      this.velocities[i3 + 1] += this.gravity * dt;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;
    }

    const { attributes } = this.points.geometry;
    attributes.position.needsUpdate = true;
    attributes.aAge.needsUpdate = true;
    attributes.aSize.needsUpdate = true;
  }
}

// Visual feedback driven by gameplay state: steam/smoke/sparks and heat columns
// on cookers, celebration bursts when serving, and per-level weather.
export class Effects {
  constructor(scene) {
    this.persistent = new THREE.Group();
    this.levelGroup = new THREE.Group();
    scene.add(this.persistent, this.levelGroup);

    this.levelEmitters = [];
    this.stationFx = new Map(); // station view -> fx
    this.time = 0;

    this.sparkle = new ParticleEmitter({
      max: 160,
      lifetime: [0.6, 1.1],
      size: [0.12, 0.22],
      velocity: new THREE.Vector3(0, 2.4, 0),
      spread: new THREE.Vector3(2, 1.4, 2),
      spawnBox: new THREE.Vector3(0.4, 0.4, 0.4),
      gravity: -4,
      colorStart: 0xffe066,
      colorEnd: 0xff7b00,
      opacity: 1,
      additive: true,
    });
    this.persistent.add(this.sparkle.points);

    events.on('order:served', ({ position }) => this.sparkle.burst(position, 50));
  }

  addEmitter(options) {
    const emitter = new ParticleEmitter(options);
    this.levelEmitters.push(emitter);
    this.levelGroup.add(emitter.points);
    return emitter;
  }

  attach(world, level) {
    this.clear();

    for (const { config, view } of world.stations) {
      if (!COOKERS.has(config.type)) continue;
      const origin = view.anchor.getWorldPosition(new THREE.Vector3());

      const steam = this.addEmitter({
        max: 60,
        lifetime: [1.2, 2.0],
        size: [0.35, 0.6],
        velocity: new THREE.Vector3(0, 0.7, 0),
        spread: new THREE.Vector3(0.15, 0.2, 0.15),
        spawnBox: new THREE.Vector3(0.35, 0, 0.35),
        opacity: 0.35,
        colorStart: 0xffffff,
        colorEnd: 0xdde6ee,
      });
      const smoke = this.addEmitter({
        max: 70,
        lifetime: [1.6, 2.6],
        size: [0.5, 0.9],
        velocity: new THREE.Vector3(0, 0.9, 0),
        spread: new THREE.Vector3(0.25, 0.25, 0.25),
        opacity: 0.55,
        colorStart: 0x3a3a3a,
        colorEnd: 0x111111,
      });
      const sparks = this.addEmitter({
        max: 60,
        lifetime: [0.3, 0.7],
        size: [0.06, 0.12],
        velocity: new THREE.Vector3(0, 2.4, 0),
        spread: new THREE.Vector3(2, 1.2, 2),
        gravity: -6,
        opacity: 1,
        additive: true,
        colorStart: 0x9ff7ff,
        colorEnd: 0x3d7bff,
      });
      [steam, smoke, sparks].forEach((emitter) => emitter.origin.copy(origin));

      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.28, 1.6, 20, 1, true), createSteamMaterial());
      column.position.copy(origin).add(new THREE.Vector3(0, 0.9, 0));
      this.levelGroup.add(column);

      this.stationFx.set(view, { type: config.type, origin, steam, smoke, sparks, column, glow: view.parts.glow, heat: 0 });
    }

    if (level.weather === 'rain') {
      const rain = this.addEmitter({
        max: 900,
        rate: 520,
        lifetime: [0.9, 1.1],
        size: [0.05, 0.07],
        velocity: new THREE.Vector3(0.6, -14, 0),
        spread: new THREE.Vector3(0.2, 1, 0.2),
        spawnBox: new THREE.Vector3(34, 0, 22),
        opacity: 0.55,
        colorStart: 0xa8e4ff,
      });
      rain.origin.set(0, 13, 4);
    } else if (level.weather === 'fireflies') {
      const fireflies = this.addEmitter({
        max: 60,
        rate: 10,
        lifetime: [3, 5],
        size: [0.1, 0.16],
        velocity: new THREE.Vector3(0, 0.15, 0),
        spread: new THREE.Vector3(0.4, 0.3, 0.4),
        spawnBox: new THREE.Vector3(18, 2, 8),
        opacity: 0.9,
        additive: true,
        colorStart: 0xffd27a,
        colorEnd: 0xffa040,
      });
      fireflies.origin.set(0, 1.8, 7);
    }
  }

  // `stations` are gameplay station objects (empty in the menu backdrop).
  update(dt, stations) {
    this.time += dt;
    this.sparkle.update(dt);

    for (const station of stations) {
      const fx = this.stationFx.get(station.view);
      if (!fx) continue;
      const stage = station.item?.stage;
      const overclocked = station.overclock > 0;

      fx.heat += ((station.item ? 1 : 0) - fx.heat) * Math.min(1, dt * 3);
      fx.steam.rate = stage === 'raw' || stage === 'cooked' ? (fx.type === 'pot' ? 12 : 10) : 0;
      fx.smoke.rate = stage === 'burnt' ? 18 : 0;
      fx.sparks.rate = overclocked ? 40 : 0;
      fx.column.material.uniforms.uIntensity.value = fx.heat * (stage === 'burnt' ? 0.4 : 1);

      if (fx.glow) {
        const flicker = overclocked ? 0.8 + 0.8 * Math.abs(Math.sin(this.time * 18)) : 0;
        fx.glow.emissiveIntensity = 0.25 + fx.heat * 1.4 + flicker;
      }
    }

    for (const emitter of this.levelEmitters) emitter.update(dt);
  }

  // Active cookers, for the heat-haze post-processing pass.
  heatSources() {
    const sources = [];
    for (const fx of this.stationFx.values()) {
      if (fx.heat > 0.05) sources.push({ position: fx.origin, strength: fx.heat });
    }
    return sources.slice(0, 4);
  }

  clear() {
    for (const child of [...this.levelGroup.children]) {
      this.levelGroup.remove(child);
      disposeObject(child);
    }
    this.levelEmitters = [];
    this.stationFx.clear();
  }
}
