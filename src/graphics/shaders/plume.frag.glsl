// Steam plume — fragment stage. Noise is "domain warped": the coordinates used
// to sample it are themselves pushed around by another noise, which curls the
// wisps so they twist and break up as they rise rather than looking like a
// texture scrolling upwards. uIntensity (from the pot's real cooking state)
// controls how much steam there is and how fast it rises.
uniform float uTime;
uniform float uIntensity; // 0.15 empty pot → 1 noodles boiling → ~1.4 soggy
uniform vec3 uColor;
uniform vec3 uTint; // light picked up from the neon and lanterns below

varying vec2 vUv;

void main() {
  float h = vUv.y;
  float rise = uTime * (0.25 + 0.2 * uIntensity);

  // 1. Domain warp: a slow noise field offsets the lookup position.
  vec2 p = vec2(vUv.x * 2.2, h * 2.6 - rise);
  vec2 warp = vec2(fbm(p + vec2(0.0, uTime * 0.15)), fbm(p + vec2(5.2, 1.3)));
  // 2. The actual wisps, sampled through the warp.
  float n = fbm(p + 1.6 * warp);

  // 3. Shape: soft sides that widen with height, fade in above the rim and
  //    fade out at the top, so there are no visible edges of the plane.
  float side = 1.0 - smoothstep(0.12 + 0.2 * h, 0.5, abs(vUv.x - 0.5));
  float column = smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.4, 1.0, h));

  // 4. More intensity → lower threshold → denser, wider steam.
  float density = smoothstep(0.32 - 0.12 * uIntensity, 0.8, n) * side * column;
  float alpha = clamp(density * uIntensity * 0.9, 0.0, 0.65);

  vec3 color = mix(uColor, uTint, 0.35 * (1.0 - h)); // lit from below
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
