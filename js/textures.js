import * as THREE from 'three';

/* ---------- 随机 / 工具 ---------- */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a = 0, b = 255) => (v < a ? a : v > b ? b : v);
function hexToRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function shade(h, d) {
  const [r, g, b] = hexToRgb(h).map((v) => clamp(v + d));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  return c;
}
function texFrom(cv, rx, ry, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
function pair(cv, rx, ry) {
  return { map: texFrom(cv, rx, ry, true), bump: texFrom(cv, rx, ry, false) };
}
function spots(g, w, h, R, n, alpha, size) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = size * (0.3 + R());
    const dark = R() > 0.45;
    g.fillStyle = dark ? `rgba(0,0,0,${alpha * (0.4 + R())})` : `rgba(255,240,210,${alpha * 0.5 * R()})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
}

/* ---------- 木板墙 ---------- */
function woodCanvas({ base, plank, seed, dark }) {
  const R = rng(seed);
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += plank) {
      const v = (R() - 0.5) * 26;
      g.fillStyle = shade(base, v); g.fillRect(i, 0, plank, h);
      // 年轮 / 纤维
      for (let k = 0; k < 30; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.025 + R() * 0.07})`;
        g.lineWidth = 0.5 + R() * 1.1;
        g.beginPath();
        let x = i + 2 + R() * (plank - 4);
        g.moveTo(x, 0);
        for (let y = 0; y <= h; y += 12) {
          x += (R() - 0.5) * 1.4;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      // 结疤
      if (R() > 0.55) {
        const ky = R() * h, kx = i + plank * (0.3 + R() * 0.4);
        for (let r = 5; r > 0; r--) {
          g.strokeStyle = `rgba(30,18,10,${0.18 + r * 0.04})`;
          g.lineWidth = 1.1;
          g.beginPath(); g.ellipse(kx, ky, r * 1.5, r * 2.6, 0, 0, 7); g.stroke();
        }
      }
      // 板缝
      g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(i, 0, 2, h);
      g.fillStyle = 'rgba(255,238,210,0.06)'; g.fillRect(i + 2, 0, 1.5, h);
      // 钉子
      for (const y of [14, h - 18]) {
        g.fillStyle = 'rgba(18,12,6,0.55)';
        g.beginPath(); g.arc(i + plank * 0.5, y + R() * 6, 1.7, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,230,190,0.12)';
        g.beginPath(); g.arc(i + plank * 0.5 - 0.6, y + R() * 6 - 0.6, 1, 0, 7); g.fill();
      }
    }
    spots(g, w, h, R, 380, 0.09, 2.2);
    if (dark) {
      const grd = g.createLinearGradient(0, h, 0, 0);
      grd.addColorStop(0, 'rgba(20,14,10,0.30)');
      grd.addColorStop(1, 'rgba(20,14,10,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }
  });
}

