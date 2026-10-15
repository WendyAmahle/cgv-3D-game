import * as THREE from 'three';
import { createFoodMesh, createPlateMesh as createPlate } from './Food.js';
import { MIX_SHOTS, SYRUPS, mixColor, mixKey } from '../gameplay/Recipes.js';
import { createHologramMaterial } from '../graphics/Shaders.js';

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

// Cocktail glass: one layer per poured shot (plus the one being poured),
// swirled together as `mix` goes 0 → 1. See shaders/mix.frag.glsl.
export function setMixVisual(object, { fill, shots, pending, mix, spin }) {
  const material = object.userData.mixMaterial;
  if (!material) return;
  const { uniforms } = material;
  const layers = pending ? [...shots, pending] : shots;
  layers.forEach((syrup, index) => uniforms.uLayers.value[index].setHex(SYRUPS[syrup].color));
  uniforms.uLayerCount.value = layers.length;
  uniforms.uFill.value = fill;
  uniforms.uMix.value = mix;
  uniforms.uSpin.value = spin;

  // The "molecular pearl" garnish appears once the drink is blended.
  const garnish = object.userData.garnish;
  garnish.visible = mix >= 1 && shots.length === MIX_SHOTS;
  if (garnish.visible) garnish.userData.material.emissive.setHex(mixColor(mixKey(shots)));
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

// Level 3: the order as a hologram projected over the customer.
// Scene graph: group → emitter disc → light cone → panel (hologram shader,
// billboarded in the vertex stage). Same userData.setPatience API as the
// bubble, plus update(dt) to animate and dismiss() to fizzle it out.
//   swatch: a cocktail's colour (sRGB hex) or null; detail: a second line.
export function createOrderHologram(text, { swatch = null, detail = '' } = {}) {
  // The panel is sized to its text (at most 1.5 wide) so it hides as little
  // of the kitchen behind it as possible; 680 canvas pixels per world unit
  // keeps the letters sharp.
  const ppu = 680;
  const font = '"Segoe UI", Arial, sans-serif';
  const titleFont = `800 ${detail ? 92 : 100}px ${font}`;
  const detailFont = `600 58px ${font}`;
  const title = text.toUpperCase();
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = titleFont;
  let textWidth = ctx.measureText(title).width;
  ctx.font = detailFont;
  const detailWidth = detail ? ctx.measureText(detail).width + (swatch === null ? 0 : 72) : 0;
  textWidth = Math.max(textWidth, detailWidth);
  const width = THREE.MathUtils.clamp((textWidth + 110) / ppu, 0.7, 1.5);
  const height = detail ? 0.5 : 0.32;

  const canvas = ctx.canvas;
  canvas.width = Math.round(width * ppu);
  canvas.height = Math.round(height * ppu);
  const maxText = canvas.width - 90;
  const middle = canvas.width / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = titleFont;
  ctx.fillText(title, middle, detail ? canvas.height * 0.36 : canvas.height / 2, maxText);
  if (detail) {
    ctx.font = detailFont;
    const y = canvas.height * 0.72;
    const lineWidth = Math.min(ctx.measureText(detail).width, maxText - (swatch === null ? 0 : 72));
    const x = swatch === null ? middle : middle + 36;
    ctx.fillText(detail, x, y, lineWidth);
    if (swatch !== null) {
      ctx.shadowColor = `#${swatch.toString(16).padStart(6, '0')}`;
      ctx.shadowBlur = 14;
      ctx.fillStyle = ctx.shadowColor;
      ctx.beginPath();
      ctx.arc(x - lineWidth / 2 - 44, y, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;

  const material = createHologramMaterial(map, width / height);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  panel.position.y = 0.32 + height / 2;
  panel.frustumCulled = false; // the vertex stage moves it (billboard)
  panel.renderOrder = 20;

  const emitterMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false });
  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 20), emitterMaterial);
  const coneMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.08, 0.3, 24, 1, true), coneMaterial);
  cone.position.y = 0.17;

  const result = new THREE.Group();
  result.add(emitter, cone, panel);
  for (const mesh of [emitter, cone, panel]) mesh.raycast = () => {}; // clicks go to the customer

  const { uniforms } = material;
  const [calm, warn, alarm] = [0x22d3ee, 0xff9f1c, 0xff1f3d].map((hex) => new THREE.Color(hex));
  const tint = new THREE.Color();
  let dismissing = false;
  // Same teal → amber → red ramp as the shader's urgencyColor().
  result.userData.setPatience = (ratio) => {
    const urgency = 1 - ratio;
    uniforms.uUrgency.value = urgency;
    if (urgency < 0.6) tint.lerpColors(calm, warn, THREE.MathUtils.smoothstep(urgency, 0.3, 0.6));
    else tint.lerpColors(warn, alarm, THREE.MathUtils.smoothstep(urgency, 0.6, 0.85));
    emitterMaterial.color.copy(tint);
    coneMaterial.color.copy(tint);
  };
  result.userData.update = (dt) => {
    if (!result.visible) return;
    const target = dismissing ? 0 : 1;
    uniforms.uFade.value = THREE.MathUtils.clamp(uniforms.uFade.value + Math.sign(target - uniforms.uFade.value) * dt * (dismissing ? 2.5 : 3), 0, 1);
    coneMaterial.opacity = 0.1 * uniforms.uFade.value;
    if (dismissing && uniforms.uFade.value === 0) result.visible = false;
  };
  result.userData.dismiss = () => {
    dismissing = true;
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
