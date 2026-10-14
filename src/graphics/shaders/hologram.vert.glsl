// Hologram order display — vertex stage (Level 3).
// Billboarding: the quad is rebuilt in view space around the object's origin,
// so the panel always faces the camera at its world size whatever the view.
// While it appears or fizzles out (uFade < 1) it folds down to a thin line.
uniform float uFade;

varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  float unfold = mix(0.04, 1.0, smoothstep(0.0, 0.6, uFade));
  center.xy += position.xy * scale * vec2(1.0, unfold);
  gl_Position = projectionMatrix * center;
}
