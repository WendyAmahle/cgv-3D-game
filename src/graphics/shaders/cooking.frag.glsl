// Cooking shader — fragment stage.
// Blends raw → cooked → burnt colours with noisy, uneven browning, adds grill
// marks on top faces, a heat glow while cooking and glowing embers once burnt.
uniform float uTime;
uniform float uCook;
uniform float uHeat;
uniform float uMarks;
uniform vec3 uRaw;
uniform vec3 uCooked;
uniform vec3 uBurnt;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;

varying vec3 vLocal;
varying vec3 vWorldNormal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  float cooked = clamp(uCook, 0.0, 1.0);
  float burnt = clamp(uCook - 1.0, 0.0, 1.0);
  vec2 q = vLocal.xz + vLocal.y * 0.7;
  float n = noise(q * 14.0) * 0.65 + noise(q * 41.0) * 0.35;

  // Browning and charring spread unevenly across the surface.
  float brown = smoothstep(0.0, 1.0, cooked * 1.5 - n * 0.5);
  float charred = smoothstep(0.0, 1.0, burnt * 1.6 - n * 0.6);
  vec3 color = mix(uRaw, uCooked, brown);
  color = mix(color, uBurnt, charred);

  // Grill marks on upward-facing surfaces.
  float up = smoothstep(0.5, 0.9, vWorldNormal.y);
  float stripes = smoothstep(0.75, 0.85, fract((vLocal.x + vLocal.z) * 7.0));
  color *= 1.0 - stripes * up * uMarks * brown * 0.55;

  vec3 normal = normalize(vWorldNormal);
  float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
  vec3 lit = color * (uAmbient + uLightColor * diffuse);

  // Pulsing orange glow while on the heat; embers once burnt.
  float pulse = 0.5 + 0.5 * sin(uTime * 6.0 + n * 6.2831);
  lit += vec3(1.0, 0.35, 0.05) * uHeat * 0.12 * pulse;
  float ember = step(0.86, noise(q * 60.0 + uTime * 0.7)) * charred * uHeat;
  lit += vec3(1.0, 0.3, 0.0) * ember * 1.5;

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