/* ---------- 屋顶木瓦 ---------- */
function roofCanvas() {
  const R = rng(77);
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#3b3129'; g.fillRect(0, 0, w, h);
    const rowH = 42;
    for (let row = 0, y = 0; y < h; y += rowH, row++) {
      const off = (row % 2) * 34;
      for (let x = -68 + off; x < w; x += 68) {
        const v = (R() - 0.5) * 34;
        g.fillStyle = shade('#463a2f', v);
        g.fillRect(x + 2, y + 2, 64, rowH - 2);
        g.fillStyle = `rgba(0,0,0,${0.25 + R() * 0.2})`;
        g.fillRect(x + 2, y + rowH - 4, 64, 3);
        g.fillStyle = 'rgba(255,235,205,0.05)';
        g.fillRect(x + 2, y + 2, 64, 2);
        for (let i = 0; i < 6; i++) {
          g.strokeStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`;
          g.lineWidth = 0.8;
          g.beginPath();
          const sx = x + 6 + R() * 56;
          g.moveTo(sx, y + 4);
          g.lineTo(sx + (R() - 0.5) * 12, y + rowH - 6);
          g.stroke();
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 2.5);
    }
    spots(g, w, h, R, 620, 0.12, 2.4);
    // 苔藓
    for (let i = 0; i < 50; i++) {
      const x = R() * w, y = R() * h, r = 4 + R() * 16;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(86,104,56,${0.10 + R() * 0.14})`);
      grd.addColorStop(1, 'rgba(86,104,56,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
}

/* ---------- 石基 ---------- */
function stoneCanvas() {
  const R = rng(31);
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#3d3a37'; g.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const rh = 44 + R() * 26;
      let x = -30 + R() * 30;
      while (x < w) {
        const bw = 52 + R() * 70;
        const v = (R() - 0.5) * 40;
        g.fillStyle = shade('#5b5750', v);
        g.fillRect(x + 3, y + 3, bw - 5, rh - 5);
        const grd = g.createLinearGradient(x, y, x, y + rh);
        grd.addColorStop(0, 'rgba(255,250,235,0.10)');
        grd.addColorStop(1, 'rgba(0,0,0,0.22)');
        g.fillStyle = grd; g.fillRect(x + 3, y + 3, bw - 5, rh - 5);
        spots(g, w, h, R, 0, 0, 0);
        for (let i = 0; i < 24; i++) {
          g.fillStyle = `rgba(${R() > 0.5 ? '255,255,240' : '20,18,16'},${0.04 + R() * 0.1})`;
          g.beginPath();
          g.arc(x + 4 + R() * (bw - 10), y + 4 + R() * (rh - 10), 0.8 + R() * 2.4, 0, 7);
          g.fill();
        }
        x += bw;
      }
      y += rh;
    }
    for (let i = 0; i < 26; i++) {
      const x = R() * w, yy = R() * h, r = 6 + R() * 20;
      const grd = g.createRadialGradient(x, yy, 0, x, yy, r);
      grd.addColorStop(0, `rgba(74,92,50,${0.06 + R() * 0.12})`);
      grd.addColorStop(1, 'rgba(74,92,50,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, yy, r, 0, 7); g.fill();
    }
  });
}

/* ---------- 树皮 ---------- */
function barkCanvas() {
  const R = rng(97);
  return canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#4a3929'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      const x = R() * w;
      g.strokeStyle = R() > 0.4 ? `rgba(20,14,8,${0.2 + R() * 0.35})` : `rgba(150,120,88,${0.05 + R() * 0.13})`;
      g.lineWidth = 0.8 + R() * 3.2;
      g.beginPath();
      let xx = x;
      g.moveTo(xx, 0);
      for (let y = 0; y <= h; y += 20) {
        xx += (R() - 0.5) * 5;
        g.lineTo(xx, y);
      }
      g.stroke();
    }
    spots(g, w, h, R, 260, 0.14, 2);
  });
}

/* ---------- 地面（泥土 + 落叶） ---------- */
function groundCanvas() {
  const R = rng(5);
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#3c3324'; g.fillRect(0, 0, w, h);
    // 苔绿斑块
    for (let i = 0; i < 120; i++) {
      const x = R() * w, y = R() * h, r = 12 + R() * 60;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${60 + R() * 40},${74 + R() * 40},${38 + R() * 20},${0.12 + R() * 0.2})`);
      grd.addColorStop(1, 'rgba(60,80,40,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // 落叶
    for (let i = 0; i < 900; i++) {
      const x = R() * w, y = R() * h, s = 1.5 + R() * 4;
      const c = ['#8a6234', '#a4763f', '#6b4a2a', '#b5893f', '#5d4a2a', '#8c7a33'][(R() * 6) | 0];
      g.save(); g.translate(x, y); g.rotate(R() * 7);
      g.fillStyle = c; g.globalAlpha = 0.35 + R() * 0.5;
      g.beginPath(); g.ellipse(0, 0, s, s * 0.55, 0, 0, 7); g.fill();
      g.restore();
    }
    // 小石子
    for (let i = 0; i < 300; i++) {
      const x = R() * w, y = R() * h, s = 1 + R() * 3;
      g.fillStyle = `rgba(${110 + R() * 60},${106 + R() * 55},${98 + R() * 50},${0.35 + R() * 0.4})`;
      g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    }
    spots(g, w, h, R, 700, 0.16, 3);
  });
}

/* ---------- 小径 ---------- */
function pathCanvas() {
  const R = rng(19);
  return canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#6a573f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) {
      const x = R() * w, y = R() * h, r = 1 + R() * 5;
      g.fillStyle = `rgba(${90 + R() * 70},${80 + R() * 60},${62 + R() * 50},${0.25 + R() * 0.5})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 70; i++) {
      const x = R() * w, y = R() * h, s = 2 + R() * 5;
      g.fillStyle = `rgba(${120 + R() * 60},${114 + R() * 55},${104 + R() * 50},0.55)`;
      g.beginPath(); g.ellipse(x, y, s, s * 0.7, R() * 7, 0, 7); g.fill();
    }
    // 车辙印
    for (const cx of [w * 0.3, w * 0.7]) {
      g.strokeStyle = 'rgba(40,30,20,0.14)'; g.lineWidth = 14;
      g.beginPath();
      for (let y = 0; y <= h; y += 24) g.lineTo(cx + Math.sin(y * 0.02) * 5, y);
      g.stroke();
    }
  });
}

