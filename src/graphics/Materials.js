import * as THREE from 'three';

// Cached standard materials and procedural canvas textures. Everything returned
// here is shared between meshes (userData.shared) so Dispose.js leaves it alone.
// Swap the procedural textures for real image textures in assets/ when ready.

const materials = new Map();
const textures = new Map();

const keyOf = (options) =>
  Object.entries(options)
    .map(([name, value]) => `${name}:${value?.uuid ?? value}`)
    .join(',');

export function mat(color, options = {}) {
  const key = `${color}|${keyOf(options)}`;
  if (!materials.has(key)) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...options });
    material.userData.shared = true;
    materials.set(key, material);
  }
  return materials.get(key);
}

function canvasTexture(key, size, draw, repeat = [1, 1]) {
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  texture.userData.shared = true;
  textures.set(key, texture);
  return texture;
}

const css = (hex) => `#${new THREE.Color(hex).getHexString()}`;

export function checkerTexture(a, b, repeat = [8, 8]) {
  return canvasTexture(`checker-${a}-${b}-${repeat}`, 128, (ctx, size) => {
    const half = size / 2;
    ctx.fillStyle = css(a);
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = css(b);
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
    ctx.strokeRect(0, 0, half, half);
    ctx.strokeRect(half, half, half, half);
  }, repeat);
}

export function woodTexture(base, repeat = [1, 1]) {
  return canvasTexture(`wood-${base}-${repeat}`, 256, (ctx, size) => {
    const color = new THREE.Color(base);
    ctx.fillStyle = css(base);
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      const shade = 0.85 + 0.3 * Math.sin(y * 0.15 + Math.sin(y * 0.03) * 4) * Math.random();
      ctx.fillStyle = `rgba(${color.r * 255 * shade},${color.g * 255 * shade},${color.b * 255 * shade},0.35)`;
      ctx.fillRect(0, y, size, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < size; x += size / 4) ctx.fillRect(x, 0, 2, size);
  }, repeat);
}

export function stripeTexture(a, b, stripes = 8, repeat = [1, 1]) {
  return canvasTexture(`stripes-${a}-${b}-${stripes}-${repeat}`, 128, (ctx, size) => {
    const width = size / stripes;
    for (let index = 0; index < stripes; index += 1) {
      ctx.fillStyle = css(index % 2 ? b : a);
      ctx.fillRect(index * width, 0, width, size);
    }
  }, repeat);
}

export function gridTexture(base, line, repeat = [10, 10]) {
  return canvasTexture(`grid-${base}-${line}-${repeat}`, 128, (ctx, size) => {
    ctx.fillStyle = css(base);
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = css(line);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, size, size);
  }, repeat);
}

// Lit windows for background buildings.
export function windowsTexture(wall, lit, seed = 1) {
  return canvasTexture(`windows-${wall}-${lit}-${seed}`, 128, (ctx, size) => {
    let state = seed * 9301;
    const random = () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
    ctx.fillStyle = css(wall);
    ctx.fillRect(0, 0, size, size);
    const cell = size / 8;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        ctx.fillStyle = random() > 0.55 ? css(lit) : 'rgba(0,0,0,0.35)';
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 5);
      }
    }
  }, [1, 3]);
}
