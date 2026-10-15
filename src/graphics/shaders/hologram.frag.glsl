// Hologram order display — fragment stage (Level 3).
// uMap holds the order drawn in white on a transparent canvas (plus a cocktail's
// colour swatch). The shader turns it into a projected hologram:
//   - a dark, see-through plate behind the text keeps it readable over the neon
//     scene, and the text stays below the bloom threshold so it doesn't smear;
//   - white ink takes a pale hologram tint, coloured marks keep their colour;
//   - scanlines and a band rolling up the plate, and a glowing frame;
//   - uUrgency (1 - customer patience) shifts the colour teal → amber → red and
//     adds glitches: bands of the panel jump sideways, the red and blue channels
//     split apart and the panel dims for a frame now and then (all kept small
//     so the order stays legible);
//   - uFade dissolves it pixel block by pixel block as it appears or is served.
// Normal alpha blending; only the frame is bright enough for the bloom pass.
uniform sampler2D uMap;
uniform float uTime;
uniform float uUrgency; // 0 just arrived → 1 about to walk out
uniform float uFade;    // 0 gone → 1 fully projected
uniform float uSeed;    // per customer, so their holograms don't flicker in sync
uniform float uAspect;  // panel width / height

varying vec2 vUv;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

vec3 urgencyColor(float u) {
  vec3 calm = vec3(0.15, 0.95, 0.9);
  vec3 warn = vec3(1.0, 0.62, 0.12);
  vec3 alarm = vec3(1.0, 0.12, 0.18);
  return u < 0.6 ? mix(calm, warn, smoothstep(0.3, 0.6, u)) : mix(warn, alarm, smoothstep(0.6, 0.85, u));
}

void main() {
  float t = uTime + uSeed * 17.0;
  float glitch = smoothstep(0.6, 1.0, uUrgency);

  // Dissolve in and out in blocks.
  float block = hash(floor(vUv.x * 36.0) + floor(vUv.y * 12.0) * 37.0 + uSeed);
  if (block > uFade) discard;

  // Glitch: horizontal bands jump sideways, more often as patience runs out.
  float band = floor(vUv.y * 14.0);
  float tick = floor(t * 12.0);
  float jump = step(1.0 - 0.4 * glitch, hash(band * 7.13 + tick));
  vec2 uv = vUv;
  uv.x += (hash(band + tick * 3.1) - 0.5) * 0.03 * jump * glitch;

  vec3 color = urgencyColor(uUrgency);
  vec4 ink = texture2D(uMap, uv);
  float saturation = max(ink.r, max(ink.g, ink.b)) - min(ink.r, min(ink.g, ink.b));
  vec3 inkColor = mix(mix(vec3(1.0), color, 0.25), ink.rgb, step(0.15, saturation));

  // Chromatic split: the red and blue channels slide apart when glitching.
  float split = 0.004 * glitch;
  float red = texture2D(uMap, uv + vec2(split, 0.0)).a;
  float blue = texture2D(uMap, uv - vec2(split, 0.0)).a;
  vec3 fringe = vec3(max(red - ink.a, 0.0), 0.0, max(blue - ink.a, 0.0)) * 0.6;

  // Plate with rounded corners and a glowing frame round its edge.
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 halfSize = vec2(uAspect, 1.0) * 0.5 - 0.04;
  float edge = length(max(abs(p) - halfSize + 0.08, 0.0)) - 0.08;
  float frame = smoothstep(0.025, 0.0, abs(edge));
  float plate = smoothstep(0.01, -0.01, edge);

  float scan = 0.75 + 0.25 * sin(vUv.y * 150.0 - t * 7.0);
  float roll = exp(-30.0 * pow(fract(vUv.y * 0.6 - t * 0.35) - 0.5, 2.0));
  float flicker = 0.94 + 0.06 * hash(floor(t * 24.0));
  if (hash(floor(t * 9.0) + uSeed) < glitch * 0.18) flicker *= 0.6;

  vec3 plateColor = color * (0.06 + roll * 0.1) * scan;
  vec3 rgb = mix(plateColor, inkColor, ink.a) + fringe;
  rgb = mix(rgb, color * 1.6, frame);
  float alpha = max(max(plate * 0.65, ink.a), frame);
  gl_FragColor = vec4(rgb * flicker, alpha);
  #include <colorspace_fragment>
}
