import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GradeShader } from './Shaders.js';

// Render → bloom → custom grade/heat-haze pass → output (tone mapping + sRGB).
// Disabled on "Low" graphics quality, where the scene renders directly.
export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.flashValue = 0;
    this.time = 0;
    this.projected = new THREE.Vector3();

    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(size, 0.3, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.setSize(size.x, size.y);
  }

  // `post` comes from the level config.
  configure(post = {}) {
    this.bloom.strength = post.bloom ?? 0.3;
    this.bloom.radius = post.bloomRadius ?? 0.5;
    this.bloom.threshold = post.threshold ?? 0.85;
    const uniforms = this.grade.uniforms;
    uniforms.uSaturation.value = post.saturation ?? 1;
    uniforms.uVignette.value = post.vignette ?? 0.3;
    uniforms.uTint.value.set(post.tint ?? 0xffffff);
  }

  flash(amount = 1) {
    this.flashValue = Math.max(this.flashValue, amount);
  }

  setHeatSources(sources) {
    const slots = this.grade.uniforms.uHeat.value;
    slots.forEach((slot, index) => {
      const source = sources[index];
      if (!source) {
        slot.set(0, 0, 0, 0);
        return;
      }
      this.projected.copy(source.position).project(this.camera);
      const visible = this.projected.z < 1;
      const distance = this.camera.position.distanceTo(source.position);
      slot.set(
        this.projected.x * 0.5 + 0.5,
        this.projected.y * 0.5 + 0.5,
        THREE.MathUtils.clamp(1.2 / distance, 0.05, 0.35),
        visible ? source.strength : 0
      );
    });
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.grade.uniforms.uAspect.value = width / height;
  }

  render(dt) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;
    this.flashValue = Math.max(0, this.flashValue - dt * 2.5);
    this.grade.uniforms.uTime.value = this.time;
    this.grade.uniforms.uFlash.value = this.flashValue;
    this.composer.render(dt);
  }
}
