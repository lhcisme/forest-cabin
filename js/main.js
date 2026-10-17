import * as THREE from 'three';
import { buildWorld, heightAt } from './world.js';
import { createPost } from './post.js';

const canvas = document.getElementById('c');
const boot = document.getElementById('boot');
const btnCam = document.getElementById('btnCam');
const btnQ = document.getElementById('btnQ');
const hint = document.getElementById('hint');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', alpha: false,
});
let quality = 'high';
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = buildWorld();
const scene = world.scene;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
const camLook = new THREE.Vector3(0, 2.2, 0);

/* ---------- 相机路径 ---------- */
const SPEED = 0.0165;
const pathPts = [
  [1.6, 19.5], [-1.4, 15.0], [1.4, 10.6], [2.8, 7.4], [-4.8, 7.8], [-8.7, 3.0],
  [-6.9, -4.3], [0.6, -8.3], [7.4, -4.7], [8.9, 2.6], [5.6, 7.2], [2.9, 12.8],
].map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 1.72, z));
const camCurve = new THREE.CatmullRomCurve3(pathPts, true, 'catmullrom', 0.5);
const autoTmp = new THREE.Vector3();
const desTmp = new THREE.Vector3();
const lookTmp = new THREE.Vector3();

/* ---------- 手动轨道 ---------- */
const orbit = {
  target: new THREE.Vector3(0, 2.15, 0),
  theta: 0, phi: 1.32, radius: 11,
};
let auto = true;
let autoPhase = 0;
let elapsed = 0;
let dragging = false;
let lastPointer = { x: 0, y: 0 };

function syncOrbit() {
  const p = camera.position.clone().sub(orbit.target);
  orbit.radius = Math.max(5, Math.min(22, p.length()));
  orbit.theta = Math.atan2(p.x, p.z);
  orbit.phi = Math.acos(THREE.MathUtils.clamp(p.y / orbit.radius, -1, 1));
}
function nearestPhase(pos) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 240; i++) {
    const u = i / 240;
    camCurve.getPointAt(u, autoTmp);
    const d = autoTmp.distanceToSquared(pos);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
function setAuto(on) {
  if (on === auto) return;
  if (on) {
    syncOrbit();
    autoPhase = nearestPhase(camera.position);
  }
  auto = on;
  btnCam.textContent = auto ? '运镜 · 自动' : '运镜 · 手动';
  btnCam.classList.toggle('on', auto);
}

/* ---------- 交互 ---------- */
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPointer = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture?.(e.pointerId);
  setAuto(false);
  hideHint();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  lastPointer = { x: e.clientX, y: e.clientY };
  orbit.theta -= dx * 0.0055;
  orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.0045, 0.55, 1.52);
});
const endDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', endDrag);

let pinchStart = 0;
const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) { pinchStart = touchDist(e.touches); setAuto(false); }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const d = touchDist(e.touches);
    if (pinchStart > 0) {
      orbit.radius = THREE.MathUtils.clamp(orbit.radius * (pinchStart / d), 5, 21);
      pinchStart = d;
    }
    e.preventDefault();
  }
}, { passive: false });
canvas.addEventListener('wheel', (e) => {
  orbit.radius = THREE.MathUtils.clamp(orbit.radius * (1 + e.deltaY * 0.0012), 5, 21);
  setAuto(false);
  e.preventDefault();
}, { passive: false });

let hintTimer = setTimeout(hideHint, 6000);
function hideHint() {
  if (!hint) return;
  hint.classList.add('hide');
  clearTimeout(hintTimer);
}

btnCam.addEventListener('click', () => {
  setAuto(!auto);
  hideHint();
});

btnQ.addEventListener('click', () => {
  quality = quality === 'high' ? 'low' : 'high';
  applyQuality();
  btnQ.textContent = quality === 'high' ? '画质 · 高' : '画质 · 流畅';
  btnQ.classList.toggle('on', quality === 'high');
});

function applyQuality() {
  pixelRatio = quality === 'high'
    ? Math.min(window.devicePixelRatio || 1, 1.6)
    : Math.min(window.devicePixelRatio || 1, 1.15);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setPixelRatio(pixelRatio);
  post.setSize(window.innerWidth, window.innerHeight);
  post.bloom.enabled = quality === 'high';
  const size = quality === 'high' ? 2048 : 1024;
  const sun = world.lights.sun;
  sun.shadow.mapSize.set(size, size);
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  world.setPixelRatio(pixelRatio);
}

/* ---------- 后期 ---------- */
const post = createPost(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight);
btnCam.classList.add('on');
btnQ.classList.add('on');

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.setSize(w, h);
}
window.addEventListener('resize', onResize);

/* ---------- 起手位置 ---------- */
camCurve.getPointAt(0.02, camera.position);
camera.position.y += 0.15;
camera.lookAt(camLook);

/* ---------- 循环 ---------- */
let rafId = 0;
let prev = performance.now();
let firstFrame = true;

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0001, (now - prev) / 1000));
  prev = now;
  if (document.hidden) return;
  elapsed += dt;

  if (auto) {
    autoPhase = (autoPhase + dt * SPEED) % 1;
    camCurve.getPointAt(autoPhase, desTmp);
    desTmp.x += Math.sin(elapsed * 0.63) * 0.05;
    desTmp.y += Math.sin(elapsed * 0.87) * 0.035;
    lookTmp.set(
      0.25 * Math.sin(elapsed * 0.19),
      2.2 + 0.18 * Math.sin(elapsed * 0.23),
      0.15 * Math.cos(elapsed * 0.17)
    );
    camLook.lerp(lookTmp, 1 - Math.exp(-dt * 1.4));
  } else {
    const sp = Math.sin(orbit.phi);
    desTmp.set(
      orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    camLook.lerp(orbit.target, 1 - Math.exp(-dt * 6));
  }

  const k = 1 - Math.exp(-dt * (auto ? 2.2 : 9));
  camera.position.lerp(desTmp, k);
  const minY = heightAt(camera.position.x, camera.position.z) + 0.45;
  if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(camLook);

  world.update(dt, elapsed);
  post.render(elapsed);

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => {
      boot.classList.add('hide');
      setTimeout(() => boot.remove(), 1400);
    });
  }
}
rafId = requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  prev = performance.now();
});
