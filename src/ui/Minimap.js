import * as THREE from 'three';
import { MINIMAP_LAYER } from '../utils/Constants.js';

const CENTRE = new THREE.Vector3(0, 0, 0.8);
const REGION = { width: 15.5, depth: 6.8 }; // kitchen + customer spots, in metres

// Picture-in-picture minimap: a second, orthographic camera looking straight
// down on the kitchen, drawn into a corner of the same canvas with the
// scissor test after the main view. It also sees MINIMAP_LAYER, so markers
// such as the chef's arrow show here but not in the main view.
export class Minimap {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.frame = document.querySelector('#minimap');
    this.visible = true;
    this.rect = null;
    this.size = new THREE.Vector2();

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
    this.camera.position.set(CENTRE.x, 16, CENTRE.z);
    this.camera.up.set(0, 0, -1); // back wall at the top, customers at the bottom
    this.camera.lookAt(CENTRE);
    this.camera.layers.enable(MINIMAP_LAYER);
  }

  toggle() {
    this.visible = !this.visible;
    this.rect = null;
    this.frame.classList.toggle('off', !this.visible);
    return this.visible;
  }

  // Call after a resize or when the HUD is shown: the frame's box is read lazily.
  invalidate() {
    this.rect = null;
  }

  measure() {
    const rect = this.frame.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return null;
    const aspect = rect.width / rect.height;
    let halfWidth = REGION.width / 2;
    let halfDepth = REGION.depth / 2;
    if (aspect > halfWidth / halfDepth) halfWidth = halfDepth * aspect;
    else halfDepth = halfWidth / aspect;
    Object.assign(this.camera, { left: -halfWidth, right: halfWidth, top: halfDepth, bottom: -halfDepth });
    this.camera.updateProjectionMatrix();
    return rect;
  }

  // `hide`: objects to leave out of the minimap (roof, the first-person hand).
  render(hide) {
    if (!this.visible) return;
    this.rect ??= this.measure();
    const rect = this.rect;
    if (!rect) return;

    const renderer = this.renderer;
    const x = rect.left;
    const y = window.innerHeight - rect.bottom;
    const shown = hide.filter((object) => object.visible);
    shown.forEach((object) => (object.visible = false));
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false; // reuse the main view's shadow maps

    renderer.setScissorTest(true);
    renderer.setScissor(x, y, rect.width, rect.height);
    renderer.setViewport(x, y, rect.width, rect.height);
    renderer.render(this.scene, this.camera);

    renderer.getSize(this.size);
    renderer.setViewport(0, 0, this.size.x, this.size.y);
    renderer.setScissor(0, 0, this.size.x, this.size.y);
    renderer.setScissorTest(false);
    renderer.shadowMap.autoUpdate = shadowUpdate;
    shown.forEach((object) => (object.visible = true));
  }
}
