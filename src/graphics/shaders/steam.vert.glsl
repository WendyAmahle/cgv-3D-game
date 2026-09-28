// Steam column — vertex stage. An open cylinder that widens and sways as it rises.
uniform float uTime;

varying vec2 vUv;

void main() {
  vUv = uv;
  float h = uv.y; // 0 at the bottom, 1 at the top
  vec3 p = position;
  p.x += sin(uTime * 2.0 + h * 6.0) * 0.08 * h;
  p.z += cos(uTime * 1.7 + h * 5.0) * 0.08 * h;
  p.xz *= 1.0 + h * 0.6;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
