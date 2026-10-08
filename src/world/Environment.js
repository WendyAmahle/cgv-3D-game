import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT } from '../utils/Constants.js';
import { assets } from '../utils/AssetLoader.js';
import { canvasTexture, mat, noiseNormalMap, pbr, physical, surfaces, windowsTexture } from '../graphics/Materials.js';
import { RECIPES } from '../gameplay/Recipes.js';
import { createSky } from './Sky.js';
import { buildStationView } from './Stations.js';
import { buildNeonStreet } from './City.js';
import { createTextSprite } from './Models.js';

// Per-level visual identity. `sky` is only used if the HDRI fails to load.
export const THEMES = {
  truck: {
    palette: { accent: 0xc1121f, trim: 0xf8fafc },
    sky: { top: 0x4a9dff, bottom: 0xdff1ff, glow: 0xfff2c4, stars: 0 },
    fog: { color: 0xcfe6ff, near: 30, far: 90 },
    skybox: { height: 12, radius: 70 },
  },
  izakaya: {
    palette: { accent: 0x1e2a44, trim: 0x2a1a10 },
    sky: { top: 0x050818, bottom: 0x1a2240, glow: 0x3b2a5a, stars: 1 },
    fog: { color: 0x0e1224, near: 20, far: 60 },
    skybox: { height: 10, radius: 60 },
  },
  cyber: {
    palette: { accent: 0xff2bd6, trim: 0x00f0ff },
    sky: { top: 0x05010f, bottom: 0x2a0b3d, glow: 0xff2bd6, stars: 0.3 },
    fog: { color: 0x1a0a2a, near: 16, far: 50 },
    skybox: { height: 14, radius: 70 },
  },
};

// ---------------------------------------------------------------- helpers

function box(w, h, d, material, [x, y, z], { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function plane(w, d, material, [x, y, z]) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function place(root, key, [x, y, z], { rotation = 0, scale = 1 } = {}) {
  const model = assets.model(key);
  if (!model) return null;
  model.position.set(x, y, z);
  model.rotation.y = rotation;
  model.scale.setScalar(scale);
  root.add(model);
  return model;
}

// Same as `place`, but skips shadow-casting: for small background clutter
// (foliage, planters) where a shadow draw call isn't worth the cost.
function placeLite(root, key, position, options) {
  const model = place(root, key, position, options);
  model?.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });
  return model;
}

// One mesh from several box footprints that share a material, instead of one
// draw call per box — cuts the truck body down from 6 meshes to 3.
function mergedBoxes(material, boxes) {
  const geometries = boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A soft dark ellipse on the ground: a cheap stand-in for contact/ambient
// occlusion under big static props like the truck, grounding them visually
// without an extra light or render pass.
function contactShadow(radiusX, radiusZ, [x, y, z]) {
  const fade = canvasTexture('contact-shadow', 128, (ctx, size) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, [1, 1], THREE.NoColorSpace);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: fade, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(radiusX, radiusZ, 1);
  mesh.position.set(x, y, z);
  mesh.renderOrder = -0.5;
  return mesh;
}

function neon(color, intensity = 3) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });
}

// Round ground patch whose edge fades into the HDRI ground around it.
function groundPatch(material, radius) {
  const fade = canvasTexture('ground-fade', 256, (ctx, size) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, c * 0.6, c, c, c);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, [1, 1], THREE.NoColorSpace);
  const patchMaterial = material.clone();
  patchMaterial.userData.shared = false;
  patchMaterial.alphaMap = fade;
  patchMaterial.transparent = true;
  patchMaterial.depthWrite = false;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), patchMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.receiveShadow = true;
  mesh.renderOrder = -1;
  return mesh;
}

