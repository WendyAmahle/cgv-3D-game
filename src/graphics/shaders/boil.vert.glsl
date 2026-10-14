// Boiling water in Level 2's pot — vertex stage. A flat disc whose vertices
// are pushed up and down by moving noise, so the surface churns harder as
// uBoil rises. The normal is rebuilt from the slope of that height field so
// highlights move with the waves.
uniform float uTime;
uniform float uBoil; // 0.15 simmering (empty pot) → 1 rolling boil → 1.5 boiling over

varying vec2 vPos; // position on the disc (metres from its centre)
varying vec3 vWorldNormal;
varying vec3 vViewDir;

float height(vec2 p) {
  // Two noise layers drifting in different directions plus a ripple ring
  // spreading from the centre where the heat is strongest.
  float churn = noise(p * 14.0 + vec2(uTime * 1.7, -uTime * 1.1)) + noise(p * 23.0 - vec2(uTime * 2.3, uTime * 0.7)) * 0.5;
  float ripple = sin(length(p) * 42.0 - uTime * 7.0) * 0.25;
  return (churn + ripple) * 0.012 * uBoil;
}

void main() {
  vec2 p = position.xy; // the disc is built in XY and rotated flat by its mesh
  float h = height(p);
  float e = 0.01;
  vec3 n = normalize(vec3(height(p - vec2(e, 0.0)) - height(p + vec2(e, 0.0)), height(p - vec2(0.0, e)) - height(p + vec2(0.0, e)), 2.0 * e));

  vPos = p;
  vec4 world = modelMatrix * vec4(position + vec3(0.0, 0.0, h), 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * n);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
