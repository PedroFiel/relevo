varying vec3 vNormalVisao;
varying vec3 vPosicaoVisao;

void main() {
  vec4 posVisao = modelViewMatrix * vec4(position, 1.0);
  vPosicaoVisao = posVisao.xyz;
  vNormalVisao = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * posVisao;
}
