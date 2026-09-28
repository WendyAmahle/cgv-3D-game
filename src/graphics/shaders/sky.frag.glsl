// Sky dome — fragment stage. Vertical gradient, horizon glow and twinkling stars
// (uStars = 0 for daytime).
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uGlow;
uniform float uStars;
uniform float uTime;

varying vec3 vDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 color = mix(uBottom, uTop, smoothstep(-0.05, 0.55, h));
  color += uGlow * pow(1.0 - abs(h), 6.0) * 0.5;

  vec2 grid = vec2(atan(dir.z, dir.x), asin(clamp(h, -1.0, 1.0))) * 90.0;
  vec2 cell = floor(grid);
  float star = step(0.985, hash(cell));
  float twinkle = 0.6 + 0.4 * sin(uTime * 2.5 + hash(cell + 3.1) * 40.0);
  float mask = smoothstep(0.08, 0.35, h) * (1.0 - smoothstep(0.2, 0.45, length(fract(grid) - 0.5)));
  color += star * twinkle * mask * uStars;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
