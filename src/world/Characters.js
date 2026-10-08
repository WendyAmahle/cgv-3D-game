import * as THREE from 'three';
import { assets } from '../utils/AssetLoader.js';
import { mat } from '../graphics/Materials.js';

// Animated customers. Bodies: a Ready Player Me avatar (recoloured per
// customer) and Mixamo's Michelle. Both use the Mixamo skeleton, so Mixamo's
// X Bot animations (idle, walk, nod, head shake) drive every body.
//
// createCustomer() returns { root, animator, height }. root faces +z.

const CLIPS = { idle: 'idle', walk: 'walk', agree: 'agree', headShake: 'headShake' };
const ONE_SHOTS = new Set(['agree', 'headShake']);

const BODIES = {
  truck: ['avatar', 'avatar', 'michelle'],
  izakaya: ['avatar', 'michelle', 'avatar'],
  cyber: ['avatar', 'avatar', 'michelle'],
};

const OUTFITS = {
  truck: {
    top: [0xf8fafc, 0x2563eb, 0xdc2626, 0x16a34a, 0xf59e0b, 0x7c3aed, 0x0f766e, 0xf472b6],
    bottom: [0x1e3a8a, 0x374151, 0x78350f, 0x111827, 0xd6d3d1, 0x3f6212],
  },
  izakaya: {
    top: [0x1e293b, 0x7f1d1d, 0x334155, 0x3f3f46, 0x14532d, 0xe7e5e4],
    bottom: [0x111827, 0x292524, 0x1e3a8a, 0x44403c],
  },
  cyber: {
    top: [0x0f172a, 0x581c87, 0x0e7490, 0x111111, 0xbe185d],
    bottom: [0x020617, 0x1f2937, 0x312e81],
  },
};
const SKIN_TONES = [1, 0.9, 0.78, 0.62, 0.48, 0.38];

