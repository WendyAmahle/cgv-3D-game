import * as THREE from 'three';
import { MINIMAP_LAYER } from '../utils/Constants.js';

const CENTRE = new THREE.Vector3(0, 0, 0.8);
const REGION = { width: 15.5, depth: 6.8 }; // kitchen + customer spots, in metres
const REDRAW_INTERVAL = 1 / 15; // seconds between redraws of the minimap image

// Picture-in-picture minimap: a second, orthographic camera looking straight
// down on the kitchen, drawn into a corner of the same canvas with the
// scissor test after the main view. It also sees MINIMAP_LAYER, so markers
// such as the chef's arrow show here but not in the main view.
//
// Rendering the scene a second time every frame cost about 4 fps on an
// integrated GPU, so the view is drawn into its own small image ~15 times a
// second (the kitchen seen from above changes slowly) and that image is pasted
// into the corner every frame. Drawing into a render target also means the
// minimap uses the same shader variants as the main view.
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

    this.target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
    this.screen = new THREE.Scene();
    this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.target.texture, depthTest: false, depthWrite: false })));
    this.age = Infinity; // seconds since the image was last drawn
  }

  toggle() {
    this.visible = !this.visible;
    this.rect = null;
    this.age = Infinity;
    this.frame.classList.toggle('off', !this.visible);
    return this.visible;
  }

  // Call after a resize or when the HUD is shown: the frame's box is read lazily.
  invalidate() {
    this.rect = null;
    this.age = Infinity;
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
    const pixelRatio = this.renderer.getPixelRatio();
    this.target.setSize(Math.round(rect.width * pixelRatio), Math.round(rect.height * pixelRatio));
    return rect;
  }

  // `hide`: objects to leave out of the minimap (roof, the first-person hand).
  render(hide, dt = 0) {
    if (!this.visible) return;
    this.rect ??= this.measure();
    const rect = this.rect;
    if (!rect) return;
    const renderer = this.renderer;

    this.age += dt;
    if (this.age >= REDRAW_INTERVAL) {
      this.age = 0;
      const shown = hide.filter((object) => object.visible);
      shown.forEach((object) => (object.visible = false));
      const shadowUpdate = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false; // reuse the main view's shadow maps
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(null);
      renderer.shadowMap.autoUpdate = shadowUpdate;
      shown.forEach((object) => (object.visible = true));
    }

    const x = rect.left;
    const y = window.innerHeight - rect.bottom;
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, rect.width, rect.height);
    renderer.setViewport(x, y, rect.width, rect.height);
    renderer.render(this.screen, this.screenCamera);
    renderer.getSize(this.size);
    renderer.setViewport(0, 0, this.size.x, this.size.y);
    renderer.setScissor(0, 0, this.size.x, this.size.y);
    renderer.setScissorTest(false);
  }
}
