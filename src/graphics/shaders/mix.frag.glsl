// Molecular cocktail shader — fragment stage (Level 3's Mixology Bar).
// Uses liquid.vert.glsl, so vLocal is the object-space position on an open
// cylinder running from uBottom to uTop.
//
// Each poured shot is a layer of its own syrup colour stacked in pour order,
// with wavy interfaces like liquids of different density. As uMix goes 0 → 1
// a vortex of swirling streaks pulls every layer into the blended colour.
// Blending is subtractive, like dyes: each syrup absorbs part of the light, so
// the result is the geometric mean of the layer colours (cyan + magenta makes
// blue, cyan + yellow makes green), not their average (which would go grey).
uniform float uTime;
uniform float uFill;        // 0..1 of the glass
uniform float uBottom;
uniform float uTop;
uniform vec3 uLayers[4];    // syrup colour per shot, in pour order
uniform float uLayerCount;  // layers with liquid in them, the one pouring included
uniform float uMix;         // 0 layered → 1 fully blended
uniform float uSpin;        // 0..1 magnetic stirrer speed
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;

varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

const float SHOTS = 4.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 layerColor(float index) {
  vec3 color = uLayers[0];
  for (int i = 1; i < 4; i++) {
    if (float(i) <= index) color = uLayers[i];
  }
  return color;
}

// Weighted geometric mean of the poured layers (subtractive mixing).
vec3 blendedColor() {
  vec3 sum = vec3(0.0);
  float count = 0.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) < uLayerCount) {
      sum += log(max(uLayers[i], vec3(0.03)));
      count += 1.0;
    }
  }
  return exp(sum / max(count, 1.0));
}

void main() {
  if (uFill <= 0.001 || uLayerCount < 0.5) discard;

  float height = uTop - uBottom;
  float angle = atan(vLocal.z, vLocal.x);

  // Surface: sloshes while pouring and climbs the wall while the stirrer spins.
  float slosh = uFill < 0.999 ? 1.0 : 0.35;
  float wave = (sin(vLocal.x * 24.0 + uTime * 5.0) + sin(vLocal.z * 19.0 - uTime * 3.9)) * 0.005 * slosh;
  wave += uSpin * (0.025 + 0.01 * sin(angle * 3.0 - uTime * 14.0));
  float surface = uBottom + height * uFill + wave;
  if (vLocal.y > surface) discard;

  // Layered: which shot is this fragment in? Interfaces ripple a little.
  float h = (vLocal.y - uBottom) / height * SHOTS;
  float ripple = sin(angle * 3.0 + uTime * 1.3 + h * 2.0) * 0.08;
  float index = clamp(floor(h + ripple), 0.0, uLayerCount - 1.0);
  vec3 layered = layerColor(index);
  // A bright line just above each interface (none at the bottom of the glass).
  float aboveInterface = fract(h + ripple);
  layered *= 1.0 + 0.4 * (1.0 - smoothstep(0.0, 0.08, aboveInterface)) * step(0.5, index);

  // Blending: spiral streaks pulled round by the vortex spread the blend
  // through the glass, so the layers smear into each other before they vanish.
  float streak = 0.5 + 0.5 * sin(angle * 2.0 + vLocal.y * 38.0 - uTime * 9.0 + sin(vLocal.y * 13.0 + uTime * 3.0) * 1.5);
  float blend = smoothstep(0.0, 1.0, uMix * 1.7 - 0.7 + streak * 0.7);
  vec3 color = mix(layered, blendedColor(), blend);

  // Depth: brighter near the surface, denser at the bottom.
  float depth = clamp((surface - vLocal.y) / height, 0.0, 1.0);
  color *= mix(1.25, 0.7, depth);

  // Fizz: rising sparkles, faster while the stirrer spins.
  vec2 cell = vec2(floor(angle * 7.0), floor((vLocal.y - uTime * (0.1 + uSpin * 0.5)) * 45.0));
  float fizz = step(0.94, hash(cell));

  vec3 normal = normalize(vWorldNormal);
  if (!gl_FrontFacing) {
    // Inside back faces seen through the top read as the liquid surface.
    color = mix(layerColor(uLayerCount - 1.0), blendedColor(), blend) * 1.3;
    normal = vec3(0.0, 1.0, 0.0);
  }

  float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
  vec3 lit = color * (uAmbient + uLightColor * diffuse * 0.7);
  float fresnel = pow(1.0 - max(dot(normal, normalize(vViewDir)), 0.0), 3.0);
  // Neon syrups glow by themselves, enough for the bloom pass to catch them.
  lit += color * 0.45 + fresnel * 0.25 + fizz * (0.25 + uSpin * 0.5);

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
