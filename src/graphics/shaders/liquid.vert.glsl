// Liquid-fill shader — vertex stage. Passes object-space position so the
// fragment stage can cut the liquid off at the fill level.
varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vLocal = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
