// Boiling water — fragment stage. Clear water turns cloudy with starch as the
// noodles cook (uStarch), bubbles pop across the surface while it boils
// (uBoil), and a fresnel highlight picks up the lights. Square disc → round
// pot: fragments outside uRadius are discarded.
uniform float uTime;
uniform float uBoil;
uniform float uStarch; // 0 clear water → 1 cloudy (cooked) → 2 foamy (soggy)
uniform float uRadius;
uniform vec3 uWater;
uniform vec3 uCloudy;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;

varying vec2 vPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  float r = length(vPos);
  if (r > uRadius) discard;

  // Starch clouds swirl slowly instead of filling the water uniformly.
  float swirl = fbm(vPos * 9.0 + vec2(uTime * 0.25, -uTime * 0.18));
  float cloud = clamp(uStarch * (0.55 + 0.6 * swirl), 0.0, 1.0);
  vec3 color = mix(uWater, uCloudy, cloud);

  // Bubbles: a grid of cells, each with a random phase; a bubble grows then
  // pops, so the surface fizzes rather than scrolling.
  vec2 cellPos = vPos * 34.0;
  vec2 cell = floor(cellPos);
  float phase = fract(hash(cell) + uTime * (0.6 + hash(cell + 3.1)));
  float size = phase * 0.42;
  float bubble = 1.0 - smoothstep(size - 0.06, size, length(fract(cellPos) - 0.5));
  bubble *= step(1.0 - 0.55 * min(uBoil, 1.0), hash(cell + 7.7)) * smoothstep(0.15, 0.4, uBoil);
  float foam = smoothstep(1.0, 2.0, uStarch) * smoothstep(0.45, 0.75, swirl); // overcooked: froth
  color = mix(color, vec3(0.95), max(bubble * 0.7, foam));

  // Dark ring where the water meets the pot wall.
  color *= mix(1.0, 0.55, smoothstep(uRadius * 0.8, uRadius, r));

  vec3 normal = normalize(vWorldNormal);
  vec3 view = normalize(vViewDir);
  float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
  vec3 lit = color * (uAmbient + uLightColor * diffuse * 0.6);
  float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 4.0);
  float glint = pow(max(dot(reflect(-normalize(uLightDir), normal), view), 0.0), 60.0);
  lit += (fresnel * 0.35 + glint * 0.8) * (1.0 - cloud * 0.6);

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
