import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// External assets live in public/assets/ (fetched by scripts/fetch-assets.mjs).
// They are grouped so each level only downloads what it needs. If anything
// fails to load, the game falls back to procedural models/materials.
const BASE = 'assets/';

const GROUPS = {
  shared: {
    models: {
      buns: 'hamburger_buns',
      crate: 'wooden_crate_02',
      cuttingBoard: 'wooden_cutting_board',
      register: 'CashRegister_01',
      trashCan: 'metal_trash_can',
    },
    characters: { avatar: 'Avatar.glb', michelle: 'Michelle.glb', xbot: 'Xbot.glb' },
  },
  truck: {
    hdri: 'greenwich_park',
    models: { picnicTable: 'wooden_picnic_table', streetLamp: 'street_lamp_01', shrub: 'shrub_02', pottedPlant: 'potted_plant_02' },
    textures: ['leafy_grass', 'patterned_paving', 'long_white_tiles', 'metal_plate'],
  },
  izakaya: {
    hdri: 'cobblestone_street_night',
    models: { lantern: 'wooden_lantern_01', woodStool: 'chinese_stool', barrel: 'wine_barrel_01' },
    textures: ['japanese_cedar_planks', 'cobblestone_pavement', 'dark_wooden_planks', 'wood_table'],
  },
  cyber: {
    hdri: 'shanghai_bund',
    models: {
      utilityBox: 'utility_box_02',
      wallLamp: 'street_lamp_02',
      barrier: 'concrete_road_barrier',
      metalStool: 'metal_stool_01',
      wetFloorSign: 'WetFloorSign_01',
      facadeKit: 'modular_urban_apartments_facade',
      aircon: 'exterior_aircon_unit',
    },
    textures: ['asphalt_02', 'corrugated_iron_02', 'rubber_tiles'],
  },
};

function markShared(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.userData.shared = true;
    for (const material of [].concat(object.material ?? [])) {
      material.userData.shared = true;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.userData.shared = true;
      }
    }
  });
}

class AssetLibrary {
  constructor() {
    this.gltfs = new Map();
    this.textures = new Map();
    this.hdris = new Map();
    this.loaded = new Set();
    this.pending = new Map();
    this.gltfLoader = new GLTFLoader();
    this.hdrLoader = new HDRLoader();
    this.textureLoader = new THREE.TextureLoader();
  }

  isLoaded(group) {
    return this.loaded.has(group) || !GROUPS[group];
  }

  // Loads a group once; onProgress(0..1). Failed files are skipped with a warning.
  load(group, onProgress = () => {}) {
    if (this.isLoaded(group)) return Promise.resolve();
    if (!this.pending.has(group)) this.pending.set(group, this.loadGroup(group, onProgress));
    return this.pending.get(group);
  }

  async loadGroup(group, onProgress) {
    const spec = GROUPS[group];
    const jobs = [];

    for (const [key, id] of Object.entries(spec.models ?? {})) {
      jobs.push(() => this.loadGltf(key, `${BASE}models/${id}/${id}_1k.gltf`));
    }
    for (const [key, file] of Object.entries(spec.characters ?? {})) {
      jobs.push(() => this.loadGltf(key, `${BASE}characters/${file}`));
    }
    for (const id of spec.textures ?? []) {
      for (const map of ['diff', 'nor', 'rough']) {
        jobs.push(async () => {
          const texture = await this.textureLoader.loadAsync(`${BASE}textures/${id}/${map}.jpg`);
          texture.colorSpace = map === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = 8;
          this.textures.set(`${id}/${map}`, texture);
        });
      }
    }
    if (spec.hdri) {
      jobs.push(async () => {
        const texture = await this.hdrLoader.loadAsync(`${BASE}hdri/${spec.hdri}_2k.hdr`);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.userData.shared = true;
        this.hdris.set(group, texture);
      });
    }

    let done = 0;
    onProgress(0);
    await Promise.all(
      jobs.map((job) =>
        job()
          .catch((error) => console.warn('[assets] failed to load:', error?.message ?? error))
          .finally(() => onProgress(++done / jobs.length))
      )
    );
    this.loaded.add(group);
  }

  async loadGltf(key, url) {
    const gltf = await this.gltfLoader.loadAsync(url);
    markShared(gltf.scene);
    this.gltfs.set(key, gltf);
  }

  has(key) {
    return this.gltfs.has(key);
  }

  // A fresh copy of a model (skinned meshes get their own skeleton), or null.
  model(key) {
    const gltf = this.gltfs.get(key);
    if (!gltf) return null;
    const copy = cloneSkinned(gltf.scene);
    copy.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return copy;
  }

  animations(key) {
    return this.gltfs.get(key)?.animations ?? [];
  }

  // The original (shared) mesh with this node name inside a model, or null.
  node(key, name) {
    return this.gltfs.get(key)?.scene.getObjectByName(name) ?? null;
  }

  // PBR texture set { map, normalMap, roughnessMap } with its own repeat, or {}.
  pbr(id, repeat = [1, 1]) {
    const result = {};
    for (const [slot, map] of [['map', 'diff'], ['normalMap', 'nor'], ['roughnessMap', 'rough']]) {
      const texture = this.textures.get(`${id}/${map}`);
      if (!texture) continue;
      const copy = texture.clone();
      copy.repeat.set(...repeat);
      copy.userData.shared = true;
      result[slot] = copy;
    }
    return result;
  }

  hdri(group) {
    return this.hdris.get(group) ?? null;
  }
}

export const assets = new AssetLibrary();
