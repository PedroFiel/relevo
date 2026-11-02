varying vec3 vNormalVisao;
varying vec3 vPosicaoVisao;

void main() {
  vec3 N = normalize(vNormalVisao);
  vec3 V = normalize(-vPosicaoVisao);
  float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.4);
  vec3 base = vec3(0.11, 0.14, 0.20);
  vec3 borda = vec3(1.00, 0.42, 0.24);
  vec3 cor = mix(base, borda, fresnel);
  gl_FragColor = vec4(cor, 1.0);
}
