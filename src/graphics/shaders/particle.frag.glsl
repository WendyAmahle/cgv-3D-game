// Particles — fragment stage. Soft round sprite that fades in, shifts colour and fades out.
uniform vec3 uColorStart;
uniform vec3 uColorEnd;
uniform float uOpacity;

varying float vAge;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = 1.0 - smoothstep(0.1, 0.5, d);
  float fade = smoothstep(0.0, 0.1, vAge) * (1.0 - vAge);
  gl_FragColor = vec4(mix(uColorStart, uColorEnd, vAge), soft * fade * uOpacity);
  #include <colorspace_fragment>
}