// Chalkboard menu listing the level's dishes and prices.
function menuBoard(level, [x, y, z], { width = 3.2, height = 1.5 } = {}) {
  const names = [...new Set(level.recipes)].map((id) => RECIPES[id]);
  const texture = canvasTexture(`menu-${level.id}`, 512, (ctx, size) => {
    ctx.fillStyle = '#1d2521';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4000; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
    ctx.fillStyle = '#fef3c7';
    ctx.font = '700 64px "Segoe Print", "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(level.name.toUpperCase(), size / 2, 90);
    ctx.font = '400 38px "Segoe Print", "Comic Sans MS", cursive';
    ctx.textAlign = 'left';
    names.forEach((recipe, index) => {
      const rowY = 170 + index * 62;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(recipe.name, 40, rowY);
      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'right';
      ctx.fillText(`$${recipe.price}`, size - 40, rowY);
      ctx.textAlign = 'left';
    });
  });
  texture.repeat.set(1, height / width);
  texture.offset.set(0, (1 - height / width) / 2);
  const group = new THREE.Group();
  group.add(box(width + 0.12, height + 0.12, 0.05, physical(0x3b2616, { roughness: 0.6 }), [0, 0, 0]));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat(0xffffff, { map: texture, roughness: 0.95 }));
  board.position.z = 0.03;
  group.add(board);
  group.position.set(x, y, z);
  return group;
}

