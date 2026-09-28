// Cooking shader — vertex stage.
// Food shrinks and puffs as it cooks, and sizzles (tiny normal jitter) while on the heat.
uniform float uTime;
uniform float uCook; // 0 = raw, 1 = cooked, 2 = burnt
uniform float uHeat; // 1 while sitting on an active cooker

varying vec3 vLocal;
varying vec3 vWorldNormal;

void main() {
  float cooked = clamp(uCook, 0.0, 1.0);
  float burnt = clamp(uCook - 1.0, 0.0, 1.0);

  vec3 p = position;
  p.xz *= 1.0 - 0.08 * cooked - 0.06 * burnt;
  p.y *= 1.0 + 0.18 * cooked - 0.1 * burnt;

  float sizzle = sin(uTime * 45.0 + position.x * 30.0 + position.z * 23.0);
  p += normal * sizzle * 0.004 * uHeat;

  vLocal = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
