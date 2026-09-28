import * as THREE from 'three';
import { sharedUniforms } from '../graphics/Shaders.js';

// Lighting presets per level. Also feeds the custom shaders (which do their own
// simple lighting) via sharedUniforms so food matches the scene.
const PRESETS = {
  day: {
    hemisphere: [0xeaf4ff, 0x6b8f5a, 1.1],
    key: { color: 0xfff1d6, intensity: 2.6, position: [6, 12, 8] },
    points: [],
    shaderAmbient: 0.55,
  },
  night: {
    hemisphere: [0x8090c0, 0x3a2a30, 0.9],
    key: { color: 0x9fb4ff, intensity: 0.8, position: [-6, 10, 6] },
    points: [
      { color: 0xffa347, intensity: 30, distance: 14, position: [-3.5, 3.0, 2.6] },
      { color: 0xffa347, intensity: 30, distance: 14, position: [3.5, 3.0, 2.6] },
      { color: 0xffd8a0, intensity: 16, distance: 12, position: [0, 3.6, 0] },
    ],
    shaderAmbient: 0.6,
  },
  neon: {
    hemisphere: [0x6a5aa0, 0x140a24, 0.9],
    key: { color: 0xb18cff, intensity: 1.0, position: [4, 10, 6] },
    points: [
      { color: 0x00f0ff, intensity: 35, distance: 14, position: [-5, 3, 2.5], flicker: false },
      { color: 0xff2bd6, intensity: 35, distance: 14, position: [5, 3, 2.5], flicker: true },
      { color: 0xdfe6ff, intensity: 18, distance: 12, position: [0, 3.6, 0] },
    ],
    shaderAmbient: 0.55,
  },
};

export function applyLighting(presetName, scene, root, theme) {
  const preset = PRESETS[presetName];
  const [sky, ground, hemiIntensity] = preset.hemisphere;
  root.add(new THREE.HemisphereLight(sky, ground, hemiIntensity));

  const key = new THREE.DirectionalLight(preset.key.color, preset.key.intensity);
  key.position.set(...preset.key.position);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11;
  key.shadow.camera.right = 11;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -11;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  root.add(key);

  const flickering = [];
  for (const config of preset.points) {
    const light = new THREE.PointLight(config.color, config.intensity, config.distance, 2);
    light.position.set(...config.position);
    root.add(light);
    if (config.flicker) flickering.push({ light, base: config.intensity });
  }

  scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
  scene.background = new THREE.Color(theme.fog.color);

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
