import * as THREE from 'three';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { sharedUniforms } from '../graphics/Shaders.js';
import { assets } from '../utils/AssetLoader.js';

// Lighting per level. The level's HDRI photo is used for image-based lighting
// (reflections, soft ambient light) and projected onto the ground around the
// scene as the backdrop; a key light adds sharp shadows and point lights add
// local colour. Also feeds the custom shaders via sharedUniforms.
const PRESETS = {
  // The HDRI already lights the scene with its photographed sun and sky, so
  // the hemisphere fill stays small and the key light moderate: with all
  // three high, sunlit white surfaces were lit roughly twice over and
  // clipped to featureless white.
  day: {
    environmentIntensity: 0.85,
    hemisphere: [0xdcefff, 0x7fae52, 0.12],
    key: { color: 0xffe9c2, intensity: 2.5, position: [8, 12, 7] },
    points: [],
    shaderAmbient: 0.6,
    // The park (shrubs out to x=12, picnic tables out to z=8.5) is wider
    // than the other levels' interiors, so the default shadow frustum
    // clipped/popped shadows at the edges.
    shadowExtent: 20,
    // Time of day moves with the shift: over its length the sun sinks from
    // midday toward late afternoon, warming and dimming slightly, so shadows
    // lengthen and the photographed sky takes on a golden tint.
    cycle: {
      key: { color: 0xffad66, intensity: 2.6, position: [10, 6.5, 8] },
      sky: 0xffc794,
      environmentIntensity: 0.68,
    },
  },
  // Level 2's Tokyo street: cool moonlight, red glow from the paper
  // lanterns, warm white work lights over the counters and pink/cyan neon
  // spilling in from the signs either side.
  night: {
    environmentIntensity: 0.35,
    hemisphere: [0x7080c0, 0x2a2434, 0.5],
    key: { color: 0xa8b8ff, intensity: 0.6, position: [-6, 10, 6] },
    points: [
      { color: 0xff4a2e, intensity: 4, distance: 7, position: [-3.5, 2.9, 3.3] },
      { color: 0xff4a2e, intensity: 4, distance: 7, position: [3.5, 2.9, 3.3] },
      { color: 0xfff0dc, intensity: 5, distance: 8, position: [0, 3.2, 0.1] },
      { color: 0xfff0dc, intensity: 3, distance: 7, position: [-4.5, 3.2, 0.1] },
      { color: 0xfff0dc, intensity: 3, distance: 7, position: [4.5, 3.2, 0.1] },
      { color: 0xff3d9a, intensity: 10, distance: 12, position: [-9.5, 3.2, 3.5] },
      { color: 0x38c8ff, intensity: 10, distance: 12, position: [9.5, 3.2, 3.5] },
    ],
    shaderAmbient: 0.6,
  },
  neon: {
    environmentIntensity: 0.35,
    hemisphere: [0x6a5aa0, 0x140a24, 0.3],
    key: { color: 0xb18cff, intensity: 0.7, position: [4, 10, 6] },
    points: [
      { color: 0x00f0ff, intensity: 16, distance: 12, position: [-5, 3, 2.5], flicker: false },
      { color: 0xff2bd6, intensity: 16, distance: 12, position: [5, 3, 2.5], flicker: true },
      { color: 0xdfe6ff, intensity: 8, distance: 10, position: [0, 3.6, -0.2] },
    ],
    shaderAmbient: 0.55,
  },
};

export function applyLighting(presetName, scene, root, theme, themeName) {
  const preset = PRESETS[presetName];
  const [sky, ground, hemiIntensity] = preset.hemisphere;
  const hdri = assets.hdri(themeName);
  let skybox = null;

  if (hdri) {
    scene.environment = hdri;
    scene.environmentIntensity = preset.environmentIntensity;
  } else {
    scene.environment = null;
  }
  if (hdri && theme.skybox) {
    scene.background = null;
    scene.fog = null;
    skybox = new GroundedSkybox(hdri, theme.skybox.height, theme.skybox.radius);
    skybox.position.y = theme.skybox.height - 0.01;
    skybox.material.fog = false;
    // Always drawn first: it doesn't write depth, so anything below its
    // photographed ground (Level 3's sunken road) still draws over it.
    skybox.renderOrder = -10;
    root.add(skybox);
  } else {
    // No photo backdrop: the level's own sky dome and fog (see Environment.js).
    scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
    scene.background = new THREE.Color(theme.fog.color);
  }

  root.add(new THREE.HemisphereLight(sky, ground, hdri ? hemiIntensity : hemiIntensity * 3));

  const key = new THREE.DirectionalLight(preset.key.color, preset.key.intensity);
  key.position.set(...preset.key.position);
  key.castShadow = true;
  const shadowExtent = preset.shadowExtent ?? 12;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -shadowExtent;
  key.shadow.camera.right = shadowExtent;
  key.shadow.camera.top = shadowExtent;
  key.shadow.camera.bottom = -shadowExtent;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  root.add(key);

  const flickering = [];
  for (const config of preset.points) {
    const light = new THREE.PointLight(config.color, config.intensity, config.distance, 2);
    light.position.set(...config.position);
    root.add(light);
    if (config.flicker) flickering.push({ light, base: config.intensity });
  }

  const setShaderLight = (direction, color, intensity) => {
    sharedUniforms.uLightDir.value.copy(direction).normalize();
    sharedUniforms.uLightColor.value.copy(color).multiplyScalar(Math.min(1.2, intensity * 0.5 + 0.3));
  };
  setShaderLight(key.position, key.color, key.intensity);
  sharedUniforms.uAmbient.value.set(sky).multiplyScalar(preset.shaderAmbient);

  // Start and end of the time-of-day cycle, interpolated by shift progress.
  const cycle = preset.cycle && {
    fromDirection: new THREE.Vector3(...preset.key.position),
    toDirection: new THREE.Vector3(...preset.cycle.key.position),
    distance: new THREE.Vector3(...preset.key.position).length(),
    fromColor: new THREE.Color(preset.key.color),
    toColor: new THREE.Color(preset.cycle.key.color),
    toSky: new THREE.Color(preset.cycle.sky),
    white: new THREE.Color(0xffffff),
    lastProgress: -1,
  };
  if (cycle) {
    cycle.fromDirection.normalize();
    cycle.toDirection.normalize();
  }

  return {
    // progress: 0 at the start of the shift, 1 at the end (0 on menus).
    update(dt, time, progress = 0) {
      for (const { light, base } of flickering) {
        const glitch = Math.sin(time * 23) > 0.96 || Math.sin(time * 7.3) > 0.985;
        light.intensity = glitch ? base * 0.2 : base;
      }
      if (cycle && Math.abs(progress - cycle.lastProgress) > 0.001) {
        cycle.lastProgress = progress;
        const t = THREE.MathUtils.smoothstep(progress, 0, 1);
        key.position.lerpVectors(cycle.fromDirection, cycle.toDirection, t).normalize().multiplyScalar(cycle.distance);
        key.color.lerpColors(cycle.fromColor, cycle.toColor, t);
        key.intensity = THREE.MathUtils.lerp(preset.key.intensity, preset.cycle.key.intensity, t);
        if (hdri) scene.environmentIntensity = THREE.MathUtils.lerp(preset.environmentIntensity, preset.cycle.environmentIntensity, t);
        skybox?.material.color.lerpColors(cycle.white, cycle.toSky, t);
        setShaderLight(key.position, key.color, key.intensity);
      }
    },
  };
}