// "Please wait here" floor sticker for each customer spot.
function spotDecal() {
  const texture = canvasTexture('spot-decal', 256, (ctx, size) => {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(250,204,21,0.85)';
    ctx.lineWidth = 14;
    ctx.setLineDash([26, 16]);
    ctx.beginPath();
    ctx.arc(c, c, c - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(250,204,21,0.85)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(c + side * 26, c + 10, 16, 34, side * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.8, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- shell

// Floor, two counters and back wall; materials come from the theme.
function buildShell(root, { floor, counterBody, counterTop, counterFront, wall }) {
  root.add(plane(14.4, 6.4, floor, [0, 0.01, -1.3]));

  const bodyHeight = LAYOUT.counterTopY - 0.05;
  for (const z of [LAYOUT.frontRowZ, LAYOUT.backRowZ]) {
    root.add(box(LAYOUT.counterLength, bodyHeight, 1.1, counterBody, [0, bodyHeight / 2, z]));
    root.add(box(LAYOUT.counterLength + 0.2, 0.05, 1.22, counterTop, [0, LAYOUT.counterTopY - 0.025, z]));
  }
  root.add(box(LAYOUT.counterLength, bodyHeight - 0.1, 0.02, counterFront, [0, bodyHeight / 2, LAYOUT.frontRowZ + 0.56]));
  root.add(box(15, 4.3, 0.3, wall, [0, 2.15, LAYOUT.backWallZ]));
}

function buildCustomerSlots(root, count) {
  const spacing = count <= 2 ? 3.6 : count === 3 ? 3.2 : 2.8;
  return Array.from({ length: count }, (_, index) => {
    const x = (index - (count - 1) / 2) * spacing;
    const slotRoot = new THREE.Group();
    slotRoot.position.set(x, 0, LAYOUT.customerZ);
    slotRoot.add(spotDecal());
    const focus = new THREE.Object3D();
    slotRoot.add(focus);
    root.add(slotRoot);
    return { root: slotRoot, focus, position: slotRoot.position };
  });
}

// ------------------------------------------------------------------ decor

const DECOR = {
  truck(root, level, cutaway) {
    buildShell(root, {
      floor: pbr('metal_plate', [7, 3], 0x9ca3af, { metalness: 0.9 }),
      counterBody: surfaces.steel(),
      counterTop: surfaces.steel(),
      counterFront: surfaces.paint(0xc1121f),
      wall: pbr('long_white_tiles', [5, 2], 0xf4f4f5),
    });

    const paving = pbr('patterned_paving', [14, 14], 0xcfc6b4);
    root.add(groundPatch(paving, 26));
    root.add(plane(9, 60, pbr('leafy_grass', [4, 24], 0x6a9c4a), [-18, 0.004, 0]));

    // Truck body: one merged mesh per material instead of one box per panel,
    // so the two side walls/trims cost 3 draw calls instead of 6.
    const paint = surfaces.paint(0xc1121f);
    const white = surfaces.paint(0xf8fafc);
    const chrome = surfaces.chrome();
    root.add(mergedBoxes(paint, [
      [0.12, 4.2, 6.4, -7.2, 2.1, -1.2],
      [0.12, 4.2, 6.4, 7.2, 2.1, -1.2],
      [14.6, 0.5, 0.12, 0, 0.25, 2.05], // skirt under the hatch
    ]));
    root.add(mergedBoxes(chrome, [
      [0.14, 0.14, 6.4, -7.2, 1.2, -1.2],
      [0.14, 0.14, 6.4, 7.2, 1.2, -1.2],
    ]));
    root.add(mergedBoxes(white, [
      [0.14, 0.5, 6.4, -7.2, 3.6, -1.2],
      [0.14, 0.5, 6.4, 7.2, 3.6, -1.2],
    ]));
    const roof = box(14.6, 0.2, 6.8, white, [0, 4.3, -1.2]);
    root.add(roof);
    cutaway.push(roof);
    root.add(contactShadow(8.2, 3.8, [0, 0.013, -1.2]));

    // Striped awning over the serving hatch.
    const stripes = canvasTexture('awning', 256, (ctx, size) => {
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = i % 2 ? '#fdf6e3' : '#c1121f';
        ctx.fillRect((i * size) / 8, 0, size / 8, size);
      }
    }, [6, 1]);
    const awning = box(14.8, 0.04, 1.8, physical(0xffffff, { map: stripes, normalMap: noiseNormalMap('fabric', { scale: 64, strength: 0.6 }), roughness: 0.85, sheen: 0.5 }), [0, 4.05, 2.85]);
    awning.rotation.x = 0.16;
    root.add(awning);
    cutaway.push(awning);

    // Cab at the left end.
    const cab = new THREE.Group();
    cab.add(box(2.4, 2.4, 5.2, paint, [0, 1.6, 0]));
    cab.add(box(0.05, 1.0, 4.4, physical(0x0b1220, { roughness: 0.05, metalness: 0.2, clearcoat: 1 }), [-1.21, 2.2, 0]));
    cab.add(box(0.1, 0.35, 5.3, chrome, [-1.22, 0.55, 0]));
    // Headlamps barely glow in broad daylight; they're a chrome highlight, not a light source.
    const lampGeometries = [-2.1, 2.1].map((z) => new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20).rotateZ(Math.PI / 2).translate(-1.25, 0.95, z));
    const lamps = new THREE.Mesh(mergeGeometries(lampGeometries), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.2, emissive: 0xfff3c4, emissiveIntensity: 0.25 }));
    cab.add(lamps);
    cab.position.set(-8.6, 0, -1.2);
    root.add(cab);
    root.add(contactShadow(2.6, 3.1, [-8.6, 0.013, -1.2]));

    // Wheels: under the truck body and the cab, merged into two draw calls
    // (tyres, hubs) instead of one mesh pair per wheel.
    const tyre = surfaces.rubber();
    const wheelSpots = [[-4.5, 2.12], [4.5, 2.12], [-4.5, -4.55], [4.5, -4.55], [-8.6, 1.45], [-8.6, -3.85]];
    const tireGeometries = wheelSpots.map(([x, z]) => new THREE.TorusGeometry(0.42, 0.16, 16, 32).translate(x, 0.58, z));
    const hubGeometries = wheelSpots.map(([x, z]) => new THREE.CylinderGeometry(0.28, 0.28, 0.24, 24).rotateX(Math.PI / 2).translate(x, 0.58, z));
    const tires = new THREE.Mesh(mergeGeometries(tireGeometries), tyre);
    const hubs = new THREE.Mesh(mergeGeometries(hubGeometries), chrome);
    tires.castShadow = hubs.castShadow = true;
    root.add(tires, hubs);

    root.add(menuBoard(level, [0, 2.8, LAYOUT.backWallZ + 0.18]));
    place(root, 'register', [-6.1, LAYOUT.counterTopY, LAYOUT.frontRowZ], { rotation: Math.PI, scale: 1.2 });

    // Park furniture. Foliage skips shadow-casting (placeLite) — cheap plants
    // with a lot of small leaf triangles aren't worth a shadow draw call.
    place(root, 'picnicTable', [-5.5, 0, 8], { rotation: Math.PI / 2 });
    place(root, 'picnicTable', [5.5, 0, 8.5], { rotation: Math.PI / 2 + 0.2 });
    place(root, 'streetLamp', [-10, 0, 4.5]);
    place(root, 'streetLamp', [10, 0, 4.5]);
    place(root, 'trashCan', [9.3, 0, 7], { rotation: -0.5 });

    // Scanned street furniture (real-world metre scale). Positions keep clear
    // of the customers' walk-in path and the overview camera's sightlines to
    // the stations.
    place(root, 'chalkboard', [-3.4, 0, 5.4], { rotation: 0.25 });
    place(root, 'cafeSet', [1.6, 0, 8.4], { rotation: 0.3 });
    place(root, 'monoblocChair', [-3.3, 0, 7.5], { rotation: -1.2 });
    place(root, 'monoblocChair', [-3.1, 0, 8.7], { rotation: -2.1 });
    place(root, 'bench', [9.8, 0, 2.2], { rotation: -Math.PI / 2 });
    place(root, 'planter', [-4.6, 0, 2.35]);
    place(root, 'planter', [4.6, 0, 2.35]);

    const sway = [
      [placeLite(root, 'shrub', [-3, 0, -6.6], { scale: 1.2 }), 0],
      [placeLite(root, 'shrub', [5, 0, -6.4], { rotation: 2.5, scale: 1.1 }), 1.7],
      [placeLite(root, 'shrub', [12, 0, -3], { rotation: 1.2 }), 3.1],
      [placeLite(root, 'pottedPlant', [-7.8, 0, 3.4], { scale: 1.3 }), 4.4],
      [placeLite(root, 'pottedPlant', [7.8, 0, 3.4], { rotation: 1.4, scale: 1.3 }), 5.6],
    ].filter(([model]) => model).map(([model, seed]) => ({ model, seed, base: model.rotation.z }));

    // Idle motion so the level doesn't read as a static photo: the awning
    // flutters and the park greenery sways gently in the breeze.
    return (dt, time) => {
      awning.rotation.x = 0.16 + Math.sin(time * 1.4) * 0.015;
      for (const leaf of sway) leaf.model.rotation.z = leaf.base + Math.sin(time * 0.9 + leaf.seed) * 0.035;
    };
  },

  izakaya(root, level, cutaway) {
    const cedar = pbr('japanese_cedar_planks', [4, 2], 0x8a5a36);
    const counterWood = pbr('wood_table', [4, 1], 0x6b4423, { roughness: 0.6 });
    buildShell(root, {
      floor: pbr('dark_wooden_planks', [6, 3], 0x3e2a1c),
      counterBody: cedar,
      counterTop: counterWood,
      counterFront: cedar,
      wall: cedar,
    });
    root.add(groundPatch(pbr('cobblestone_pavement', [16, 16], 0x55555f), 26));

    for (const side of [-1, 1]) root.add(box(0.25, 4.2, 6.6, cedar, [side * 7.2, 2.1, -1.1]));
    const roofTiles = physical(0x1c1c22, { roughness: 0.55, normalMap: noiseNormalMap('tiles', { scale: 12, strength: 2 }) });
    const roof = box(16, 0.3, 8, roofTiles, [0, 4.4, -1.0]);
    roof.rotation.x = -0.08;
    const eave = box(16, 0.18, 0.6, mat(0x2a1a10), [0, 4.05, 2.8]);
    root.add(roof, eave);
    cutaway.push(roof, eave);

    // Noren curtain strips that sway.
    const norenTexture = canvasTexture('noren', 256, (ctx, size) => {
      ctx.fillStyle = '#1e2a44';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 150px "Yu Mincho", "MS Mincho", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('麺', size / 2, size / 2 + 10);
    });
    const cloth = physical(0xffffff, { map: norenTexture, side: THREE.DoubleSide, roughness: 0.9, sheen: 0.6, normalMap: noiseNormalMap('fabric', { scale: 64, strength: 0.6 }) });
    const noren = [];
    for (let index = 0; index < 7; index += 1) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.95, 1, 6), cloth);
      strip.geometry.translate(0, -0.47, 0);
      strip.position.set(-5.7 + index * 1.9, 3.95, 2.75);
      strip.castShadow = true;
      root.add(strip);
      noren.push(strip);
      cutaway.push(strip);
    }

    // Paper lanterns (the night preset puts point lights beside them).
    const paper = canvasTexture('lantern-paper', 256, (ctx, size) => {
      ctx.fillStyle = '#d7261e';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(40,0,0,0.5)';
      ctx.lineWidth = 3;
      for (let y = 0; y < size; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#111';
      ctx.font = '700 110px "Yu Mincho", "MS Mincho", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('酒', size / 4, size / 2);
      ctx.fillText('酒', (size * 3) / 4, size / 2);
    });
    const lanternMaterial = new THREE.MeshStandardMaterial({ map: paper, emissive: 0xffffff, emissiveMap: paper, emissiveIntensity: 0.8, roughness: 0.9 });
    const profile = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      profile.push(new THREE.Vector2(0.12 + Math.sin(t * Math.PI) * 0.22, t * 0.75));
    }
    const lanternGeometry = new THREE.LatheGeometry(profile, 32);
    for (const x of [-3.5, 3.5, -6.4, 6.4]) {
      const lantern = new THREE.Mesh(lanternGeometry, lanternMaterial);
      lantern.position.set(x, 2.75, 3.0);
      root.add(lantern);
      root.add(box(0.32, 0.06, 0.32, mat(0x111111), [x, 3.52, 3.0]), box(0.32, 0.06, 0.32, mat(0x111111), [x, 2.74, 3.0]));
      root.add(box(0.015, 0.5, 0.015, mat(0x111111), [x, 3.8, 3.0]));
    }

    root.add(menuBoard(level, [0, 2.9, LAYOUT.backWallZ + 0.18], { width: 3, height: 1.4 }));
    const title = createTextSprite('LANTERN NOODLE BAR', { fontSize: 80, color: '#fde68a', height: 0.45 });
    title.position.set(0, 4.0, LAYOUT.backWallZ + 0.4);
    root.add(title);

    place(root, 'lantern', [-6.2, LAYOUT.counterTopY, LAYOUT.frontRowZ + 0.2], { scale: 1.4 });
    place(root, 'lantern', [6.2, LAYOUT.counterTopY, LAYOUT.frontRowZ + 0.2], { scale: 1.4 });
    place(root, 'barrel', [-8.2, 0, 2.6], { scale: 1.1 });
    place(root, 'barrel', [-8.9, 0, 1.6], { rotation: 1, scale: 1.1 });
    place(root, 'barrel', [-8.5, 0.96, 2.1], { rotation: 2, scale: 1.1 });
    place(root, 'barrel', [8.4, 0, 2.4], { rotation: 0.4, scale: 1.1 });
    for (const x of [-6, 6]) place(root, 'woodStool', [x, 0, LAYOUT.customerZ], { rotation: x * 0.1 });

    // Street buildings with warm windows.
    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 ? 1 : -1;
      const height = 5 + (index % 3) * 2;
      root.add(box(5, height, 5, new THREE.MeshStandardMaterial({ color: 0x2a2320, emissive: 0xffffff, emissiveIntensity: 0.5, emissiveMap: windowsTexture(0x1a1412, 0xffb45a, index + 1) }), [side * (13 + (index % 4) * 6), height / 2, -9 - Math.floor(index / 2) * 5]));
    }

    return (dt, time) => {
      noren.forEach((strip, index) => {
        strip.rotation.x = -0.06 + Math.sin(time * 1.6 + index * 0.7) * 0.06;
      });
    };
  },

  cyber(root, level, cutaway) {
    const iron = pbr('corrugated_iron_02', [4, 2], 0x4b5563, { color: 0x6b7280, metalness: 0.6 });
    buildShell(root, {
      floor: pbr('rubber_tiles', [8, 4], 0x1f2937),
      counterBody: surfaces.darkSteel(),
      counterTop: physical(0x0b0b10, { roughness: 0.15, clearcoat: 1, metalness: 0.3 }),
      counterFront: iron,
      wall: iron,
    });

    // Wet asphalt: low roughness so neon and the skyline reflect in it.
    const asphalt = pbr('asphalt_02', [12, 12], 0x1f2937, { color: 0x4b5563, roughness: 0.35, metalness: 0.2 });
    root.add(groundPatch(asphalt, 28));

    for (const side of [-1, 1]) root.add(box(0.2, 4.2, 6.6, iron, [side * 7.2, 2.1, -1.1]));
    const roof = box(14.6, 0.25, 6.8, surfaces.darkSteel(), [0, 4.3, -1.2]);
    root.add(roof);
    cutaway.push(roof);

    const cyan = neon(0x00f0ff);
    const magenta = neon(0xff2bd6);
    const tube = (length, material, position, vertical = false) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 10), material);
      if (!vertical) mesh.rotation.z = Math.PI / 2;
      mesh.position.set(...position);
      root.add(mesh);
    };
    tube(14.6, magenta, [0, 4.15, 2.25]);
    tube(LAYOUT.counterLength + 0.2, cyan, [0, LAYOUT.counterTopY - 0.02, LAYOUT.frontRowZ + 0.63]);
    tube(4, cyan, [-7.05, 2, 1.95], true);
    tube(4, magenta, [7.05, 2, 1.95], true);
    tube(10, cyan, [0, 3.9, LAYOUT.backWallZ + 0.2]);

    const sign = createTextSprite('NEON DINER', { fontSize: 90, color: '#ff4fe0', height: 0.7 });
    sign.position.set(0, 3.3, LAYOUT.backWallZ + 0.4);
    root.add(sign);
    root.add(menuBoard(level, [0, 2.1, LAYOUT.backWallZ + 0.18], { width: 3, height: 1.1 }));

    place(root, 'utilityBox', [-8.2, 0, 1.2], { rotation: Math.PI / 2 });
    place(root, 'utilityBox', [8.3, 0, -0.5], { rotation: -Math.PI / 2 });
    place(root, 'barrier', [-9.5, 0, 6], { rotation: 0.3 });
    place(root, 'wetFloorSign', [3.2, 0, 4.6], { rotation: 0.6, scale: 1.3 });
    place(root, 'trashCan', [-8.4, 0, 4], { rotation: 0.8 });
    for (const x of [-6.2, 6.2]) place(root, 'metalStool', [x, 0, LAYOUT.customerZ]);
    place(root, 'wallLamp', [-7.35, 2.6, 0.5], { rotation: -Math.PI / 2, scale: 1.2 });
    place(root, 'wallLamp', [7.35, 2.6, 0.5], { rotation: Math.PI / 2, scale: 1.2 });

    // Real apartment buildings, shops, signs and cables around the street.
    const street = buildNeonStreet(root);

    return (dt, time) => {
      sign.material.opacity = Math.sin(time * 31) > 0.93 ? 0.35 : 0.9 + Math.sin(time * 3) * 0.1;
      street?.(dt, time);
    };
  },
};

// Builds the whole level world. Stations are built here (visuals only); gameplay
// logic attaches to them in gameplay/Gameplay.js.
export function buildEnvironment(level) {
  const theme = THEMES[level.theme];
  const root = new THREE.Group();
  root.name = `level-${level.id}`;

  if (!assets.hdri(level.theme)) {
    root.add(createSky(theme.sky));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat(0x6b7280, { roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);
  }

  const cutaway = []; // roof pieces hidden by the top-down camera
  const animate = DECOR[level.theme](root, level, cutaway);
  const customerSlots = buildCustomerSlots(root, level.customerSlots);

  const stations = level.stations.map((config) => {
    const view = buildStationView(config, theme.palette);
    root.add(view.root);
    return { config, view };
  });

  return { root, theme, stations, customerSlots, animate, cutaway };
}
