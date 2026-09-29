import * as THREE from 'three';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { sharedUniforms } from '../graphics/Shaders.js';
import { assets } from '../utils/AssetLoader.js';

// Lighting per level. The level's HDRI photo is used for image-based lighting
// (reflections, soft ambient light) and projected onto the ground around the
// scene as the backdrop; a key light adds sharp shadows and point lights add
// local colour. Also feeds the custom shaders via sharedUniforms.
const PRESETS = {
  day: {
    environmentIntensity: 1.0,
    hemisphere: [0xeaf4ff, 0x6b8f5a, 0.25],
    key: { color: 0xfff1d6, intensity: 2.8, position: [8, 12, 7] },
    points: [],
    shaderAmbient: 0.55,
  },
  night: {
    environmentIntensity: 0.4,
    hemisphere: [0x8090c0, 0x3a2a30, 0.25],
    key: { color: 0x9fb4ff, intensity: 0.5, position: [-6, 10, 6] },
    points: [
      { color: 0xffa347, intensity: 5, distance: 9, position: [-3.5, 2.9, 3.3] },
      { color: 0xffa347, intensity: 5, distance: 9, position: [3.5, 2.9, 3.3] },
      { color: 0xffd8a0, intensity: 4, distance: 8, position: [0, 3.2, 0.1] },
      { color: 0xffd8a0, intensity: 2.5, distance: 7, position: [-4.5, 3.2, 0.1] },
      { color: 0xffd8a0, intensity: 2.5, distance: 7, position: [4.5, 3.2, 0.1] },
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

  if (hdri) {
    scene.environment = hdri;
    scene.environmentIntensity = preset.environmentIntensity;
    scene.background = null;
    scene.fog = null;
    const skybox = new GroundedSkybox(hdri, theme.skybox.height, theme.skybox.radius);
    skybox.position.y = theme.skybox.height - 0.01;
    skybox.material.fog = false;
    root.add(skybox);
  } else {
    scene.environment = null;
    scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
    scene.background = new THREE.Color(theme.fog.color);
  }

  root.add(new THREE.HemisphereLight(sky, ground, hdri ? hemiIntensity : hemiIntensity * 3));

  const key = new THREE.DirectionalLight(preset.key.color, preset.key.intensity);
  key.position.set(...preset.key.position);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
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

  sharedUniforms.uLightDir.value.set(...preset.key.position).normalize();
  sharedUniforms.uLightColor.value.set(preset.key.color).multiplyScalar(Math.min(1.2, preset.key.intensity * 0.5 + 0.3));
  sharedUniforms.uAmbient.value.set(sky).multiplyScalar(preset.shaderAmbient);

  return {
    update(dt, time) {
      for (const { light, base } of flickering) {
        const glitch = Math.sin(time * 23) > 0.96 || Math.sin(time * 7.3) > 0.985;
        light.intensity = glitch ? base * 0.2 : base;
      }
    },
  };
}
