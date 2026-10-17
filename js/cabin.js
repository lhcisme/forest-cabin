import * as THREE from 'three';
import { rng } from './textures.js';

/* 小屋尺寸 */
const W = 5.6;      // 宽 (x)
const D = 4.6;      // 进深 (z)
const H = 2.9;      // 墙高
const FLOOR = 0.55; // 石基顶面
const RIDGE = 2.05; // 屋脊高出墙顶
const EAVE = 2.85;  // 屋檐水平外伸
const A = Math.atan(RIDGE / EAVE);
const SLOPE = Math.hypot(RIDGE, EAVE);

export function makeMaterials(T) {
  return {
    wall: new THREE.MeshStandardMaterial({ map: T.wall.map, bumpMap: T.wall.bump, bumpScale: 0.16, roughness: 0.92 }),
    plank: new THREE.MeshStandardMaterial({ map: T.plank.map, bumpMap: T.plank.bump, bumpScale: 0.12, roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ map: T.roof.map, bumpMap: T.roof.bump, bumpScale: 0.4, roughness: 0.95 }),
    stone: new THREE.MeshStandardMaterial({ map: T.stone.map, bumpMap: T.stone.bump, bumpScale: 0.3, roughness: 0.95 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x3a3833, roughness: 0.95, flatShading: true }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.85 }),
    door: new THREE.MeshStandardMaterial({ map: T.plank.map, color: 0xc9a882, bumpMap: T.plank.bump, bumpScale: 0.1, roughness: 0.8 }),
    bark: new THREE.MeshStandardMaterial({ map: T.bark.map, color: 0xb09a84, roughness: 1 }),
    logEnd: new THREE.MeshStandardMaterial({ color: 0x9c7b52, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x2a1a10, emissive: 0xffb066, emissiveMap: T.win, emissiveIntensity: 2.8, roughness: 0.35, metalness: 0,
    }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a05a, roughness: 0.35, metalness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.55, metalness: 0.7 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xe8dfcd, roughness: 1, side: THREE.DoubleSide }),
    cloth2: new THREE.MeshStandardMaterial({ color: 0xa9bcc4, roughness: 1, side: THREE.DoubleSide }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0x1a0e05, emissive: 0xffb066, emissiveIntensity: 6, roughness: 0.4 }),
    flower: new THREE.MeshStandardMaterial({ color: 0xc94f45, roughness: 0.9, flatShading: true }),
    flowerY: new THREE.MeshStandardMaterial({ color: 0xd9a53b, roughness: 0.9, flatShading: true }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x8a5540, roughness: 0.95 }),
    glowSprite: new THREE.SpriteMaterial({
      map: T.glow, color: 0xffb877, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.9,
    }),
  };
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, seg, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function glowSprite(mat, scale, x, y, z) {
  const s = new THREE.Sprite(mat.clone());
  s.scale.set(scale, scale, 1);
  s.position.set(x, y, z);
  return s;
}

