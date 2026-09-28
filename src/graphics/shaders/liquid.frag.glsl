// Liquid-fill shader — fragment stage.
// uFill (0..1) sets the level between uBottom and uTop (object space). Fragments
// above a sloshing surface are discarded; a foam line, depth gradient and rising
// bubbles sell the liquid. The mesh is an open cylinder, so its inside back faces
// seen through the top read as the liquid surface.
uniform float uTime;
uniform float uFill;
uniform float uBottom;
uniform float uTop;
uniform vec3 uColor;
uniform vec3 uFoam;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;

varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  if (uFill <= 0.001) discard;

  // Slosh harder while still pouring.
  float slosh = uFill < 0.999 ? 1.0 : 0.4;
  float wave = (sin(vLocal.x * 22.0 + uTime * 5.0) + sin(vLocal.z * 17.0 - uTime * 3.7)) * 0.006 * slosh;
  float surface = mix(uBottom, uTop, uFill) + wave;
  if (vLocal.y > surface) discard;

  float depth = clamp((surface - vLocal.y) / max(uTop - uBottom, 0.001), 0.0, 1.0);
  vec3 color = mix(uColor * 1.35, uColor * 0.6, depth);
  float foam = 1.0 - smoothstep(0.0, 0.025, surface - vLocal.y);
  color = mix(color, uFoam, foam * 0.85);

  // Rising bubbles.
  float angle = atan(vLocal.z, vLocal.x);
  vec2 cell = vec2(floor(angle * 6.0), floor((vLocal.y - uTime * 0.12) * 40.0));
  color += step(0.93, hash(cell)) * (1.0 - foam) * 0.25;

  vec3 normal = normalize(vWorldNormal);
  if (!gl_FrontFacing) {
    color = mix(uColor * 1.2, uFoam, 0.3);
    normal = vec3(0.0, 1.0, 0.0);
  }

  float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
  vec3 lit = color * (uAmbient + uLightColor * diffuse * 0.8);
  float fresnel = pow(1.0 - max(dot(normal, normalize(vViewDir)), 0.0), 3.0);
  lit += fresnel * 0.2;

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
