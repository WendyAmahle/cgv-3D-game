import * as THREE from 'three';
import cookingPars from './shaders/cooking_pars.glsl?raw';
import cookingVertex from './shaders/cooking.vert.glsl?raw';
import cookingFragment from './shaders/cooking.frag.glsl?raw';
import liquidVertex from './shaders/liquid.vert.glsl?raw';
import liquidFragment from './shaders/liquid.frag.glsl?raw';
import mixFragment from './shaders/mix.frag.glsl?raw';
import hologramVertex from './shaders/hologram.vert.glsl?raw';
import hologramFragment from './shaders/hologram.frag.glsl?raw';
import steamVertex from './shaders/steam.vert.glsl?raw';
import steamFragment from './shaders/steam.frag.glsl?raw';
import beamVertex from './shaders/beam.vert.glsl?raw';
import beamFragment from './shaders/beam.frag.glsl?raw';
import particleVertex from './shaders/particle.vert.glsl?raw';
import particleFragment from './shaders/particle.frag.glsl?raw';
import skyVertex from './shaders/sky.vert.glsl?raw';
import skyFragment from './shaders/sky.frag.glsl?raw';
import fullscreenVertex from './shaders/fullscreen.vert.glsl?raw';
import gradeFragment from './shaders/grade.frag.glsl?raw';
import noiseChunk from './shaders/noise.glsl?raw';
import boilVertex from './shaders/boil.vert.glsl?raw';
import boilFragment from './shaders/boil.frag.glsl?raw';
import plumeVertex from './shaders/plume.vert.glsl?raw';
import plumeFragment from './shaders/plume.frag.glsl?raw';

// Uniform objects shared by every custom material. Updating `.value` once per
// frame (time) or per level (lighting) updates all of them.
export const sharedUniforms = {
  uTime: { value: 0 },
  uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
  uLightColor: { value: new THREE.Color(1, 1, 1) },
  uAmbient: { value: new THREE.Color(0.4, 0.4, 0.45) },
  uPointScale: { value: 400 },
};

const { uTime, uLightDir, uLightColor, uAmbient, uPointScale } = sharedUniforms;

// Food that cooks: a MeshStandardMaterial with the cooking GLSL injected, so it
// keeps physically based lighting, shadows and HDRI reflections. Drive it with
// material.userData.uniforms.uCook (0 raw → 1 cooked → 2 burnt) and uHeat.
export function createCookingMaterial({ raw, cooked, burnt, marks = 0, roughness = [0.4, 0.7, 0.95], ...options }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, ...options });
  const uniforms = {
    uTime,
    uCook: { value: 0 },
    uHeat: { value: 0 },
    uMarks: { value: marks },
    uRaw: { value: new THREE.Color(raw) },
    uCooked: { value: new THREE.Color(cooked) },
    uBurnt: { value: new THREE.Color(burnt) },
    uRoughness: { value: new THREE.Vector3(...roughness) },
  };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const after = (chunk, code) => [`#include <${chunk}>`, `#include <${chunk}>\n${code}`];
    shader.vertexShader = shader.vertexShader
      .replace(...after('common', cookingPars))
      .replace(...after('begin_vertex', cookingVertex));
    shader.fragmentShader = shader.fragmentShader
      .replace(...after('common', cookingPars))
      .replace(...after('color_fragment', cookingFragment))
      .replace(...after('roughnessmap_fragment', 'roughnessFactor *= cookRoughness;'))
      .replace(...after('emissivemap_fragment', 'totalEmissiveRadiance += cookEmissive;'));
  };
  material.customProgramCacheKey = () => 'bistro-cooking';
  return material;
}

export function createLiquidMaterial({ color, foam, bottom, top }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uLightDir,
      uLightColor,
      uAmbient,
      uFill: { value: 1 },
      uBottom: { value: bottom },
      uTop: { value: top },
      uColor: { value: new THREE.Color(color) },
      uFoam: { value: new THREE.Color(foam) },
    },
    vertexShader: liquidVertex,
    fragmentShader: liquidFragment,
    side: THREE.DoubleSide,
  });
}

// Level 3 molecular cocktail: layered syrups that a vortex blends together.
// Driven per glass by world/Models.js setMixVisual().
export function createMixMaterial({ bottom, top }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uLightDir,
      uLightColor,
      uAmbient,
      uFill: { value: 0 },
      uBottom: { value: bottom },
      uTop: { value: top },
      uLayers: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uLayerCount: { value: 0 },
      uMix: { value: 0 },
      uSpin: { value: 0 },
    },
    vertexShader: liquidVertex,
    fragmentShader: mixFragment,
    side: THREE.DoubleSide,
  });
}

// Level 3 order hologram over a customer: `map` is the order drawn on a canvas.
// Driven by world/Models.js createOrderHologram() (uUrgency from patience, uFade).
export function createHologramMaterial(map, aspect) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uMap: { value: map },
      uUrgency: { value: 0 },
      uFade: { value: 0 },
      uSeed: { value: Math.random() },
      uAspect: { value: aspect },
    },
    vertexShader: hologramVertex,
    fragmentShader: hologramFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
}

export function createSteamMaterial(color = 0xffffff) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uIntensity: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: steamVertex,
    fragmentShader: steamFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// Volumetric headlight cone for Level 3's traffic (additive, so the beams of
// passing cars brighten whatever is behind them).
export function createBeamMaterial(color = 0xfff3dc, intensity = 0.16) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uIntensity: { value: intensity },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Level 2's pot water: churning surface + starch clouds + bubbles. Drive it with
// uniforms.uBoil (how hard it boils) and uniforms.uStarch (0 clear → 2 foamy).
export function createBoilMaterial({ radius, water = 0x2f4a52, cloudy = 0xd9cfb4 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uLightDir,
      uLightColor,
      uAmbient,
      uBoil: { value: 0.15 },
      uStarch: { value: 0 },
      uRadius: { value: radius },
      uWater: { value: new THREE.Color(water) },
      uCloudy: { value: new THREE.Color(cloudy) },
    },
    vertexShader: noiseChunk + boilVertex,
    fragmentShader: noiseChunk + boilFragment,
  });
}

// Level 2's steam plume: a camera-facing, domain-warped column of steam whose
// amount follows uniforms.uIntensity.
export function createPlumeMaterial({ color = 0xf4f1ee, tint = 0xffb6c8 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uIntensity: { value: 0.15 },
      uColor: { value: new THREE.Color(color) },
      uTint: { value: new THREE.Color(tint) },
    },
    vertexShader: plumeVertex,
    fragmentShader: noiseChunk + plumeFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createParticleMaterial({ colorStart, colorEnd, opacity = 0.8, additive = false }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPointScale,
      uColorStart: { value: new THREE.Color(colorStart) },
      uColorEnd: { value: new THREE.Color(colorEnd ?? colorStart) },
      uOpacity: { value: opacity },
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export function createSkyMaterial({ top, bottom, glow, stars = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uGlow: { value: new THREE.Color(glow) },
      uStars: { value: stars },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

// Used by graphics/PostProcessing.js as a ShaderPass.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uVignette: { value: 0.3 },
    uSaturation: { value: 1 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 },
    uHeat: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  },
  vertexShader: fullscreenVertex,
  fragmentShader: gradeFragment,
};
