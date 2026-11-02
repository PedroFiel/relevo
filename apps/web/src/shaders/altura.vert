varying float vAltura;
varying vec3 vNormal;

void main() {
  vAltura = position.y;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
