import * as THREE from 'three';
import { mat } from '../graphics/Materials.js';
import { createCookingMaterial, createLiquidMaterial } from '../graphics/Shaders.js';
import { ITEMS } from '../gameplay/Recipes.js';

// Procedural models built from primitives. Replace builders with loaded GLTF
// models later (utils/AssetLoader.js) — keep userData.height / cookMaterial /
// liquidMaterial so gameplay keeps working.

const COOK_COLORS = {
  patty: { raw: 0xe58a9a, cooked: 0x7a4524, burnt: 0x1c1410, marks: 1 },
  pork: { raw: 0xf2b8b0, cooked: 0xc8864a, burnt: 0x2a1a12, marks: 1 },
  potato: { raw: 0xf3e3a8, cooked: 0xe8a93a, burnt: 0x3a2412, marks: 0 },
  noodles: { raw: 0xf2e6c2, cooked: 0xf5d77a, burnt: 0xbfb89a, marks: 0 },
};

function mesh(geometry, material, position = [0, 0, 0]) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function group(height, ...children) {
  const result = new THREE.Group();
  result.add(...children);
  result.userData.height = height;
  return result;
}

function cookable(type, build) {
  const material = createCookingMaterial(COOK_COLORS[type]);
  const result = build(material);
  result.userData.cookMaterial = material;
  return result;
}

function liquidVessel(type) {
  const { vessel, color, foam } = ITEMS[type].liquid;

  if (vessel === 'bowl') {
    const profile = [
      [0.0, 0.0], [0.2, 0.0], [0.3, 0.06], [0.36, 0.16], [0.38, 0.24], [0.36, 0.24], [0.33, 0.16], [0.27, 0.07], [0.0, 0.03],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const bowl = mesh(new THREE.LatheGeometry(profile, 28), mat(0xf4efe6, { roughness: 0.35, side: THREE.DoubleSide }));
    const liquidMaterial = createLiquidMaterial({ color, foam, bottom: -0.09, top: 0.08 });
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.24, 0.18, 24, 1, true), liquidMaterial);
    liquid.position.y = 0.12;
    const result = group(0.12, bowl, liquid);
    result.userData.liquidMaterial = liquidMaterial;
    return result;
  }

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.13, 0.42, 20, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
  );
  cup.position.y = 0.21;
  const bottom = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20), mat(0xe2e8f0), [0, 0.01, 0]);
  const liquidMaterial = createLiquidMaterial({ color, foam, bottom: -0.19, top: 0.17 });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.12, 0.38, 20, 1, true), liquidMaterial);
  liquid.position.y = 0.21;
  liquid.renderOrder = -1;
  const straw = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), mat(0xef4444), [0.05, 0.36, 0]);
  straw.rotation.z = -0.2;
  const result = group(0.42, bottom, liquid, cup, straw);
  result.userData.liquidMaterial = liquidMaterial;
  return result;
}

const BUILDERS = {
  bun: () => {
    const bottom = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 24), mat(0xe9c98b), [0, 0.05, 0]);
    const top = mesh(new THREE.SphereGeometry(0.31, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe0a95a), [0, 0.1, 0]);
    top.scale.y = 0.6;
    return group(0.28, bottom, top);
  },
  patty: () =>
    cookable('patty', (material) => group(0.1, mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 24, 2), material, [0, 0.05, 0]))),
  pork: () =>
    cookable('pork', (material) => {
      const a = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), material, [-0.08, 0.03, 0]);
      const b = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), material, [0.1, 0.06, 0.04]);
      b.rotation.z = 0.2;
      return group(0.09, a, b);
    }),
  potato: () =>
    cookable('potato', (material) => {
      const sticks = [];
      for (let index = 0; index < 7; index += 1) {
        const stick = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.32), material, [(index - 3) * 0.055, 0.04 + (index % 2) * 0.04, 0]);
        stick.rotation.y = (index - 3) * 0.12;
        sticks.push(stick);
      }
      return group(0.12, ...sticks);
    }),
  noodles: () =>
    cookable('noodles', (material) => {
      const nest = mesh(new THREE.TorusKnotGeometry(0.15, 0.035, 90, 8, 3, 5), material, [0, 0.07, 0]);
      nest.scale.y = 0.45;
      return group(0.12, nest);
    }),
  lettuce: () => {
    const leaf = mesh(new THREE.SphereGeometry(0.32, 16, 10), mat(0x7adf6d, { roughness: 0.9 }), [0, 0.03, 0]);
    leaf.scale.set(1, 0.16, 1);
    return group(0.06, leaf);
  },
  cheese: () => {
    const slice = mesh(new THREE.BoxGeometry(0.46, 0.035, 0.46), mat(0xf7c948, { roughness: 0.5 }), [0, 0.018, 0]);
    slice.rotation.y = Math.PI / 4;
    return group(0.04, slice);
  },
  egg: () => {
    const white = mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xfaf7f0), [0, 0, 0]);
    white.scale.set(1, 0.7, 1.3);
    const yolk = mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(0xf59e0b, { roughness: 0.3 }), [0, 0.03, 0]);
    yolk.scale.y = 0.5;
    return group(0.1, white, yolk);
  },
  nori: () => {
    const sheet = mesh(new THREE.BoxGeometry(0.22, 0.3, 0.01), mat(0x1f2d1b, { roughness: 0.6 }), [0, 0.15, -0.15]);
    sheet.rotation.x = -0.25;
    return group(0.02, sheet);
  },
  cola: () => liquidVessel('cola'),
  tea: () => liquidVessel('tea'),
  broth: () => liquidVessel('broth'),
  neonSoda: () => liquidVessel('neonSoda'),
};