function seeded(seed) {
  let state = (seed * 16807 + 11) % 2147483647;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

// Retargets X Bot's clips onto another Mixamo-style skeleton. X Bot's bones
// all rest with identity LOCAL rotations, so a clip's local rotation for a
// bone is also its rotation relative to rest — the exact same delta applies
// directly as an extra local-space rotation layered on top of the target's
// own rest pose:
//   target local = bone rest local × X Bot local
// (An earlier version of this conjugated the delta through the parent's
// rest-world orientation instead — `inverse(parent rest world) × X Bot local
// × bone rest world` — which is only correct at the rest pose itself; for any
// real rotation it silently mirrors the limb to the wrong side once a bone's
// rest orientation isn't aligned to world axes. Verified against the actual
// skeletons: that formula swings both hands behind the back/across the body
// in every clip for the avatar body; this one keeps them on the correct
// side.) Only rotations are kept, so walks play in place.
//
// Bones are matched by name with any Mixamo prefix stripped, not by the raw
// name: X Bot and Michelle use "mixamorig:Hips" (with a colon), while the
// Ready Player Me avatar's bones are unprefixed ("Hips"). Matching on the raw
// name worked for Michelle by coincidence but silently matched nothing for
// the avatar, so every avatar-bodied character (customers and the chef) got
// no animation at all and just sat in its bind pose.
const stripMixamoPrefix = (name) => name.replace(/^mixamorig:?/, '');

const clipCache = new Map();
function clipsFor(body, model) {
  if (clipCache.has(body)) return clipCache.get(body);

  model.updateMatrixWorld(true);
  const rest = new Map();
  model.traverse((node) => {
    if (!node.isBone) return;
    rest.set(stripMixamoPrefix(node.name), { name: node.name, restLocal: node.quaternion.clone() });
  });

  const source = assets.animations('xbot');
  const q = new THREE.Quaternion();
  const clips = {};
  for (const [name, sourceName] of Object.entries(CLIPS)) {
    const clip = source.find((candidate) => candidate.name === sourceName);
    if (!clip) continue;
    const tracks = [];
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      const bone = stripMixamoPrefix(track.name.slice(0, -'.quaternion'.length));
      const target = rest.get(bone);
      if (!target) continue;
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(track.values, i).premultiply(target.restLocal).toArray(values, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${target.name}.quaternion`, track.times, values));
    }
    clips[name] = new THREE.AnimationClip(name, clip.duration, tracks);
  }
  clipCache.set(body, clips);
  return clips;
}

export class Animator {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    this.current = null;
    this.next = null;
    for (const [name, clip] of Object.entries(clips)) {
      const action = this.mixer.clipAction(clip);
      if (ONE_SHOTS.has(name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[name] = action;
    }
    this.mixer.addEventListener('finished', (event) => {
      if (event.action === this.current && this.next) {
        const next = this.next;
        this.next = null;
        this.play(next);
      }
    });
  }

  get animated() {
    return Object.keys(this.actions).length > 0;
  }

  play(name, { fade = 0.35, timeScale = 1, then = null } = {}) {
    const action = this.actions[name];
    this.next = then;
    if (!action) return;
    if (action === this.current && !ONE_SHOTS.has(name)) {
      action.setEffectiveTimeScale(timeScale);
      return;
    }
    action.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = action;
  }

  update(dt) {
    this.mixer.update(dt);
  }
}

function tinted(material, color, shade = 1) {
  const copy = material.clone();
  copy.userData.shared = false;
  if (color !== null) copy.color.set(color);
  copy.color.multiplyScalar(shade);
  return copy;
}

function dressAvatar(model, theme, random) {
  const outfit = OUTFITS[theme] ?? OUTFITS.truck;
  const choose = (list) => list[Math.floor(random() * list.length)];
  const skin = choose(SKIN_TONES);
  const showBeard = random() > 0.6;
  const top = choose(outfit.top);
  const bottom = choose(outfit.bottom);

  model.traverse((object) => {
    if (!object.isMesh) return;
    const name = object.material.name;
    if (name === 'Wolf3D_Skin' || name === 'Wolf3D_Body') object.material = tinted(object.material, null, skin);
    else if (name === 'Wolf3D_Outfit_Top') object.material = tinted(object.material, top);
    else if (name === 'Wolf3D_Outfit_Bottom') object.material = tinted(object.material, bottom);
    else if (name === 'Wolf3D_Beard') object.visible = showBeard;
  });
}

export function createCustomer(theme, seed) {
  const random = seeded(seed);
  const pool = BODIES[theme] ?? BODIES.truck;
  const body = [pool[Math.floor(random() * pool.length)], 'avatar', 'michelle'].find((key) => assets.has(key));
  const model = body && assets.model(body);
  if (!model) return createFallbackCustomer(theme, random);
  const clips = clipsFor(body, model);

  if (body === 'avatar') dressAvatar(model, theme, random);

  // Normalise height, then stand the feet on the ground.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = 1.72 * (0.93 + random() * 0.12);
  model.scale.multiplyScalar(height / (box.max.y - box.min.y));
  model.updateMatrixWorld(true);
  model.position.y -= new THREE.Box3().setFromObject(model).min.y;

  const root = new THREE.Group();
  root.add(model);

  return { root, animator: new Animator(model, clips), height };
}

// Primitive customer, used only if the character models failed to load.
function createFallbackCustomer(theme, random) {
  const root = new THREE.Group();
  const outfit = OUTFITS[theme] ?? OUTFITS.truck;
  const cloth = mat(outfit.top[Math.floor(random() * outfit.top.length)], { roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), cloth);
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), mat(0xe0ac69, { roughness: 0.8 }));
  head.position.y = 1.55;
  root.add(body, head);
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return { root, animator: new Animator(root, {}), height: 1.75 };
}

// ------------------------------------------------------------------- chef

// A white toque, built from primitives and parented to the head bone so it
// follows every head movement of the animation (hierarchical modelling).
function createChefHat() {
  const white = mat(0xffffff, { roughness: 0.9 });
  const hat = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.12, 24), white);
  band.position.y = 0.06;
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), white);
  puff.scale.set(1, 0.72, 1);
  puff.position.y = 0.17;
  hat.add(band, puff);
  hat.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return hat;
}

// Seats the hat on top of the head, upright in the model's rest pose.
function putOnHat(model, hat) {
  let head = null;
  let headTop = null;
  model.traverse((node) => {
    if (!node.isBone) return;
    if (/HeadTop_End$/.test(node.name)) headTop = node;
    else if (/Head$/.test(node.name)) head = node;
  });
  if (!head) return false;

  model.updateMatrixWorld(true);
  const top = (headTop ?? head).getWorldPosition(new THREE.Vector3());
  if (!headTop) top.y += 0.12;
  top.y -= 0.04;
  const scale = head.getWorldScale(new THREE.Vector3());
  const rotation = head.getWorldQuaternion(new THREE.Quaternion());

  head.add(hat);
  hat.position.copy(head.worldToLocal(top));
  hat.quaternion.copy(rotation.invert());
  hat.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  return true;
}

// The player's chef: same bodies and animations as the customers, in whites.
export function createChef() {
  const body = ['avatar', 'michelle'].find((key) => assets.has(key));
  const model = body && assets.model(body);
  if (!model) return createFallbackChef();
  const clips = clipsFor(body, model);

  if (body === 'avatar') {
    model.traverse((object) => {
      if (!object.isMesh) return;
      const name = object.material.name;
      if (name === 'Wolf3D_Skin' || name === 'Wolf3D_Body') object.material = tinted(object.material, null, 0.62);
      else if (name === 'Wolf3D_Outfit_Top') {
        // Plain chef's whites: drop the outfit's printed colours, keep its folds (normal map).
        object.material = tinted(object.material, 0xf8fafc);
        object.material.map = null;
      } else if (name === 'Wolf3D_Outfit_Bottom') object.material = tinted(object.material, 0x1f2937);
      else if (name === 'Wolf3D_Beard' || name === 'Wolf3D_Headwear') object.visible = false; // the toque replaces any hat
    });
  }

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = 1.74;
  model.scale.multiplyScalar(height / (box.max.y - box.min.y));
  model.updateMatrixWorld(true);
  model.position.y -= new THREE.Box3().setFromObject(model).min.y;

  const root = new THREE.Group();
  root.add(model);
  const hat = createChefHat();
  if (!putOnHat(model, hat)) {
    hat.position.y = height - 0.04;
    root.add(hat);
  }
  model.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });

  return { root, animator: new Animator(model, clips), height };
}

function createFallbackChef() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), mat(0xf8fafc, { roughness: 0.85 }));
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), mat(0xc68642, { roughness: 0.8 }));
  head.position.y = 1.55;
  const hat = createChefHat();
  hat.position.y = 1.66;
  root.add(body, head, hat);
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return { root, animator: new Animator(root, {}), height: 1.9 };
}
