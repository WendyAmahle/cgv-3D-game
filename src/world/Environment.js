import * as THREE from 'three';
import { LAYOUT } from '../utils/Constants.js';
import { checkerTexture, gridTexture, mat, stripeTexture, windowsTexture, woodTexture } from '../graphics/Materials.js';
import { createSky } from './Sky.js';
import { buildStationView } from './Stations.js';
import { createTextSprite } from './Models.js';

// Per-level visual identity.
export const THEMES = {
  truck: {
    palette: {
      ground: 0x7cbf6a, floor: [0xe8e2d4, 0xd4ccba], counter: 0xcfd6de, counterTop: 0xeef2f6,
      wood: 0xb07a4a, wall: 0xf4efe6, accent: 0xe63946, machine: 0xe5e7eb,
    },
    sky: { top: 0x4a9dff, bottom: 0xdff1ff, glow: 0xfff2c4, stars: 0 },
    fog: { color: 0xcfe6ff, near: 30, far: 90 },
  },
  izakaya: {
    palette: {
      ground: 0x3a3a44, floor: [0x4a3322, 0x3e2a1c], counter: 0x5a3a24, counterTop: 0x8a5a36,
      wood: 0x7a4d2c, wall: 0x3b2618, accent: 0xc0392b, machine: 0x44403c,
    },
    sky: { top: 0x050818, bottom: 0x1a2240, glow: 0x3b2a5a, stars: 1 },
    fog: { color: 0x0e1224, near: 20, far: 60 },
  },
  cyber: {
    palette: {
      ground: 0x0b0c14, floor: [0x14151f, 0x1b1c2a], counter: 0x1b1d2b, counterTop: 0x2a2d40,
      wood: 0x33364a, wall: 0x12131d, accent: 0xff2bd6, machine: 0x2a2d40, neonA: 0x00f0ff, neonB: 0xff2bd6,
    },
    sky: { top: 0x05010f, bottom: 0x2a0b3d, glow: 0xff2bd6, stars: 0.3 },
    fog: { color: 0x1a0a2a, near: 16, far: 50 },
  },
};

function box(w, h, d, material, [x, y, z], { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function neon(color, intensity = 3) {
  const material = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });
  return material;
}

// Floor, counters and back wall shared by every level.
function buildShell(root, palette) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat(palette.ground, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14.4, 6.2),
    mat(0xffffff, { map: checkerTexture(palette.floor[0], palette.floor[1], [14, 6]), roughness: 0.6 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, -1.3);
  floor.receiveShadow = true;
  root.add(floor);

  const bodyHeight = LAYOUT.counterTopY - 0.06;
  for (const z of [LAYOUT.frontRowZ, LAYOUT.backRowZ]) {
    root.add(box(LAYOUT.counterLength, bodyHeight, 1.1, mat(palette.counter, { roughness: 0.6, metalness: 0.3 }), [0, bodyHeight / 2, z]));
    root.add(box(LAYOUT.counterLength + 0.3, 0.06, 1.25, mat(palette.counterTop, { roughness: 0.3, metalness: 0.2 }), [0, LAYOUT.counterTopY - 0.03, z]));
  }
  root.add(box(LAYOUT.counterLength, 0.16, 0.02, mat(palette.accent), [0, 0.85, LAYOUT.frontRowZ + 0.56]));

  root.add(box(15, 5, 0.3, mat(palette.wall, { roughness: 0.9 }), [0, 2.5, LAYOUT.backWallZ]));
}

function sideWalls(root, material, height = 4.2) {
  for (const side of [-1, 1]) {
    root.add(box(0.2, height, 6.4, material, [side * 7.2, height / 2, -1.2]));
  }
}

function buildCustomerSlots(root, count, palette) {
  const spacing = count <= 2 ? 3.6 : count === 3 ? 3.2 : 2.8;
  return Array.from({ length: count }, (_, index) => {
    const x = (index - (count - 1) / 2) * spacing;
    const slotRoot = new THREE.Group();
    slotRoot.position.set(x, 0, LAYOUT.customerZ);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.03, 32), mat(palette.accent, { roughness: 0.6 }));
    pad.position.y = 0.015;
    pad.receiveShadow = true;
    slotRoot.add(pad);
    const focus = new THREE.Object3D();
    slotRoot.add(focus);
    root.add(slotRoot);
    return { root: slotRoot, focus, position: slotRoot.position };
  });
}