export function createItemMesh(type) {
  const builder = BUILDERS[type];
  if (!builder) throw new Error(`No model for item type: ${type}`);
  const result = builder();
  result.name = type;
  return result;
}

export function createPlateMesh() {
  const plate = mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.05, 32), mat(0xf8fafc, { roughness: 0.3 }), [0, 0.025, 0]);
  const result = group(0.05, plate);
  result.userData.baseHeight = 0.05;
  result.name = 'plate';
  return result;
}

export function setCookVisual(object, amount, heat) {
  const material = object.userData.cookMaterial;
  if (!material) return;
  material.uniforms.uCook.value = amount;
  material.uniforms.uHeat.value = heat;
}

export function setLiquidFill(object, fill) {
  const material = object.userData.liquidMaterial;
  if (material) material.uniforms.uFill.value = fill;
}

// ---------------------------------------------------------------- customers

const SKIN_TONES = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x6b3e26, 0xffdbac];
const OUTFITS = {
  truck: [0xfbbf24, 0x60a5fa, 0xf87171, 0x34d399, 0xa78bfa, 0xfb923c],
  izakaya: [0x1e3a5f, 0x7c2d12, 0x374151, 0x5b21b6, 0x065f46],
  cyber: [0x111827, 0x1f2937, 0x312e81, 0x3b0764],
};

function seeded(seed) {
  let state = seed * 16807 + 11;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

// Built facing +z; Customers.js turns it to face the counter.
export function createCustomerModel(theme, seed) {
  const random = seeded(seed);
  const choose = (list) => list[Math.floor(random() * list.length)];
  const outfit = choose(OUTFITS[theme] ?? OUTFITS.truck);
  const result = new THREE.Group();

  const body = mesh(new THREE.CapsuleGeometry(0.3, 0.7, 6, 12), mat(outfit, { roughness: 0.85 }), [0, 0.85, 0]);
  result.add(body);

  if (theme === 'cyber') {
    const head = mesh(new THREE.BoxGeometry(0.42, 0.38, 0.4), mat(0x9ca3af, { metalness: 0.8, roughness: 0.3 }), [0, 1.62, 0]);
    const visor = mesh(
      new THREE.BoxGeometry(0.36, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: choose([0x00f0ff, 0xff2bd6, 0x7cff6b]), emissiveIntensity: 2.5 }),
      [0, 1.65, 0.21]
    );
    const antenna = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 6), mat(0x9ca3af), [0.12, 1.92, 0]);
    result.add(head, visor, antenna);
  } else {
    const skin = mat(choose(SKIN_TONES), { roughness: 0.8 });
    const head = mesh(new THREE.SphereGeometry(0.22, 20, 16), skin, [0, 1.6, 0]);
    const hair = mesh(
      new THREE.SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(choose([0x1f2937, 0x3f2a1d, 0x6b4423, 0xd1a054, 0x111111])),
      [0, 1.64, -0.02]
    );
    const eyeMaterial = mat(0x111111);
    const eyeL = mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMaterial, [-0.08, 1.63, 0.19]);
    const eyeR = mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMaterial, [0.08, 1.63, 0.19]);
    result.add(head, hair, eyeL, eyeR);
    if (theme === 'izakaya' && random() > 0.5) {
      const band = mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), mat(0xf8fafc), [0, 1.7, 0]);
      band.rotation.x = Math.PI / 2;
      result.add(band);
    }
  }

  const armMaterial = mat(outfit, { roughness: 0.85 });
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), armMaterial, [side * 0.38, 0.95, 0]);
    arm.rotation.z = side * 0.15;
    result.add(arm);
  }
  return result;
}

// ------------------------------------------------------------- sprites / UI

export function createTextSprite(text, { fontSize = 64, color = '#ffffff', background = 'rgba(0,0,0,0)', height = 0.5, padding = 24, font = 'Segoe UI, Arial, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSpec = `700 ${fontSize}px ${font}`;
  context.font = fontSpec;
  const width = Math.ceil(context.measureText(text).width) + padding * 2;
  canvas.width = width;
  canvas.height = fontSize + padding * 2;

  context.fillStyle = background;
  const radius = Math.min(28, canvas.height / 2);
  context.beginPath();
  context.roundRect(0, 0, canvas.width, canvas.height, radius);
  context.fill();
  context.font = fontSpec;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + fontSize * 0.05);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, fog: false, toneMapped: false }));
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

// Recipe name + patience bar floating above a customer.
export function createOrderBubble(text) {
  const result = new THREE.Group();
  const label = createTextSprite(text, { fontSize: 44, color: '#111827', background: 'rgba(255,255,255,0.92)', height: 0.36 });
  const barWidth = 1.1;
  const background = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1f2937, fog: false }));
  background.center.set(0, 0.5);
  background.scale.set(barWidth, 0.09, 1);
  background.position.set(-barWidth / 2, -0.28, 0);
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x22c55e, fog: false, toneMapped: false }));
  fill.center.set(0, 0.5);
  fill.scale.set(barWidth, 0.07, 1);
  fill.position.set(-barWidth / 2, -0.28, 0.01);
  result.add(label, background, fill);

  result.userData.setPatience = (ratio) => {
    fill.scale.x = Math.max(0.001, barWidth * ratio);
    fill.material.color.setHSL(0.33 * ratio, 0.85, 0.5);
  };
  return result;
}

export function createSelectionRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.74, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff08a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  return ring;
}
