// Steam column — fragment stage. Scrolling value noise forms wisps; uIntensity
// (driven by the cooker's heat) fades the whole column in and out.
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;

varying vec2 vUv;

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
  // Wrap x at the cylinder seam (8 cells around).
  vec2 p = vec2(vUv.x * 8.0, vUv.y * 3.0 - uTime * 0.8);
  float n = noise(p) * 0.6 + noise(p * 2.3 + 7.0) * 0.4;
  float fadeY = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
  float alpha = smoothstep(0.35, 0.9, n) * fadeY * uIntensity * 0.5;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
