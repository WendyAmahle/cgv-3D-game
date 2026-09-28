// In-game credits. The brief requires EVERY external library, asset and resource
// to be listed here with where it came from and its licence. Add an entry
// whenever you bring something in (models, textures, sounds, fonts, code samples).
export const CREDITS = [
  {
    name: 'three.js',
    author: 'three.js authors',
    source: 'https://threejs.org',
    license: 'MIT',
    use: 'WebGL rendering, plus EffectComposer, RenderPass, UnrealBloomPass, ShaderPass and OutputPass from three/addons.',
  },
  {
    name: 'Vite',
    author: 'Evan You & Vite contributors',
    source: 'https://vite.dev',
    license: 'MIT',
    use: 'Development server and production build.',
  },
];

export const TEAM = [
  { member: 'Member 1', role: 'Core gameplay & interaction' },
  { member: 'Member 2', role: '3D world, models & cameras' },
  { member: 'Member 3', role: 'Shaders & visual effects' },
  { member: 'Member 4', role: 'UI, levels, audio & assets' },
];

export const ORIGINAL_WORK = [
  'All 3D models are procedural, built from three.js primitives by the team.',
  'All sound effects and music are synthesised at runtime with the Web Audio API.',
  'Custom GLSL shaders: cooking, liquid fill, steam, particles, sky and colour-grade/heat-haze.',
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
