import * as THREE from 'three';
import { makeTextures, rng } from './textures.js';
import { addCabin, addYard, makeMaterials } from './cabin.js';

const UP = new THREE.Vector3(0, 1, 0);

/* ---------- 噪声 & 地形 ---------- */
const fract = (v) => v - Math.floor(v);
function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function heightAt(x, z) {
  const d = Math.hypot(x, z * 0.95);
  const flat = smoothstep(9, 23, d);
  const n = (vnoise(x * 0.06 + 10, z * 0.06) - 0.5) * 3.4 +
            (vnoise(x * 0.17, z * 0.17 + 5) - 0.5) * 0.9;
  const rise = Math.max(0, d - 30) * 0.06;
  return flat * (n + 0.6) + rise;
}

/* ---------- 天空 ---------- */
function addSky(scene, sunDir) {
  const geo = new THREE.SphereGeometry(320, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x0d1526) },
      uMid: { value: new THREE.Color(0x2b3a60) },
      uHor: { value: new THREE.Color(0xc9835a) },
      uSunCol: { value: new THREE.Color(0xffc98d) },
      uSun: { value: sunDir.clone() },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uHor, uSunCol, uSun;
      varying vec3 vWorld;
      void main() {
        vec3 d = normalize(vWorld - cameraPosition);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.34, h));
        col = mix(col, uTop, smoothstep(0.2, 0.9, h));
        float s = max(dot(d, normalize(uSun)), 0.0);
        col += uSunCol * pow(s, 60.0) * 1.6;
        col += uSunCol * pow(s, 6.0) * 0.22;
        col += uSunCol * pow(s, 1.6) * 0.06;
        col = mix(uHor * 0.72, col, smoothstep(-0.16, -0.01, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

/* ---------- 灯光 ---------- */
function addLights(scene, sunDir) {
  const sun = new THREE.DirectionalLight(0xffb173, 3.1);
  sun.position.copy(sunDir).multiplyScalar(46);
  sun.target.position.set(0, 1.5, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 110;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // 天光
  const hemi = new THREE.HemisphereLight(0x8ea8cf, 0x2b2519, 0.72);
  scene.add(hemi);

  // 相向冷补光
  const fill = new THREE.DirectionalLight(0x9cb6d8, 1.0);
  fill.position.set(14, 9, 18);
  scene.add(fill);

  const amb = new THREE.AmbientLight(0x2a3348, 0.8);
  scene.add(amb);

  return { sun, hemi, fill };
}

/* ---------- 地面 ---------- */
function addTerrain(scene, T) {
  const size = 280, seg = 140;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: T.ground.map, bumpMap: T.ground.bump, bumpScale: 0.28,
    roughness: 0.98, metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/* ---------- 小径 ---------- */
function addPath(scene, T) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.8, 0, 27),
    new THREE.Vector3(-1.3, 0, 21),
    new THREE.Vector3(1.1, 0, 15),
    new THREE.Vector3(-0.9, 0, 9.5),
    new THREE.Vector3(0.2, 0, 6.0),
    new THREE.Vector3(-0.3, 0, 4.35),
  ]);
  const N = 90;
  const pts = curve.getPoints(N);
  const positions = [], uvs = [], indices = [];
  const R = rng(2024);
  for (let i = 0; i <= N; i++) {
    const p = pts[i];
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(N, i + 1)];
    const dir = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const w = 0.78 + Math.sin(i * 0.35) * 0.16 + (R() - 0.5) * 0.12;
    const y = heightAt(p.x, p.z) + 0.045;
    positions.push(p.x + side.x * w, y, p.z + side.z * w);
    positions.push(p.x - side.x * w, y, p.z - side.z * w);
    uvs.push(0, i * 0.16, 1, i * 0.16);
    if (i < N) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: T.path.map, bumpMap: T.path.bump, bumpScale: 0.25,
    roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/* ---------- 树 ---------- */
const PINE_LAYERS = [
  { r: 1.95, h: 3.3, y: 1.55 },
  { r: 1.45, h: 2.75, y: 3.35 },
  { r: 0.95, h: 2.2, y: 5.0 },
];
const LEAF_BLOBS = [
  { x: 0, y: 4.25, z: 0, r: 1.65 },
  { x: 0.95, y: 3.75, z: 0.35, r: 1.2 },
  { x: -0.85, y: 3.85, z: -0.45, r: 1.15 },
  { x: 0.1, y: 3.4, z: 0.95, r: 1.05 },
  { x: -0.2, y: 4.9, z: 0.1, r: 1.0 },
];

function addForest(scene, T, R) {
  const trunkMat = new THREE.MeshStandardMaterial({
    map: T.bark.map, color: 0xcbb69e, roughness: 1,
  });
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });

  /* 采样位置 */
  const pines = [], oaks = [];
  for (let i = 0; i < 1400; i++) {
    const a = R() * Math.PI * 2;
    const rr = 11.5 + Math.pow(R(), 0.85) * 82;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 4.2 && z > 3) continue;   // 小径走廊
    if (Math.hypot(x, z) < 11.2) continue;      // 屋前空地
    const s = 0.62 + R() * 0.95;
    const item = { x, z, s, rot: R() * Math.PI * 2, h: R() };
    (R() > 0.32 ? pines : oaks).push(item);
    if (pines.length + oaks.length > 400) break;
  }

  /* 松树（实例化） */
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.32, 3.3, 6);
  trunkGeo.translate(0, 1.65, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 8);
  coneGeo.translate(0, 0.5, 0);

  const pineTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
  const pineCones = new THREE.InstancedMesh(coneGeo, needleMat, pines.length * 3);
  pineTrunks.castShadow = false; pineTrunks.receiveShadow = false;
  pineCones.castShadow = false;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  pines.forEach((t, i) => {
    const y = heightAt(t.x, t.z) - 0.2;
    q.setFromAxisAngle(UP, t.rot);
    v.set(t.x, y, t.z); sc.set(t.s, t.s, t.s);
    m4.compose(v, q, sc);
    pineTrunks.setMatrixAt(i, m4);
    col.setHSL(0.3 + t.h * 0.05, 0.28 + t.h * 0.15, 0.135 + t.h * 0.07);
    pineCones.setColorAt(i * 3, col);
    pineCones.setColorAt(i * 3 + 1, col);
    pineCones.setColorAt(i * 3 + 2, col);
    PINE_LAYERS.forEach((L, li) => {
      v.set(t.x, y + L.y * t.s, t.z);
      sc.set(L.r * t.s, L.h * t.s, L.r * t.s);
      m4.compose(v, q, sc);
      pineCones.setMatrixAt(i * 3 + li, m4);
    });
    // 树干随机略斜
  });
  pineTrunks.instanceMatrix.needsUpdate = true;
  pineCones.instanceMatrix.needsUpdate = true;
  if (pineCones.instanceColor) pineCones.instanceColor.needsUpdate = true;
  pineTrunks.frustumCulled = false; pineCones.frustumCulled = false;
  scene.add(pineTrunks, pineCones);

  /* 阔叶树（实例化） */
  const oakTrunkGeo = new THREE.CylinderGeometry(0.2, 0.38, 3.7, 6);
  oakTrunkGeo.translate(0, 1.85, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const oakTrunks = new THREE.InstancedMesh(oakTrunkGeo, trunkMat, oaks.length);
  const oakLeaves = new THREE.InstancedMesh(blobGeo, leafMat, oaks.length * LEAF_BLOBS.length);
  oakTrunks.castShadow = false; oakLeaves.castShadow = false;

  oaks.forEach((t, i) => {
    const y = heightAt(t.x, t.z) - 0.2;
    q.setFromAxisAngle(UP, t.rot);
    v.set(t.x, y, t.z); sc.set(t.s, t.s, t.s);
    m4.compose(v, q, sc);
    oakTrunks.setMatrixAt(i, m4);
    col.setHSL(0.2 + t.h * 0.07, 0.32 + t.h * 0.12, 0.165 + t.h * 0.08);
    LEAF_BLOBS.forEach((b, bi) => {
      const rr = b.r * (0.8 + 0.4 * hash2(i, bi));
      v.set(t.x + b.x * t.s, y + b.y * t.s, t.z + b.z * t.s);
      sc.set(rr * t.s, rr * t.s * 0.85, rr * t.s);
      const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.rot + bi, 0));
      m4.compose(v, q2, sc);
      oakLeaves.setMatrixAt(i * LEAF_BLOBS.length + bi, m4);
      oakLeaves.setColorAt(i * LEAF_BLOBS.length + bi, col);
    });
  });
  oakTrunks.instanceMatrix.needsUpdate = true;
  oakLeaves.instanceMatrix.needsUpdate = true;
  if (oakLeaves.instanceColor) oakLeaves.instanceColor.needsUpdate = true;
  oakTrunks.frustumCulled = false; oakLeaves.frustumCulled = false;
  scene.add(oakTrunks, oakLeaves);

  /* 近景树（有阴影，增强空间感） */
  const nearSpots = [
    [-8.6, 7.4, 1.05], [-11.4, 1.2, 0.92], [-8.0, -6.2, 1.15], [7.6, -8.4, 1.0],
    [10.2, 4.2, 0.88], [6.4, 10.6, 1.2], [-5.2, 11.6, 0.8], [12.6, -1.4, 1.1],
  ];
  const nearGroup = new THREE.Group();
  nearSpots.forEach(([x, z, s], idx) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    const trunkScale = s * 1.1;
    trunk.scale.set(trunkScale, trunkScale, trunkScale);
    trunk.castShadow = true; trunk.receiveShadow = true;
    g.add(trunk);
    const c1 = new THREE.Color().setHSL(0.31, 0.3, 0.14 + (idx % 3) * 0.022);
    PINE_LAYERS.forEach((L) => {
      const cone = new THREE.Mesh(coneGeo, needleMat.clone());
      cone.material.color.copy(c1);
      cone.position.set(0, L.y * trunkScale, 0);
      cone.scale.set(L.r * trunkScale, L.h * trunkScale, L.r * trunkScale);
      cone.rotation.y = idx * 1.7;
      cone.castShadow = true;
      g.add(cone);
    });
    g.position.set(x, heightAt(x, z) - 0.2, z);
    nearGroup.add(g);
  });
  scene.add(nearGroup);

  return { pines, oaks };
}

