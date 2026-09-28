import * as THREE from 'three';
import { createSkyMaterial } from '../graphics/Shaders.js';

// Gradient sky dome with optional stars (see graphics/shaders/sky.frag.glsl).
export function createSky(sky) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), createSkyMaterial(sky));
  dome.name = 'sky';
  dome.frustumCulled = false;
  return dome;
}
