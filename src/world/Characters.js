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

// Retargets X Bot's clips onto another Mixamo-style skeleton. X Bot's bones all
// rest with identity rotations (aligned to the world axes), so a clip's local
// rotation for a bone is also its rotation relative to rest. Other skeletons
// rest with bones rotated along the limbs, so for each bone we convert:
//   target local = inverse(parent rest world) × X Bot local × bone rest world
// Only rotations are kept, so walks play in place.
const clipCache = new Map();
function clipsFor(body, model) {
  if (clipCache.has(body)) return clipCache.get(body);

  model.updateMatrixWorld(true);
  const rest = new Map();
  let prefix = '';
  model.traverse((node) => {
    if (!node.isBone) return;
    if (node.name.startsWith('mixamorig')) prefix = 'mixamorig';
    const parentWorld = node.parent.getWorldQuaternion(new THREE.Quaternion());
    rest.set(node.name, { world: node.getWorldQuaternion(new THREE.Quaternion()), parentInverse: parentWorld.invert() });
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
      const bone = prefix + track.name.slice(0, -'.quaternion'.length).replace(/^mixamorig/, '');
      const target = rest.get(bone);
      if (!target) continue;
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(track.values, i).premultiply(target.parentInverse).multiply(target.world).toArray(values, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, track.times, values));
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
