import * as THREE from 'three';
import { assets } from '../utils/AssetLoader.js';

// Cached materials and textures. Everything returned here is shared between
// meshes (userData.shared) so Dispose.js leaves it alone.

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

export function physical(color, options = {}) {
  const key = `physical|${color}|${keyOf(options)}`;
  if (!materials.has(key)) {
    const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, ...options });
    material.userData.shared = true;
    materials.set(key, material);
  }
  return materials.get(key);
}

// Common real-world surfaces.
export const surfaces = {
  steel: () => physical(0xc9ced4, { metalness: 1, roughness: 0.5, anisotropy: 0.5, anisotropyRotation: Math.PI / 2 }),
  darkSteel: () => physical(0x5b6068, { metalness: 1, roughness: 0.42 }),
  chrome: () => physical(0xffffff, { metalness: 1, roughness: 0.08 }),
  castIron: () => physical(0x1c1c1e, { metalness: 0.7, roughness: 0.55 }),
  rubber: () => physical(0x151515, { roughness: 0.85 }),
  plastic: (color) => physical(color, { roughness: 0.35, clearcoat: 0.3 }),
  ceramic: (color = 0xf7f5f0) => physical(color, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
  paint: (color) => physical(color, { roughness: 0.35, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 }),
  glass: () => physical(0xffffff, { roughness: 0.04, transmission: 1, thickness: 0.05, ior: 1.5, side: THREE.DoubleSide }),
};

// Material from a downloaded PBR texture set (public/assets/textures/<id>), or
// a flat-colour fallback when the textures are missing.
export function pbr(id, repeat, fallbackColor, options = {}) {
  const key = `pbr|${id}|${repeat}|${keyOf(options)}`;
  if (!materials.has(key)) {
    const maps = assets.pbr(id, repeat);
    const material = new THREE.MeshStandardMaterial({
      color: maps.map ? 0xffffff : fallbackColor,
      roughness: 1,
      ...maps,
      ...options,
    });
    material.userData.shared = true;
    materials.set(key, material);
  }
  return materials.get(key);
}

export function canvasTexture(key, size, draw, repeat = [1, 1], colorSpace = THREE.SRGBColorSpace) {
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
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

// Tangent-space normal map from value noise — bumpy detail for food surfaces.
export function noiseNormalMap(key, { scale = 8, strength = 2, octaves = 3 } = {}) {
  return canvasTexture(`normal-${key}`, 256, (ctx, size) => {
    const heights = new Float32Array(size * size);
    const lattice = new Float32Array(1024).map(() => Math.random());
    const value = (x, y) => lattice[((x & 31) + (y & 31) * 32) % 1024];
    const smooth = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = value(xi, yi), b = value(xi + 1, yi), c = value(xi, yi + 1), d = value(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let h = 0;
        let amplitude = 1;
        for (let o = 0; o < octaves; o += 1) {
          const f = (scale * 2 ** o) / size;
          h += smooth(x * f, y * f) * amplitude;
          amplitude *= 0.5;
        }
        heights[y * size + x] = h;
      }
    }
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const h = (xx, yy) => heights[((yy + size) % size) * size + ((xx + size) % size)];
        const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
        const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
        const length = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        image.data[i] = (-dx / length * 0.5 + 0.5) * 255;
        image.data[i + 1] = (dy / length * 0.5 + 0.5) * 255;
        image.data[i + 2] = (1 / length * 0.5 + 0.5) * 255;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [1, 1], THREE.NoColorSpace);
}