/* ---------- 窗（朝 +z） ---------- */
function makeWindow(M, w = 1.05, h = 0.95) {
  const g = new THREE.Group();
  // 外框
  g.add(box(w + 0.24, h + 0.24, 0.1, M.darkWood, 0, 0, 0.02));
  // 玻璃
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  glass.position.z = 0.075;
  g.add(glass);
  // 窗棂
  g.add(box(0.055, h, 0.035, M.darkWood, 0, 0, 0.1));
  g.add(box(w, 0.05, 0.035, M.darkWood, 0, 0, 0.1));
  // 窗台
  g.add(box(w + 0.4, 0.09, 0.26, M.plank, 0, -h / 2 - 0.14, 0.07));
  // 窗楣
  g.add(box(w + 0.34, 0.1, 0.2, M.plank, 0, h / 2 + 0.14, 0.04));
  g.add(glowSprite(M.glowSprite, w * 2.6, 0, 0, 0.25));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ---------- 灯笼 ---------- */
function makeLantern(M) {
  const g = new THREE.Group();
  g.add(box(0.16, 0.035, 0.16, M.iron, 0, 0.12, 0));
  g.add(box(0.13, 0.22, 0.13, M.lampGlow, 0, 0, 0));
  // 四根铁框
  for (const [x, z] of [[-0.075, -0.075], [0.075, -0.075], [-0.075, 0.075], [0.075, 0.075]]) {
    g.add(box(0.014, 0.24, 0.014, M.iron, x, 0, z));
  }
  g.add(box(0.17, 0.02, 0.17, M.iron, 0, -0.12, 0));
  const hook = cyl(0.008, 0.008, 0.16, 5, M.iron, 0, 0.2, 0);
  g.add(hook);
  g.add(glowSprite(M.glowSprite, 1.5, 0, 0, 0));
  return g;
}

/* ---------- 小屋 ---------- */
export function addCabin(scene, T, M) {
  const g = new THREE.Group();
  const lights = [];

  /* 石基 */
  g.add(box(W + 0.4, 0.78, D + 0.4, M.stone, 0, 0.17, 0));

  /* 墙体 */
  g.add(box(W, H, D, M.wall, 0, FLOOR + H / 2, 0));

  /* 转角封边木条 */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.15, H + 0.02, 0.15, M.plank, sx * (W / 2 - 0.02), FLOOR + H / 2, sz * (D / 2 - 0.02)));
  }
  /* 腰线 */
  g.add(box(W + 0.06, 0.1, 0.06, M.darkWood, 0, FLOOR + 0.05, D / 2 + 0.01));
  g.add(box(W + 0.06, 0.1, 0.06, M.darkWood, 0, FLOOR + H - 0.05, D / 2 + 0.01));

  /* 屋顶两坡 */
  g.add(box(W + 0.9, 0.16, SLOPE + 0.12, M.roof, 0, FLOOR + H + RIDGE / 2, EAVE / 2, A));
  g.add(box(W + 0.9, 0.16, SLOPE + 0.12, M.roof, 0, FLOOR + H + RIDGE / 2, -EAVE / 2, -A));
  /* 屋脊 */
  g.add(cyl(0.11, 0.11, W + 1.0, 8, M.darkWood, 0, FLOOR + H + RIDGE + 0.02, 0, 0, 0, Math.PI / 2));

  /* 山墙（三角） */
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, RIDGE - 0.05); tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.14, bevelEnabled: false });
  triGeo.translate(0, 0, -0.07);
  triGeo.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(triGeo, M.wall);
    m.position.set(sx * (W / 2 - 0.06), FLOOR + H, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }


  /* 门 */
  const doorZ = D / 2 + 0.06;
  g.add(box(1.06, 2.06, 0.09, M.door, -0.85, FLOOR + 1.03, doorZ));
  // 门板横压条
  for (const y of [0.45, 1.05, 1.65]) {
    g.add(box(0.94, 0.11, 0.05, M.plank, -0.85, y + 0.3, doorZ + 0.06));
  }
  // 门框
  g.add(box(0.1, 2.26, 0.12, M.darkWood, -1.44, FLOOR + 1.13, doorZ));
  g.add(box(0.1, 2.26, 0.12, M.darkWood, -0.26, FLOOR + 1.13, doorZ));
  g.add(box(1.3, 0.12, 0.12, M.darkWood, -0.85, FLOOR + 2.2, doorZ));
  // 把手
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.brass);
  knob.position.set(-0.38, FLOOR + 1.0, doorZ + 0.09);
  knob.castShadow = true;
  g.add(knob);

  /* 前窗 */
  const win = makeWindow(M, 1.05, 0.95);
  win.position.set(1.6, FLOOR + 1.35, D / 2 + 0.08);
  g.add(win);
  /* 右侧窗 */
  const win2 = makeWindow(M, 0.9, 0.85);
  win2.position.set(W / 2 + 0.06, FLOOR + 1.32, 0.7);
  win2.rotation.y = Math.PI / 2;
  g.add(win2);

  /* 老虎窗（前坡小天窗） */
  const dormer = new THREE.Group();
  dormer.add(box(1.0, 0.9, 0.8, M.wall, 0, 0, 0));
  const dWin = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.5), M.glass);
  dWin.position.set(0, 0.03, 0.41);
  dormer.add(dWin);
  dormer.add(box(0.7, 0.08, 0.1, M.darkWood, 0, 0.3, 0.42));
  dormer.add(box(0.7, 0.08, 0.1, M.darkWood, 0, -0.3, 0.42));
  dormer.add(box(0.66, 0.06, 0.1, M.darkWood, 0, 0, 0.42));
  dormer.position.set(0.55, FLOOR + H + 0.95, 1.25);
  dormer.rotation.x = 0.1;
  g.add(dormer);

  /* 烟囱 */
  g.add(box(0.82, 2.9, 0.82, M.stone, -1.55, 4.35, -0.85));
  g.add(box(1.02, 0.16, 1.02, M.stoneDark, -1.55, 5.84, -0.85));
  g.add(box(0.44, 0.12, 0.44, new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 }), -1.55, 5.9, -0.85));

  /* 门廊平台 */
  const pz = D / 2 + 1.0;
  g.add(box(4.9, 0.18, 1.95, M.plank, 0, FLOOR - 0.07, pz));
  // 平台横梁
  g.add(box(4.9, 0.14, 0.14, M.darkWood, 0, FLOOR - 0.2, pz + 0.9));
  // 石墩
  for (const x of [-2.0, 0, 2.0]) g.add(box(0.28, 0.4, 0.28, M.stone, x, 0.2, pz + 0.8));

  /* 台阶 */
  g.add(box(1.9, 0.16, 0.44, M.plank, -0.4, 0.37, pz + 1.18));
  g.add(box(2.05, 0.16, 0.44, M.plank, -0.4, 0.19, pz + 1.58));

  /* 门廊柱 */
  for (const x of [-2.15, 2.15]) {
    g.add(cyl(0.095, 0.11, 2.2, 7, M.plank, x, FLOOR + 1.1, pz + 0.82));
    // 柱础
    g.add(box(0.28, 0.16, 0.28, M.stone, x, FLOOR + 0.06, pz + 0.82));
  }
  /* 门廊顶棚 */
  g.add(box(5.2, 0.13, 2.3, M.roof, 0, 2.9, pz + 0.55, 0.1));
  g.add(box(5.0, 0.16, 0.16, M.darkWood, 0, 2.72, pz + 1.5));
  // 顶棚下的椽
  for (let i = -2; i <= 2; i++) g.add(box(0.09, 0.09, 2.2, M.darkWood, i * 1.05, 2.74, pz + 0.5, 0.1));

  /* 门廊护栏 */
  g.add(box(1.5, 0.09, 0.09, M.plank, -1.35, FLOOR + 0.75, pz + 0.9));
  g.add(box(1.5, 0.09, 0.09, M.plank, 1.35, FLOOR + 0.75, pz + 0.9));
  for (const x of [-2.06, -0.62, 2.06, 0.62]) {
    g.add(box(0.09, 0.7, 0.09, M.plank, x, FLOOR + 0.36, pz + 0.9));
  }

  /* 门廊长凳 */
  const bench = new THREE.Group();
  bench.add(box(1.2, 0.08, 0.36, M.plank, 0, 0.42, 0));
  for (const x of [-0.48, 0.48]) {
    bench.add(box(0.08, 0.42, 0.3, M.plank, x, 0.21, 0));
  }
  bench.position.set(1.35, FLOOR + 0.0, pz - 0.1);
  bench.rotation.y = 0.12;
  g.add(bench);

  /* 灯笼（门两侧） */
  const lan1 = makeLantern(M);
  lan1.position.set(-1.7, FLOOR + 1.62, D / 2 + 0.18);
  g.add(lan1);
  const lanLight = new THREE.PointLight(0xffb066, 9, 8, 2);
  lanLight.position.set(-1.7, FLOOR + 1.6, D / 2 + 0.35);
  g.add(lanLight); lights.push(lanLight);

  const lan2 = makeLantern(M);
  lan2.position.set(2.0, FLOOR + 1.55, pz + 0.62);
  lan2.scale.setScalar(0.9);
  g.add(lan2);

  /* 室内暖光 */
  const inLight = new THREE.PointLight(0xffa85c, 16, 11, 2);
  inLight.position.set(1.1, FLOOR + 1.5, 0.7);
  g.add(inLight); lights.push(inLight);
  const inLight2 = new THREE.PointLight(0xffc078, 6, 7, 2);
  inLight2.position.set(-0.6, FLOOR + 1.6, -0.9);
  g.add(inLight2); lights.push(inLight2);

  /* 门口地灯投射（照亮台阶） */
  const stepLight = new THREE.PointLight(0xffbe80, 5, 6, 2);
  stepLight.position.set(-0.4, 1.4, pz + 1.9);
  g.add(stepLight); lights.push(stepLight);

  /* 门上方木牌 */
  g.add(box(0.9, 0.32, 0.06, M.plank, -0.85, FLOOR + 2.52, D / 2 + 0.1));
  g.add(box(0.42, 0.03, 0.03, M.iron, -0.85, FLOOR + 2.4, D / 2 + 0.1));

  /* 接触阴影（贴地暗斑） */
  const contactMat = new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: T.glow, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(W + 3.2, D + 2.4), contactMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.01;
  g.add(contact);

  scene.add(g);
  return { group: g, lights, chimneyTop: new THREE.Vector3(-1.55, 5.95, -0.85), porchZ: pz };
}

