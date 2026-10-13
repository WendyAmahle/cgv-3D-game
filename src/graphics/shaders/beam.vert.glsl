// Headlight beam — vertex stage. An open cone whose tip sits at the lamp.
// ConeGeometry's uv.y is 1 at the tip and 0 at the open end.
varying float vAlong;
varying float vFacing;
varying vec3 vWorld;

void main() {
  vAlong = 1.0 - uv.y; // 0 at the lamp, 1 at the far end
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  // How squarely this part of the cone faces the camera: the silhouette
  // (grazing angles) fades out so the cone reads as a soft volume of light.
  vFacing = abs(dot(n, normalize(-view.xyz)));
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * view;
}
