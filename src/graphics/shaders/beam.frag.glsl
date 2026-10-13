// Headlight beam — fragment stage. Light scattered by the rain: bright at the
// lamp, fading with distance and towards the cone's edges, with raindrops
// streaking down through it. Drawn with additive blending.
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;

varying float vAlong;
varying float vFacing;
varying vec3 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float falloff = pow(1.0 - vAlong, 1.8) * smoothstep(0.0, 0.05, vAlong);
  float edge = smoothstep(0.05, 0.7, vFacing);
  // Sparse, thin world-space streaks of rain falling through the light.
  vec2 cell = vec2((vWorld.x + vWorld.z) * 22.0, vWorld.y * 2.5 + uTime * 12.0);
  float drop = step(0.985, hash(floor(cell))) * smoothstep(0.0, 0.5, fract(cell.y));
  float alpha = falloff * edge * uIntensity * (1.0 + drop * 1.5);
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
