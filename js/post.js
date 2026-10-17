import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  name: 'CinematicGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.042 },
    uCA: { value: 1.0 },
    uSat: { value: 1.04 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uCA, uSat;
    uniform vec2 uRes;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);

      // 轻微色差（边缘更明显）
      vec2 off = d * uCA * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      // 暗角
      float vig = smoothstep(1.0, 0.12, r2 * 1.25);
      col *= mix(1.0, vig, uVignette);

      // 冷暗部 / 暖亮部
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 cool = col * vec3(0.94, 1.0, 1.055);
      vec3 warm = col * vec3(1.055, 1.0, 0.94);
      col = mix(cool, warm, smoothstep(0.2, 0.85, l));
      col = mix(vec3(l), col, uSat);

      // 胶片颗粒
      float g = hash(uv * uRes + fract(uTime * 0.61) * 173.0) - 0.5;
      col += g * uGrain * (0.45 + 0.55 * (1.0 - l));

      // 轻微 S 曲线
      col = (col - 0.5) * 1.035 + 0.5;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.85, 0.86);
  const output = new OutputPass();
  const grade = new ShaderPass(GradeShader);

  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(grade);

  return {
    composer, bloom, grade,
    setSize(w, h) {
      composer.setSize(w, h);
      grade.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    },
    setPixelRatio(pr) {
      composer.setPixelRatio(pr);
    },
    render(t) {
      grade.uniforms.uTime.value = t;
      composer.render();
    },
  };
}