/* ---------- 地被：草 / 蕨 / 石头 ---------- */
function crossPlane(w, h) {
  const geo = new THREE.BufferGeometry();
  const hw = w / 2;
  const pos = [
    -hw, 0, 0, hw, 0, 0, hw, h, 0, -hw, h, 0,
    0, 0, -hw, 0, 0, hw, 0, h, hw, 0, h, -hw,
  ];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geo.computeVertexNormals();
  return geo;
}

function addUndergrowth(scene, T, R) {
  const grassMat = new THREE.MeshStandardMaterial({
    map: T.foliage, alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: 1, color: 0xffffff,
  });
  const geo = crossPlane(1.15, 0.85);
  const N = 620;
  const grass = new THREE.InstancedMesh(geo, grassMat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < N * 4 && n < N; i++) {
    const a = R() * Math.PI * 2;
    const rr = 4.6 + Math.pow(R(), 0.7) * 22;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 1.4 && z > 4) continue;
    if (Math.hypot(x, z) < 4.4) continue;
    v.set(x, heightAt(x, z) - 0.05, z);
    q.setFromAxisAngle(UP, R() * Math.PI * 2);
    const s = 0.75 + R() * 0.9;
    sc.set(s, s * (0.8 + R() * 0.5), s);
    m4.compose(v, q, sc);
    grass.setMatrixAt(n, m4);
    col.setHSL(0.23 + R() * 0.06, 0.22 + R() * 0.15, 0.3 + R() * 0.18);
    grass.setColorAt(n, col);
    n++;
  }
  grass.count = n;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.frustumCulled = false;
  scene.add(grass);

  /* 石头 */
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.95, flatShading: true });
  const stoneMat2 = new THREE.MeshStandardMaterial({ color: 0x5c584f, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, rr = 5 + R() * 16;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 1.6 && z > 4) continue;
    const s = 0.25 + R() * 0.75;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), R() > 0.5 ? stoneMat : stoneMat2);
    rock.position.set(x, heightAt(x, z) + s * 0.28, z);
    rock.rotation.set(R() * 3, R() * 3, R() * 3);
    rock.scale.set(1, 0.72, 1.15);
    rock.castShadow = true; rock.receiveShadow = true;
    scene.add(rock);
  }

  /* 倒木 */
  for (let i = 0; i < 3; i++) {
    const a = R() * Math.PI * 2, rr = 9 + R() * 10;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 2 && z > 3) continue;
    const len = 2.5 + R() * 2.5;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, len, 7), new THREE.MeshStandardMaterial({
      map: T.bark.map, color: 0x9c8a75, roughness: 1,
    }));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = R() * Math.PI;
    log.position.set(x, heightAt(x, z) + 0.22, z);
    log.rotation.x = (R() - 0.5) * 0.1;
    log.castShadow = true; log.receiveShadow = true;
    scene.add(log);
  }
}

