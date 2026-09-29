// In-game credits. The brief requires EVERY external library, asset and resource
// to be listed here with where it came from and its licence. Add an entry
// whenever you bring something in (models, textures, sounds, fonts, code samples).
const polyHaven = (name, author, id, use) => ({
  name,
  author,
  source: `https://polyhaven.com/a/${id}`,
  license: 'CC0 (Poly Haven)',
  use,
});

export const CREDITS = [
  {
    name: 'three.js',
    author: 'three.js authors',
    source: 'https://threejs.org',
    license: 'MIT',
    use: 'WebGL rendering; addons: GLTFLoader, HDRLoader, SkeletonUtils, BufferGeometryUtils, GroundedSkybox, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass.',
  },
  {
    name: 'Vite',
    author: 'Evan You & Vite contributors',
    source: 'https://vite.dev',
    license: 'MIT',
    use: 'Development server and production build.',
  },
  {
    name: 'Michelle and X Bot characters + animations',
    author: 'Mixamo (Adobe), via the three.js examples',
    source: 'https://www.mixamo.com',
    license: 'Mixamo terms: free to use in projects',
    use: 'Michelle: customer body. X Bot: the idle / walk / nod / head-shake animations used by every customer.',
  },
  {
    name: 'Avatar character',
    author: 'Ready Player Me, via the three.js examples (readyplayer.me.glb)',
    source: 'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf',
    license: 'Ready Player Me terms (non-commercial academic use)',
    use: 'Recoloured customer bodies.',
  },
  polyHaven('Hamburger Buns', 'Alexander Shulha', 'hamburger_buns', '3D model'),
  polyHaven('Wooden Crate 02', 'James Ray Cock & Jurita Burger', 'wooden_crate_02', '3D model'),
  polyHaven('Wooden Cutting Board', 'Kuutti Siitonen', 'wooden_cutting_board', '3D model'),
  polyHaven('Cash Register 01', 'Joe Seabuhr', 'CashRegister_01', '3D model'),
  polyHaven('Metal Trash Can', 'GurJas Studios', 'metal_trash_can', '3D model'),
  polyHaven('Wooden Picnic Table', 'Ulan Cabanilla', 'wooden_picnic_table', '3D model'),
  polyHaven('Street Lamp 01', 'Josh Dean', 'street_lamp_01', '3D model'),
  polyHaven('Shrub 02', 'Rico Cilliers', 'shrub_02', '3D model'),
  polyHaven('Potted Plant 02', 'Rico Cilliers', 'potted_plant_02', '3D model'),
  polyHaven('Wooden Lantern 01', 'James Ray Cock', 'wooden_lantern_01', '3D model'),
  polyHaven('Chinese Stool', 'Kirill Sannikov', 'chinese_stool', '3D model'),
  polyHaven('Wine Barrel 01', 'James Ray Cock', 'wine_barrel_01', '3D model'),
  polyHaven('Utility Box 02', 'James Ray Cock', 'utility_box_02', '3D model'),
  polyHaven('Street Lamp 02', 'Josh Dean', 'street_lamp_02', '3D model'),
  polyHaven('Concrete Road Barrier', 'Amal Kumar', 'concrete_road_barrier', '3D model'),
  polyHaven('Metal Stool 01', 'Ulan Cabanilla', 'metal_stool_01', '3D model'),
  polyHaven('Wet Floor Sign 01', 'Fran Calvente', 'WetFloorSign_01', '3D model'),
  polyHaven('Modular Urban Apartments Facade', 'James Ray Cock', 'modular_urban_apartments_facade', '3D model (Level 3 street buildings)'),
  polyHaven('Exterior Aircon Unit', 'Monsta3D', 'exterior_aircon_unit', '3D model'),
  polyHaven('Leafy Grass', 'Charlotte Baglioni', 'leafy_grass', 'PBR texture'),
  polyHaven('Patterned Paving', 'Charlotte Baglioni', 'patterned_paving', 'PBR texture'),
  polyHaven('Long White Tiles', 'Jenelle van Heerden & Sergej Majboroda', 'long_white_tiles', 'PBR texture'),
  polyHaven('Metal Plate', 'Rob Tuytel', 'metal_plate', 'PBR texture'),
  polyHaven('Japanese Cedar Planks', 'Charlotte Baglioni & Rico Cilliers', 'japanese_cedar_planks', 'PBR texture'),
  polyHaven('Cobblestone Pavement', 'Charlotte Baglioni', 'cobblestone_pavement', 'PBR texture'),
  polyHaven('Dark Wooden Planks', 'Amal Kumar', 'dark_wooden_planks', 'PBR texture'),
  polyHaven('Wood Table', 'Dimitrios Savva', 'wood_table', 'PBR texture'),
  polyHaven('Asphalt 02', 'Rob Tuytel', 'asphalt_02', 'PBR texture'),
  polyHaven('Corrugated Iron 02', 'Jenelle van Heerden & Sergej Majboroda', 'corrugated_iron_02', 'PBR texture'),
  polyHaven('Rubber Tiles', 'Amal Kumar', 'rubber_tiles', 'PBR texture'),
  polyHaven('Greenwich Park', 'Andreas Mischok', 'greenwich_park', 'HDRI sky and lighting'),
  polyHaven('Cobblestone Street Night', 'Greg Zaal & Jenelle van Heerden', 'cobblestone_street_night', 'HDRI sky and lighting'),
  polyHaven('Shanghai Bund', 'Greg Zaal', 'shanghai_bund', 'HDRI sky and lighting'),
];

export const TEAM = [
  { member: 'Member 1', role: 'Core gameplay & interaction' },
  { member: 'Member 2', role: '3D world, models & cameras' },
  { member: 'Member 3', role: 'Shaders & visual effects' },
  { member: 'Member 4', role: 'UI, levels, audio & assets' },
];

export const ORIGINAL_WORK = [
  'Food, stations, food truck, noodle bar and diner buildings are modelled procedurally by the team (the scanned bun is sliced in code).',
  'Animation retargeting from X Bot onto the other skeletons is our own code.',
  'All sound effects and music are synthesised at runtime with the Web Audio API.',
  'Custom GLSL shaders: cooking (injected into the PBR material), liquid fill, steam, particles, sky and colour-grade/heat-haze.',
];

export class Credits {
  render() {
    const container = document.querySelector('#creditsList');
    const section = (title, items) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'credits-section';
      const heading = document.createElement('h3');
      heading.textContent = title;
      wrapper.append(heading, ...items);
      return wrapper;
    };
    const line = (html) => {
      const element = document.createElement('p');
      element.innerHTML = html;
      return element;
    };
    const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

    container.replaceChildren(
      section('Team', TEAM.map(({ member, role }) => line(`<strong>${escape(member)}</strong>: ${escape(role)}`))),
      section('Original work', ORIGINAL_WORK.map((text) => line(escape(text)))),
      section(
        'Third-party libraries & assets',
        CREDITS.map((credit) =>
          line(
            `<strong>${escape(credit.name)}</strong> by ${escape(credit.author)} · ${escape(credit.license)} · ` +
              `<a href="${escape(credit.source)}" target="_blank" rel="noopener">${escape(credit.source)}</a><br>` +
              `<span class="muted">${escape(credit.use)}</span>`
          )
        )
      )
    );
  }
}
