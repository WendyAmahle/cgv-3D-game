// Post-processing pass — heat haze, colour grade, vignette and hit flash.
// uHeat[i] = (screen u, screen v, radius, strength) for up to 4 active cookers;
// the image above each one wobbles like hot air.
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAspect;
uniform float uVignette;
uniform float uSaturation;
uniform vec3 uTint;
uniform float uFlash;
uniform vec4 uHeat[4];

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  for (int i = 0; i < 4; i++) {
    vec4 heat = uHeat[i];
    if (heat.w <= 0.0) continue;
    vec2 d = uv - (heat.xy + vec2(0.0, heat.z * 0.8));
    d.x *= uAspect;
    d.y *= 0.55;
    float falloff = 1.0 - smoothstep(0.0, heat.z, length(d));
    vec2 wobble = vec2(sin(uv.y * 90.0 - uTime * 7.0), cos(uv.x * 70.0 + uTime * 5.0));
    uv += wobble * 0.0025 * heat.w * falloff;
  }

  vec4 texel = texture2D(tDiffuse, uv);
  vec3 color = texel.rgb;

  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(grey), color, uSaturation) * uTint;

  float edge = 1.0 - smoothstep(0.25, 0.85, length(vUv - 0.5) * (1.0 + uVignette));
  color *= mix(1.0 - uVignette, 1.0, edge);

  color = mix(color, vec3(0.9, 0.1, 0.05), uFlash * 0.35 * (1.0 - edge * 0.6));

  gl_FragColor = vec4(color, texel.a);
}
