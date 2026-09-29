// Downloads the external assets the game uses into public/assets/.
// The files are committed, so you only need this to re-fetch or add assets:
//   node scripts/fetch-assets.mjs
// Every asset here must also be listed in src/ui/Credits.js.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../public/assets');

// Poly Haven (CC0) — https://polyhaven.com
const MODELS = [
  'hamburger_buns', 'wooden_crate_02', 'wooden_cutting_board', 'CashRegister_01',
  'wooden_picnic_table', 'street_lamp_01', 'metal_trash_can', 'shrub_02', 'potted_plant_02',
  'wooden_lantern_01', 'chinese_stool', 'wine_barrel_01',
  'utility_box_02', 'street_lamp_02', 'concrete_road_barrier', 'metal_stool_01', 'WetFloorSign_01',
];
const TEXTURES = [
  'leafy_grass', 'patterned_paving', 'long_white_tiles', 'metal_plate',
  'japanese_cedar_planks', 'cobblestone_pavement', 'dark_wooden_planks', 'wood_table',
  'asphalt_02', 'corrugated_iron_02', 'rubber_tiles',
];
const HDRIS = ['greenwich_park', 'cobblestone_street_night', 'shanghai_bund'];

// three.js example models (Mixamo / Ready Player Me characters).
const THREE_EXAMPLES = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf';
const CHARACTERS = { 'Michelle.glb': 'Michelle.glb', 'Xbot.glb': 'Xbot.glb', 'Avatar.glb': 'readyplayer.me.glb' };

async function download(url, file) {
  if (existsSync(file)) return;
  mkdirSync(path.dirname(file), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  console.log('  ', path.relative(ROOT, file));
}

const files = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json();

for (const id of MODELS) {
  const gltf = (await files(id)).gltf['1k'].gltf;
  const dir = path.join(ROOT, 'models', id);
  await download(gltf.url, path.join(dir, path.basename(gltf.url)));
  for (const [relative, include] of Object.entries(gltf.include ?? {})) {
    await download(include.url, path.join(dir, relative));
  }
}

for (const id of TEXTURES) {
  const set = await files(id);
  const pick = (...keys) => keys.map((key) => set[key]?.['1k']?.jpg?.url).find(Boolean);
  const maps = { diff: pick('Diffuse', 'diff'), nor: pick('nor_gl'), rough: pick('Rough', 'rough') };
  for (const [name, url] of Object.entries(maps)) {
    if (url) await download(url, path.join(ROOT, 'textures', id, `${name}.jpg`));
  }
}

for (const id of HDRIS) {
  const url = (await files(id)).hdri['2k'].hdr.url;
  await download(url, path.join(ROOT, 'hdri', `${id}_2k.hdr`));
}

for (const [name, source] of Object.entries(CHARACTERS)) {
  await download(`${THREE_EXAMPLES}/${source}`, path.join(ROOT, 'characters', name));
}

console.log('done');
