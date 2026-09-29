import * as THREE from 'three';
import { createFoodMesh, createPlateMesh as createPlate } from './Food.js';

// Item meshes (see Food.js), plus labels, order bubbles and the selection ring.
// Customers live in Characters.js.

export function createItemMesh(type) {
  const result = createFoodMesh(type);
  result.name = type;
  return result;
}

export function createPlateMesh() {
  const result = createPlate();
  result.name = 'plate';
  return result;
}

export function setCookVisual(object, amount, heat) {
  const uniforms = object.userData.cookMaterial?.userData.uniforms;
  if (!uniforms) return;
  uniforms.uCook.value = amount;
  uniforms.uHeat.value = heat;
}

export function setLiquidFill(object, fill) {
  const material = object.userData.liquidMaterial;
  if (material) material.uniforms.uFill.value = fill;
  if (object.userData.ice) object.userData.ice.visible = fill > 0.7;
}

// ------------------------------------------------------------- sprites / UI

export function createTextSprite(text, { fontSize = 64, color = '#ffffff', background = 'rgba(0,0,0,0)', height = 0.5, padding = 24, font = 'Segoe UI, Arial, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSpec = `700 ${fontSize}px ${font}`;
  context.font = fontSpec;
  const width = Math.ceil(context.measureText(text).width) + padding * 2;
  canvas.width = width;
  canvas.height = fontSize + padding * 2;

  context.fillStyle = background;
  const radius = Math.min(28, canvas.height / 2);
  context.beginPath();
  context.roundRect(0, 0, canvas.width, canvas.height, radius);
  context.fill();
  context.font = fontSpec;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + fontSize * 0.05);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, fog: false, toneMapped: false }));
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

// Recipe name + patience bar floating above a customer.
export function createOrderBubble(text) {
  const result = new THREE.Group();
  const label = createTextSprite(text, { fontSize: 44, color: '#111827', background: 'rgba(255,255,255,0.92)', height: 0.36 });
  const barWidth = 1.1;
  const background = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1f2937, fog: false }));
  background.center.set(0, 0.5);
  background.scale.set(barWidth, 0.09, 1);
  background.position.set(-barWidth / 2, -0.28, 0);
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x22c55e, fog: false, toneMapped: false }));
  fill.center.set(0, 0.5);
  fill.scale.set(barWidth, 0.07, 1);
  fill.position.set(-barWidth / 2, -0.28, 0.01);
  result.add(label, background, fill);

  result.userData.setPatience = (ratio) => {
    fill.scale.x = Math.max(0.001, barWidth * ratio);
    fill.material.color.setHSL(0.33 * ratio, 0.85, 0.5);
  };
  return result;
}

export function createSelectionRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.74, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff08a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  return ring;
}
