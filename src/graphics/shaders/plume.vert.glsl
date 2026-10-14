// Steam plume above Level 2's pot — vertex stage. A tall, subdivided plane
// that always turns to face the camera around the vertical axis (a
// "cylindrical billboard"), so it reads as a column of steam from every side
// instead of a flat card. Higher up it widens and sways.
uniform float uTime;
uniform float uIntensity;

varying vec2 vUv;

void main() {
  vUv = uv;
  float h = uv.y; // 0 at the pot, 1 at the top of the plume

  // Billboard: build a "right" vector pointing sideways relative to the camera,
  // in the horizontal plane only, so the plume stays upright.
  vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 toCamera = normalize(cameraPosition.xz - base.xz + vec2(0.0001));
  vec3 right = vec3(toCamera.y, 0.0, -toCamera.x);

  // Widen as it rises (rising steam spreads out), more so when boiling hard,
  // and sway the upper part like warm air drifting.
  float spread = 1.0 + h * (0.8 + 0.6 * uIntensity);
  float sway = sin(uTime * 1.3 + h * 4.0) * 0.07 * h + sin(uTime * 0.7 + h * 9.0) * 0.03 * h;
  vec3 world = base + right * (position.x * spread + sway) + vec3(0.0, position.y, 0.0);

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
