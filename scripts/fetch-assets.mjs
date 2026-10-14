// Downloads the external assets the game uses into public/assets/.
// The files are committed, so you only need this to re-fetch or add assets:
//   node scripts/fetch-assets.mjs
// Every asset here must also be listed in src/ui/Credits.js.
//
// Not fetched by this script (Sketchfab needs a logged-in account to
// download): public/assets/models/food_truck/ — "Food Truck" by sandrafaki,
// CC BY 4.0, https://sketchfab.com/3d-models/food-truck-9a179f9803734a3e95630727b9db3477
// (glTF download, textures resized to 1024px with @gltf-transform/cli).
//
// Also not fetched here (they come as zip archives): in public/assets/audio/,
// ambience/rain.ogg is track 3 of "Rain (loopable)" by Ylmir (CC0,
// https://opengameart.org/content/rain-loopable), and the sfx/ files not in
// BIGSOUNDBANK below are from Kenney's CC0 packs (kenney.nl/assets/
// impact-sounds, interface-sounds, rpg-audio): step-concrete-N =
// footstep_concrete_00(N-1), step-wood-N = footstep_wood_00(N-1), place-N =
// impactPlate_light_00(N-1), bounce = impactGeneric_light_000, metal =
// impactMetal_light_001, click = click_002, error = error_006, pop = pluck_001,
// confirm = confirmation_002, pickup = handleSmallLeather, coins = handleCoins2.
// music/lofi-loop.ogg (main menu) is "Lofi Hip Hop Loop" by omfgdude (CC0,
// https://opengameart.org/sites/default/files/LofiLoop_2.ogg), saved as-is.
// music/japanese-modern-loop.ogg (Level 2) is "Japanese Modern Loop" by F_kaiba
// (CC BY 4.0, https://opengameart.org/content/japanese-modern-loop), the MP3
// re-encoded with `ffmpeg -i in.mp3 -map_metadata -1 -af volume=7dB -c:a libvorbis -q:a 3`.
// music/feel-good-island.ogg (Level 1) is "Feel Good Island Loop" by Brandon
// Morris, loop edit by AntumDeluge (CC0 / OGA-BY 3.0,
// https://opengameart.org/sites/default/files/feel_good_island_loop_0.ogg), saved as-is.
// music/bouncer.ogg (Level 3) is "Bouncer" by Of Far Different Nature (CC0,
// https://opengameart.org/content/bouncer-0), the MP3
// re-encoded with `ffmpeg -i in.mp3 -map_metadata -1 -c:a libvorbis -q:a 3`.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../public/assets');

// Poly Haven (CC0) â€” https://polyhaven.com
const MODELS = [
  'hamburger_buns', 'wooden_crate_02', 'wooden_cutting_board', 'CashRegister_01',
  'wooden_picnic_table', 'street_lamp_01', 'metal_trash_can', 'shrub_02', 'potted_plant_02',
  'wooden_lantern_01', 'chinese_stool', 'wine_barrel_01',
  'utility_box_02', 'street_lamp_02', 'concrete_road_barrier', 'metal_stool_01',
  'modular_urban_apartments_facade', 'exterior_aircon_unit',
  'standing_chalkboard_01', 'outdoor_table_chair_set_01', 'plastic_monobloc_chair_01', 'painted_wooden_bench', 'planter_box_01',
  'portable_generator', 'hand_truck', 'trashbag', 'water_manhole_cover', 'barrel_03',
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

// BigSoundBank (CC0) — https://bigsoundbank.com — file in audio/ -> sound number.
const BIGSOUNDBANK = {
  'sfx/grill-sizzle': '0144', 'sfx/fryer': '2506', 'sfx/pot-boil': '0491', 'sfx/pour-soda': '0117',
  'sfx/pour-broth': '1155', 'sfx/counter-bell': '2530', 'sfx/register-beep': '1417', 'sfx/timer-ding': '0082',
  'sfx/buzzer': '1586', 'sfx/alarm': '0035', 'sfx/trash': '1523', 'sfx/applause': '0812',
  'sfx/car-pass-1': '2987', 'sfx/car-pass-2': '2996', 'sfx/horn': '3506',
  'sfx/thunder-1': '3113', 'sfx/thunder-2': '3114', 'sfx/thunder-3': '3115',
  'ambience/park': '2457', 'ambience/night-insects': '0425', 'ambience/city-night': '0680',
};

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

for (const [name, id] of Object.entries(BIGSOUNDBANK)) {
  await download(`https://bigsoundbank.com/UPLOAD/ogg/${id}.ogg`, path.join(ROOT, 'audio', `${name}.ogg`));
}

console.log('done');