/* ---------- 发光窗 ---------- */
function windowCanvas() {
  const R = rng(23);
  return canvas(256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, w * 0.8);
    grd.addColorStop(0, '#fff3d2');
    grd.addColorStop(0.45, '#ffce8a');
    grd.addColorStop(0.8, '#d98a45');
    grd.addColorStop(1, '#7a4423');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // 室内剪影：桌子 / 花瓶
    g.fillStyle = 'rgba(60,28,12,0.55)';
    g.fillRect(w * 0.1, h * 0.66, w * 0.32, h * 0.34);
    g.beginPath(); g.ellipse(w * 0.68, h * 0.72, w * 0.1, h * 0.16, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,20,10,0.35)';
    g.fillRect(0, h * 0.9, w, h * 0.1);
    // 玻璃反光
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.moveTo(-20 + i * 60, h); g.lineTo(60 + i * 60, 0); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,220,170,${R() * 0.08})`;
      g.beginPath(); g.arc(R() * w, R() * h, R() * 3, 0, 7); g.fill();
    }
  });
}

/* ---------- 粒子贴图 ---------- */
function softDotCanvas() {
  return canvas(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}
function smokeCanvas() {
  const R = rng(41);
  return canvas(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w * (0.3 + R() * 0.4), y = h * (0.3 + R() * 0.4), r = 26 + R() * 62;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.05 + R() * 0.08})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
}
function foliageCanvas() {
  const R = rng(63);
  return canvas(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cols = ['#4a6a32', '#3d5a2a', '#57743a', '#2f4a24', '#6a8043'];
    for (let i = 0; i < 26; i++) {
      const x = w * (0.15 + R() * 0.7);
      const y = h * (0.05 + R() * 0.6);
      const len = 60 + R() * 110;
      g.strokeStyle = cols[(R() * cols.length) | 0];
      g.lineWidth = 3 + R() * 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y + len * 0.5);
      g.quadraticCurveTo(x + (R() - 0.5) * 50, y + len * 0.2, x + (R() - 0.5) * 90, y);
      g.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const x = w * (0.12 + R() * 0.76), y = h * (0.1 + R() * 0.75);
      g.fillStyle = cols[(R() * cols.length) | 0];
      g.globalAlpha = 0.6;
      g.beginPath(); g.ellipse(x, y, 3 + R() * 6, 1.5 + R() * 3, R() * 7, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
  });
}
function glowCanvas() {
  return canvas(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,214,150,0.9)');
    grd.addColorStop(0.18, 'rgba(255,186,110,0.42)');
    grd.addColorStop(0.55, 'rgba(255,150,70,0.09)');
    grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

/* ---------- 导出 ---------- */
export function makeTextures() {
  const wall = pair(woodCanvas({ base: '#6b4a31', plank: 84, seed: 11, dark: true }), 3.2, 1.4);
  const plank = pair(woodCanvas({ base: '#5c4028', plank: 64, seed: 44, dark: false }), 1, 1);
  const roof = pair(roofCanvas(), 2, 2);
  const stone = pair(stoneCanvas(), 3, 2);
  const bark = pair(barkCanvas(), 1, 1.6);
  const ground = pair(groundCanvas(), 34, 34);
  const path = pair(pathCanvas(), 1.1, 3);
  const win = texFrom(windowCanvas(), 1, 1, true);
  const dot = texFrom(softDotCanvas(), 1, 1, true);
  const smoke = texFrom(smokeCanvas(), 1, 1, true);
  const foliage = texFrom(foliageCanvas(), 1, 1, true);
  const glow = texFrom(glowCanvas(), 1, 1, true);
  return { wall, plank, roof, stone, bark, ground, path, win, dot, smoke, foliage, glow };
}
