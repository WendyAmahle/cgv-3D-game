// Cooking shader — declarations shared by the vertex and fragment stages.
// Injected into MeshStandardMaterial so food keeps physically based lighting,
// shadows and HDRI reflections (see createCookingMaterial in Shaders.js).
uniform float uTime;
uniform float uCook;     // 0 = raw, 1 = cooked, 2 = burnt
uniform float uHeat;     // 1 while sitting on an active cooker
uniform float uMarks;    // grill marks on/off
uniform vec3 uRaw;
uniform vec3 uCooked;
uniform vec3 uBurnt;
uniform vec3 uRoughness; // roughness when raw / cooked / burnt

varying vec3 vCookLocal;
varying vec3 vCookNormal;

float cookHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float cookNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(cookHash(i), cookHash(i + vec2(1.0, 0.0)), u.x),
    mix(cookHash(i + vec2(0.0, 1.0)), cookHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