// ------------------------------------------------------------------ decor

function tree(x, z, scale = 1) {
  const result = new THREE.Group();
  const trunk = box(0.3, 1.6, 0.3, mat(0x6b4423), [0, 0.8, 0]);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), mat(0x4f9d4a, { flatShading: true }));
  leaves.position.y = 2.2;
  leaves.castShadow = true;
  result.add(trunk, leaves);
  result.position.set(x, 0, z);
  result.scale.setScalar(scale);
  return result;
}

const DECOR = {
  truck(root, palette, cutaway) {
    const body = mat(0xffffff, { map: stripeTexture(palette.accent, 0xf8fafc, 2, [1, 1]) });
    sideWalls(root, body, 4.8);
    const roof = box(14.6, 0.25, 6.8, mat(palette.accent), [0, 4.9, -1.2]);
    const awning = box(14.6, 0.06, 1.6, mat(0xffffff, { map: stripeTexture(palette.accent, 0xfff7ed, 16) }), [0, 4.75, 2.9]);
    awning.rotation.x = -0.12;
    root.add(roof, awning);
    cutaway.push(roof, awning);

    const tyre = mat(0x111111, { roughness: 0.9 });
    for (const side of [-1, 1]) {
      for (const z of [-3.2, 0.8]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 24), tyre);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 7.4, 0.55, z);
        wheel.castShadow = true;
        root.add(wheel);
      }
    }

    root.add(box(5, 1.3, 0.1, mat(0x1d2430), [0, 3.2, LAYOUT.backWallZ + 0.2]));
    const title = createTextSprite('BISTRO RUSH', { fontSize: 90, color: '#fbbf24', height: 0.6 });
    title.position.set(0, 3.35, LAYOUT.backWallZ + 0.35);
    const subtitle = createTextSprite('BURGER TRUCK', { fontSize: 50, color: '#f8fafc', height: 0.3 });
    subtitle.position.set(0, 2.85, LAYOUT.backWallZ + 0.35);
    root.add(title, subtitle);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(20, 9), mat(0xd6cfbf, { roughness: 0.95 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.005, 6.5);
    path.receiveShadow = true;
    root.add(path);

    [[-12, -6, 1.2], [-15, 4, 1], [13, -5, 1.3], [16, 6, 0.9], [-20, 12, 1.4], [21, -12, 1.5], [-9, 14, 1]].forEach(
      ([x, z, s]) => root.add(tree(x, z, s))
    );

    const tableWood = mat(0xffffff, { map: woodTexture(0x9c6b3f) });
    for (const x of [-6, 6]) {
      root.add(box(2.2, 0.08, 0.9, tableWood, [x, 0.75, 8.5]));
      root.add(box(2.2, 0.06, 0.3, tableWood, [x, 0.45, 7.8]));
      root.add(box(2.2, 0.06, 0.3, tableWood, [x, 0.45, 9.2]));
      root.add(box(0.1, 0.75, 0.8, tableWood, [x - 0.9, 0.37, 8.5]));
      root.add(box(0.1, 0.75, 0.8, tableWood, [x + 0.9, 0.37, 8.5]));
    }
    return null;
  },

  izakaya(root, palette, cutaway) {
    const wood = mat(0xffffff, { map: woodTexture(palette.wood) });
    sideWalls(root, wood);
    const roof = box(15.6, 0.3, 7.6, mat(0x1c1917, { roughness: 0.8 }), [0, 4.35, -1.0]);
    const eave = box(15.6, 0.25, 0.5, mat(0x292524), [0, 4.1, 2.7]);
    root.add(roof, eave);
    cutaway.push(roof, eave);

    // Noren curtain strips that sway.
    const noren = [];
    const cloth = new THREE.MeshStandardMaterial({ color: palette.accent, side: THREE.DoubleSide, roughness: 0.9 });
    for (let index = 0; index < 7; index += 1) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), cloth);
      strip.geometry.translate(0, -0.45, 0);
      strip.position.set(-5.7 + index * 1.9, 3.95, 2.6);
      strip.castShadow = true;
      root.add(strip);
      noren.push(strip);
      cutaway.push(strip);
    }

    // Paper lanterns (the night preset puts point lights next to them).
    for (const x of [-3.5, 3.5, -6.5, 6.5]) {
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 20, 14),
        new THREE.MeshStandardMaterial({ color: 0xff5a36, emissive: 0xff5a1f, emissiveIntensity: 1.8 })
      );
      lantern.scale.y = 1.3;
      lantern.position.set(x, 3.2, 2.9);
      root.add(lantern);
      root.add(box(0.02, 0.4, 0.02, mat(0x111111), [x, 3.75, 2.9]));
    }

    root.add(box(4.2, 1.2, 0.1, mat(0x111111), [0, 3.1, LAYOUT.backWallZ + 0.2]));
    const title = createTextSprite('居酒屋 RAMEN', { fontSize: 80, color: '#fde68a', height: 0.55 });
    title.position.set(0, 3.2, LAYOUT.backWallZ + 0.35);
    root.add(title);

    // Street buildings with warm windows.
    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 ? 1 : -1;
      const height = 5 + (index % 3) * 2;
      const building = box(
        5,
        height,
        5,
        new THREE.MeshStandardMaterial({ color: 0x2a2320, emissive: 0xffffff, emissiveIntensity: 0.5, emissiveMap: windowsTexture(0x1a1412, 0xffb45a, index + 1) }),
        [side * (12 + (index % 4) * 6), height / 2, -8 - Math.floor(index / 2) * 5]
      );
      root.add(building);
    }

    return (dt, time) => {
      noren.forEach((strip, index) => {
        strip.rotation.x = -0.08 + Math.sin(time * 1.6 + index * 0.7) * 0.07;
      });
    };
  },

  cyber(root, palette, cutaway) {
    const metal = mat(palette.wall, { metalness: 0.7, roughness: 0.4 });
    sideWalls(root, metal);
    const roof = box(14.6, 0.25, 6.8, metal, [0, 4.3, -1.2]);
    root.add(roof);
    cutaway.push(roof);

    const cyan = neon(palette.neonA);
    const magenta = neon(palette.neonB);
    root.add(box(14.6, 0.06, 0.06, magenta, [0, 4.15, 2.2], { cast: false }));
    root.add(box(LAYOUT.counterLength + 0.3, 0.04, 0.04, cyan, [0, LAYOUT.counterTopY, LAYOUT.frontRowZ + 0.64], { cast: false }));
    for (const side of [-1, 1]) {
      root.add(box(0.06, 4, 0.06, side < 0 ? cyan : magenta, [side * 7.05, 2, 1.95], { cast: false }));
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: gridTexture(0x0b0c14, 0x00f0ff, [30, 20]), roughness: 0.25, metalness: 0.6 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.004, 10);
    ground.receiveShadow = true;
    root.add(ground);

    const sign = createTextSprite('NEON DINER', { fontSize: 90, color: '#ff4fe0', height: 0.7 });
    sign.position.set(0, 3.3, LAYOUT.backWallZ + 0.35);
    root.add(sign);

    // Skyline.
    for (let index = 0; index < 18; index += 1) {
      const height = 12 + ((index * 7) % 5) * 7;
      const tint = index % 2 ? 0xff2bd6 : 0x00f0ff;
      const building = box(
        6,
        height,
        6,
        new THREE.MeshStandardMaterial({ color: 0x0b0b12, emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: windowsTexture(0x06060a, tint, index + 7) }),
        [-45 + index * 5.5, height / 2, -22 - (index % 3) * 8],
        { cast: false, receive: false }
      );
      root.add(building);
    }

    return (dt, time) => {
      sign.material.opacity = Math.sin(time * 31) > 0.93 ? 0.35 : 0.9 + Math.sin(time * 3) * 0.1;
    };
  },
};

// Builds the whole level world. Stations are built here (visuals only); gameplay
// logic attaches to them in gameplay/Gameplay.js.
export function buildEnvironment(level) {
  const theme = THEMES[level.theme];
  const root = new THREE.Group();
  root.name = `level-${level.id}`;

  root.add(createSky(theme.sky));
  buildShell(root, theme.palette);
  const cutaway = []; // roof pieces hidden by the top-down camera
  const animate = DECOR[level.theme](root, theme.palette, cutaway);
  const customerSlots = buildCustomerSlots(root, level.customerSlots, theme.palette);

  const stations = level.stations.map((config) => {
    const view = buildStationView(config, theme.palette);
    root.add(view.root);
    return { config, view };
  });

  return { root, theme, stations, customerSlots, animate, cutaway };
}
