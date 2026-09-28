// Particles — vertex stage. Point size attenuates with distance and grows with age.
uniform float uPointScale;

attribute float aAge; // 0 = just born, 1 = dead
attribute float aSize;

varying float vAge;

void main() {
  vAge = aAge;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float alive = step(aAge, 0.999);
  gl_PointSize = aSize * (0.6 + aAge * 0.8) * uPointScale / -mv.z * alive;
  gl_Position = projectionMatrix * mv;
}