/* ---------- 院子里的杂物 ---------- */
export function addYard(scene, T, M) {
  const R = rng(555);
  const g = new THREE.Group();

  /* 柴堆 */
  const logGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.15, 7);
  for (let row = 0; row < 3; row++) {
    const n = 4 - row;
    for (let i = 0; i < n; i++) {
      const log = new THREE.Mesh(logGeo, M.bark);
      log.rotation.x = Math.PI / 2;
      log.position.set(W / 2 + 0.45 + i * 0.21 + (row % 2) * 0.08, 0.12 + row * 0.19, 1.5);
      log.rotation.z = (R() - 0.5) * 0.1;
      log.castShadow = true; log.receiveShadow = true;
      g.add(log);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.1, 7), M.logEnd);
      cap.position.set(log.position.x, log.position.y, 1.5 + 0.58);
      g.add(cap);
    }
  }

  /* 木桶 */
  const barrel = new THREE.Group();
  barrel.add(cyl(0.3, 0.26, 0.62, 12, M.plank, 0, 0, 0));
  for (const y of [-0.2, 0.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 5, 14), M.iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    barrel.add(ring);
  }
  barrel.position.set(2.4, 0.31, 3.0);
  barrel.rotation.y = 0.4;
  g.add(barrel);

  /* 水桶 */
  g.add(cyl(0.19, 0.16, 0.36, 12, M.stoneDark, -2.6, 0.18, 4.2));

  /* 树桩 + 斧头 */
  const stump = cyl(0.34, 0.42, 0.5, 9, M.bark, -4.3, 0.25, 3.4);
  g.add(stump);
  const stumpTop = new THREE.Mesh(new THREE.CircleGeometry(0.33, 9), M.logEnd);
  stumpTop.rotation.x = -Math.PI / 2;
  stumpTop.position.set(-4.3, 0.51, 3.4);
  g.add(stumpTop);
  // 斧头
  const axe = new THREE.Group();
  axe.add(cyl(0.022, 0.026, 0.7, 6, M.bark, 0, 0.1, 0, 0, 0, 0.22));
  const head = box(0.03, 0.16, 0.24, M.iron, 0.02, 0.42, 0.04);
  head.rotation.z = 0.22;
  axe.add(head);
  axe.position.set(-4.15, 0.5, 3.45);
  axe.rotation.y = -0.5;
  g.add(axe);

  /* 花盆（窗台 / 台阶旁） */
  const pot = (x, y, z, s, mat) => {
    const p = cyl(0.15 * s, 0.11 * s, 0.2 * s, 10, M.terracotta, x, y, z);
    g.add(p);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15 * s, 0), mat);
    bloom.position.set(x, y + 0.19 * s, z);
    bloom.castShadow = true;
    g.add(bloom);
  };
  pot(-1.6, FLOOR + 0.6, D / 2 + 0.28, 0.9, M.flower);
  pot(1.95, 0.68, 4.55, 1.05, M.flowerY);
  pot(2.3, 0.68, 4.35, 0.8, M.flower);
  pot(-2.0, 0.1, 5.2, 1.0, M.flower);

  /* 晾衣绳 */
  const lineG = new THREE.Group();
  for (const x of [-2.2, 2.4]) {
    lineG.add(cyl(0.05, 0.065, 2.0, 6, M.bark, x, 1.0, 0));
  }
  const ropeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.2, 1.95, 0),
    new THREE.Vector3(0, 1.78, 0.06),
    new THREE.Vector3(2.4, 1.95, 0),
  ]);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 24, 0.012, 4), M.darkWood);
  lineG.add(rope);
  // 挂着的布
  for (const [x, w, h, mat] of [[-1.2, 0.55, 0.7, M.cloth], [0.1, 0.5, 0.62, M.cloth2], [1.25, 0.6, 0.75, M.cloth]]) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 5, 5), mat);
    const pos = cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w, v = pos.getY(i) / h;
      pos.setZ(i, Math.sin(u * 6.0) * 0.035 + v * 0.03);
    }
    cloth.geometry.computeVertexNormals();
    cloth.position.set(x, 1.75 - h / 2, 0.05);
    cloth.castShadow = true;
    lineG.add(cloth);
  }
  lineG.position.set(4.6, 0, -1.4);
  lineG.rotation.y = -0.55;
  g.add(lineG);

  /* 小径旁的矮栅栏 */
  for (const sx of [-1, 1]) {
    const x0 = sx * 2.75;
    for (let i = 0; i < 5; i++) {
      const z = 6.2 + i * 1.15;
      g.add(cyl(0.045, 0.055, 0.86, 5, M.plank, x0 + Math.sin(i * 1.7) * 0.06, 0.43, z));
    }
    g.add(box(0.055, 0.07, 4.7, M.plank, x0, 0.64, 8.5, 0, 0, 0.01));
    g.add(box(0.055, 0.07, 4.7, M.plank, x0, 0.33, 8.5, 0, 0, -0.01));
  }

  /* 屋边蘑菇 */
  for (let i = 0; i < 9; i++) {
    const x = -4.6 + R() * 1.2, z = 2.2 + R() * 1.6;
    const s = 0.5 + R() * 0.7;
    const stem = cyl(0.035 * s, 0.045 * s, 0.16 * s, 6, M.cloth, x, 0.08 * s, z);
    g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.flower);
    cap.position.set(x, 0.16 * s, z);
    cap.castShadow = true;
    g.add(cap);
  }

  scene.add(g);
  return g;
}
