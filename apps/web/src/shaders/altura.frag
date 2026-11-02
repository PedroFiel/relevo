uniform float uMinY;
uniform float uMaxY;
varying float vAltura;
varying vec3 vNormal;

void main() {
  float t = clamp((vAltura - uMinY) / max(uMaxY - uMinY, 0.001), 0.0, 1.0);
  vec3 sola = vec3(0.16, 0.36, 0.82);
  vec3 meio = vec3(0.18, 0.76, 0.54);
  vec3 topo = vec3(1.00, 0.42, 0.24);
  vec3 cor = t < 0.5 ? mix(sola, meio, t * 2.0) : mix(meio, topo, (t - 0.5) * 2.0);
  // Linhas de contorno topográficas a cada 1 cm de altura
  float isolinha = abs(fract(vAltura) - 0.5);
  float traço = smoothstep(0.03, 0.07, isolinha);
  float luz = 0.55 + 0.45 * max(dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 0.5))), 0.0);
  gl_FragColor = vec4(cor * luz * (0.75 + 0.25 * traço), 1.0);
}