/* ---------- 光点 / 尘埃 / 烟 ---------- */
function makePoints(count, R, opts) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI * 2;
    const rr = opts.rMin + Math.pow(R(), 0.7) * (opts.rMax - opts.rMin);
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = opts.yMin + R() * (opts.yMax - opts.yMin);
    pos[i * 3 + 2] = Math.sin(a) * rr;
    phase[i] = R() * 100;
    size[i] = opts.size * (0.4 + R() * 0.9);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  return geo;
}

function addFX(scene, T, R, chimneyTop) {
  /* 尘埃 */
  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffd9a8) },
      uPR: { value: 1 },
      uSize: { value: 1 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime, uPR, uSize;
      varying float vTw;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.22 + aPhase) * 0.75;
        p.y += sin(uTime * 0.16 + aPhase * 1.7) * 0.5;
        p.z += cos(uTime * 0.19 + aPhase * 1.3) * 0.75;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uSize * uPR * (110.0 / max(1.0, -mv.z));
        vTw = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 1.4 + aPhase * 3.1), 2.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTw;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        a *= a;
        gl_FragColor = vec4(uColor, a * vTw * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(makePoints(340, R, { rMin: 3, rMax: 26, yMin: 0.4, yMax: 9, size: 4.5 }), dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  /* 萤火 */
  const fireMat = dustMat.clone();
  fireMat.uniforms = THREE.UniformsUtils.clone(dustMat.uniforms);
  fireMat.uniforms.uColor.value = new THREE.Color(0xa8e08a);
  fireMat.uniforms.uSize.value = 1.35;
  const fire = new THREE.Points(makePoints(90, R, { rMin: 4, rMax: 20, yMin: 0.25, yMax: 2.2, size: 5 }), fireMat);
  fire.frustumCulled = false;
  scene.add(fire);

  /* 炊烟 */
  const puffs = [];
  const wind = new THREE.Vector3(0.75, 0, 0.5).normalize();
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.SpriteMaterial({
      map: T.smoke, transparent: true, depthWrite: false,
      color: 0x9aa0ab, opacity: 0, blending: THREE.NormalBlending,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(chimneyTop);
    sp.scale.setScalar(0.5);
    scene.add(sp);
    puffs.push({ sp, off: i / 18, speed: 0.85 + R() * 0.25, drift: 0.8 + R() * 0.6 });
  }

  const state = { dustMat, fireMat, puffs, wind, chimneyTop };

  return {
    update(dt, t) {
      dustMat.uniforms.uTime.value = t;
      fireMat.uniforms.uTime.value = t;
      for (const p of puffs) {
        const life = (t * 0.09 * p.speed + p.off) % 1;
        const ease = life * life;
        const s = 0.55 + life * 5.4;
        p.sp.position.set(
          chimneyTop.x + wind.x * ease * 6.5 * p.drift + Math.sin(life * 5 + p.off * 9) * 0.45,
          chimneyTop.y + life * 6.2,
          chimneyTop.z + wind.z * ease * 6.5 * p.drift + Math.cos(life * 4 + p.off * 7) * 0.45
        );
        p.sp.scale.set(s, s, 1);
        p.sp.material.opacity = Math.sin(Math.min(1, life * 1.25) * Math.PI) * 0.3;
        p.sp.material.rotation += dt * 0.06;
      }
    },
    setPixelRatio(pr) {
      dustMat.uniforms.uPR.value = pr;
      fireMat.uniforms.uPR.value = pr;
    },
  };
}

/* ---------- 组装 ---------- */
export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x6f6a74, 0.0155);

  const T = makeTextures();
  const M = makeMaterials(T);
  const R = rng(8848);

  const sunDir = new THREE.Vector3(-0.66, 0.26, -0.71).normalize();
  addSky(scene, sunDir);
  const lights = addLights(scene, sunDir);
  addTerrain(scene, T);
  addPath(scene, T);
  addForest(scene, T, R);
  addUndergrowth(scene, T, R);

  const cabin = addCabin(scene, T, M);
  addYard(scene, T, M);

  const fx = addFX(scene, T, R, cabin.chimneyTop);

  return {
    scene,
    sunDir,
    lights,
    update(dt, t) { fx.update(dt, t); },
    setPixelRatio(pr) { fx.setPixelRatio(pr); },
  };
}
