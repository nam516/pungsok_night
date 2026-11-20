// 학동로46길 25 빌딩. 지하 1층, 지상 4층의 영상 제작사 건물과 앞길
// 사용자가 준 4층 평면도, 엘리베이터 층 안내판 사진을 바탕으로 만들었다. 회사 이름은 가상(스튜디오 풍논)
// 앞길, 층마다, 엘리베이터 안을 각각 멀리 떨어진 자리에 만든다(안개에 가려 서로 안 보임)
// 층을 옮기면 그 자리로 순간이동한다. 사람 높이는 어디서나 0 이라 기존 이동 코드를 그대로 쓴다
// 구역 코드: B0 앞길, BM 지하 1층, B1~B4 지상 1~4층, EV 엘리베이터 안
import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { gridPath } from './path.js';

const BX = -140;
const FLOOR_GAP = 60;
const rnd = (a, b) => a + Math.random() * (b - a);

export const ZONE_NAMES = {
  B0: '학동로46길 25 앞',
  BM: 'B1 시사실·R&D',
  B1: '1F 로비·주차장',
  B2: '2F COMP·3D·ART',
  B3: '3F CGI실',
  B4: '4F 대표실·재무·경영지원',
  EV: '엘리베이터',
};
// 엘리베이터 안내판 순서(위층부터)와 층 번호, 층별 부서
export const FLOORS = ['B4', 'B3', 'B2', 'B1', 'BM'];
export const FLOOR_NO = { B4: '4', B3: '3', B2: '2', B1: '1', BM: '-1' };
export const DIRECTORY = {
  B4: ['대표실', 'CFO실', '재무팀', '경영지원팀', '신사업실', '회의실', '테라스'],
  B3: ['CGI 1실', 'CGI 2실', 'CGI 3실', '서버실'],
  B2: ['COMP 1실, 2실, 3실', 'DP팀', 'COMP팀', '3D팀', 'ART팀', 'Specialist실'],
  B1: ['로비 / 주차장'],
  BM: ['R&D Center', '인사총무팀', '시사실 1', '시사실 2', '시사실 3'],
};
const UP = { BM: 'B1', B1: 'B2', B2: 'B3', B3: 'B4' };
const DOWN = { B1: 'BM', B2: 'B1', B3: 'B2', B4: 'B3' };
const SLOT = { B1: 1, B2: 2, B3: 3, B4: 4, BM: 5, EV: 6 };

const matCache = new Map();
function std(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }));
  return matCache.get(key);
}
function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 글자 판. lines 는 [글자, 크기, 색] 목록
function textTex(w, h, bg, lines, border) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 6;
      g.strokeRect(6, 6, w - 12, h - 12);
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const total = lines.reduce((a, l) => a + l[1] * 1.25, 0);
    let y = h / 2 - total / 2;
    for (const [text, size, color] of lines) {
      y += size * 0.625;
      g.font = `700 ${size}px "Gowun Dodum", sans-serif`;
      // 판보다 길면 글자를 줄인다
      const fit = Math.min(1, (w * 0.9) / Math.max(1, g.measureText(text).width));
      if (fit < 1) g.font = `700 ${Math.floor(size * fit)}px "Gowun Dodum", sans-serif`;
      g.fillStyle = color;
      g.fillText(text, w / 2, y);
      y += size * 0.625;
    }
  });
}

// 밤 도시 창밖 풍경
function cityTex() {
  return canvasTex(256, 128, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1230');
    sky.addColorStop(1, '#2a1c3a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const bw = 14 + Math.random() * 22;
      const bh = 30 + Math.random() * 80;
      const x = Math.random() * w;
      g.fillStyle = '#121626';
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = Math.random() < 0.5 ? '#ffd98a' : '#9fd0ff';
      for (let k = 0; k < 10; k++) if (Math.random() < 0.45) g.fillRect(x + 2 + Math.random() * (bw - 6), h - bh + 4 + Math.random() * (bh - 8), 3, 3);
    }
  });
}

// 모니터 화면. 0 타임라인, 1 노드 그래프(합성), 2 컬러 휠, 3 3D 와이어프레임, 4 엑셀, 5 그림
function screenTex(kind) {
  return canvasTex(160, 96, (g, w, h) => {
    g.fillStyle = kind === 4 ? '#f4f6f8' : kind === 5 ? '#f6f1e8' : '#0d1018';
    g.fillRect(0, 0, w, h);
    if (kind === 0) {
      g.fillStyle = '#1b2233';
      g.fillRect(0, 0, w, 40);
      g.fillStyle = '#6fa8ff';
      g.fillRect(10, 8, 60, 24);
      g.fillStyle = '#ffb36f';
      g.fillRect(74, 8, 40, 24);
      const cols = ['#5bd18a', '#ff6f9f', '#b48aff', '#ffd36f'];
      for (let r = 0; r < 4; r++) {
        let x = 4;
        while (x < w - 10) {
          const len = 12 + Math.random() * 40;
          g.fillStyle = cols[r];
          g.fillRect(x, 46 + r * 12, len, 9);
          x += len + 3;
        }
      }
      g.fillStyle = '#ff3b3b';
      g.fillRect(96, 42, 2, 54);
    } else if (kind === 1) {
      g.strokeStyle = '#7fd0ff';
      g.lineWidth = 2;
      const nodes = [];
      for (let i = 0; i < 7; i++) nodes.push([14 + i * 20, 20 + Math.random() * 56]);
      g.beginPath();
      nodes.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      for (const [x, y] of nodes) {
        g.fillStyle = '#2a3550';
        g.fillRect(x - 9, y - 6, 18, 12);
        g.fillStyle = '#ffd36f';
        g.fillRect(x - 9, y - 6, 18, 3);
      }
    } else if (kind === 2) {
      for (let i = 0; i < 3; i++) {
        const cx = 30 + i * 50;
        const grad = g.createRadialGradient(cx, 50, 2, cx, 50, 20);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, ['#ff4a4a', '#4aff8a', '#4a8aff'][i]);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, 50, 20, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === 3) {
      g.strokeStyle = '#5bd18a';
      g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        g.beginPath();
        g.moveTo(20 + i * 12, 80);
        g.lineTo(60 + i * 4, 30);
        g.stroke();
        g.beginPath();
        g.moveTo(20, 80 - i * 5);
        g.lineTo(140, 80 - i * 5);
        g.stroke();
      }
      g.strokeStyle = '#ff9f6f';
      g.lineWidth = 2;
      g.strokeRect(62, 22, 36, 30);
    } else if (kind === 4) {
      g.fillStyle = '#2e7d4f';
      g.fillRect(0, 0, w, 12);
      g.strokeStyle = '#c8ccd2';
      for (let y = 18; y < h; y += 9) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let x = 30; x < w; x += 32) {
        g.beginPath();
        g.moveTo(x, 12);
        g.lineTo(x, h);
        g.stroke();
      }
      g.fillStyle = '#4a7ac0';
      for (let i = 0; i < 4; i++) g.fillRect(100 + i * 12, 80 - (10 + Math.random() * 40), 8, 10 + Math.random() * 40);
    } else {
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = ['#e0607a', '#4a7ac0', '#e0a040', '#5bb08a', '#8a5ad0'][i];
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(20 + Math.random() * 40, 20 + Math.random() * 60);
        g.bezierCurveTo(60, Math.random() * 96, 100, Math.random() * 96, 130 + Math.random() * 20, 20 + Math.random() * 60);
        g.stroke();
      }
    }
  });
}

// 영화 포스터. 이 게임 캐릭터들로 만든 가짜 포스터
function posterTex(title, sub, c1, c2) {
  return canvasTex(128, 180, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.arc(w / 2, 82, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = '700 17px "Gowun Dodum", sans-serif';
    g.fillText(title, w / 2, 146);
    g.font = '11px sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText(sub, w / 2, 166);
  });
}

// 엘리베이터 벽의 헤어라인 스테인리스
function hairlineTex() {
  const t = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#b9bdc4');
    gr.addColorStop(0.5, '#d6d9de');
    gr.addColorStop(1, '#aeb2b9');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,64,70'},${0.05 + Math.random() * 0.12})`;
      g.fillRect(x, 0, 1, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 층 안내판. 엘리베이터 사진처럼 검은 판에 큰 층 번호와 부서 목록
function directoryTex() {
  return canvasTex(360, 560, (g, w, h) => {
    g.fillStyle = '#1e1f23';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = '700 30px sans-serif';
    g.fillText('스튜디오 풍논', w / 2, 52);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.5;
    let y = 74;
    for (const code of FLOORS) {
      const lines = DIRECTORY[code];
      const rowH = Math.max(70, lines.length * 17 + 22);
      g.beginPath();
      g.moveTo(90, y);
      g.lineTo(w - 24, y);
      g.stroke();
      g.textAlign = 'left';
      g.font = '700 54px sans-serif';
      g.fillText(FLOOR_NO[code], code === 'BM' ? 22 : 38, y + rowH / 2 + 19);
      g.font = '15px sans-serif';
      lines.forEach((t, i) => g.fillText(t, 120, y + 22 + i * 17 + (rowH - lines.length * 17 - 14) / 2));
      y += rowH;
    }
  });
}

// 조직도. 사용자가 준 4층 사람들
function orgTex() {
  return canvasTex(300, 260, (g, w, h) => {
    g.fillStyle = '#fbfaf6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2a2e';
    g.lineWidth = 2;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#2a2a2e';
    g.textAlign = 'center';
    g.font = '700 26px "Gowun Dodum", sans-serif';
    g.fillText('조직도', w / 2, 46);
    const rows = [['대표', '강아지 장'], ['상무', '희동'], ['팀장', '연구리'], ['사원', '풍순'], ['고문', '주피'], ['인턴', '풍준 / 풍열']];
    rows.forEach(([a, b], i) => {
      const y = 64 + i * 30;
      g.strokeRect(30, y, 90, 30);
      g.strokeRect(120, y, 150, 30);
      g.font = '18px "Gowun Dodum", sans-serif';
      g.fillText(a, 75, y + 21);
      g.fillText(b, 195, y + 21);
    });
  });
}

// 바닥 결. 데크, 주차장, 화강석
function stripeTex(c1, c2, n, vertical) {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.fillStyle = c2;
    for (let i = 0; i < n; i++) {
      if (vertical) g.fillRect((i * w) / n, 0, 2, h);
      else g.fillRect(0, (i * h) / n, w, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckleTex(base, dots) {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = dots[i % dots.length];
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildBuilding(scene) {
  const zones = {};
  const picks = [];
  const anim = { leds: [], ledA: basic(0x4aff8a), ledB: basic(0x0a2a14), screens: [], t: 0 };
  const glassM = new THREE.MeshStandardMaterial({ color: 0xa8c8d8, transparent: true, opacity: 0.13, roughness: 0.1, depthWrite: false });
  const frameM = std(0x6a6e76, { roughness: 0.5 });
  const capM = std(0xb8bcc4, { roughness: 0.5 });
  const city = cityTex();
  // 흰 화면(엑셀, 그림)은 번지지 않게 살짝 어둡게
  const screens = [0, 1, 2, 3, 4, 5].map((k) => new THREE.MeshBasicMaterial({ map: screenTex(k), color: k >= 4 ? 0x8a8a8a : 0xffffff }));

  // 구역 하나. 지역 좌표로 만들고 바깥 좌표로 바꿔 둔다
  function zone(code, cx, cz, bounds) {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    const Z = {
      code,
      name: ZONE_NAMES[code],
      c: new THREE.Vector3(cx, 0, cz),
      bounds: { x0: cx + bounds[0], x1: cx + bounds[1], z0: cz + bounds[2], z1: cz + bounds[3] },
      obstacles: [],
      triggers: [],
      spawn: {},
      spots: {},
      // 사람이 앉을 수 있는 자리. id 는 구역 코드:순번이라 모든 화면에서 같다
      seats: [],
      seatByKey: {},
      lights: [],
      g,
    };
    Z.block = (x0, x1, z0, z1) => Z.obstacles.push({ x0: cx + x0, x1: cx + x1, z0: cz + z0, z1: cz + z1 });
    // kind: go(다른 구역 to 의 key 자리로), shop(가게로), elev(엘리베이터 타기)
    Z.trigger = (kind, x0, x1, z0, z1, to, key) => Z.triggers.push({ id: code + kind + Z.triggers.length, kind, to, key, x0: cx + x0, x1: cx + x1, z0: cz + z0, z1: cz + z1 });
    Z.at = (key, x, z, yaw = 0) => (Z.spawn[key] = { x: cx + x, z: cz + z, yaw });
    // 일하는 사람 자리. sit 이면 의자에 앉는다
    Z.spot = (key, x, z, yaw = 0, sit = true) => (Z.spots[key] = { x: cx + x, z: cz + z, yaw, sit });
    Z.light = (x, y, z, color, intensity, dist) => Z.lights.push({ pos: new THREE.Vector3(cx + x, y, cz + z), color, intensity, dist });
    zones[code] = Z;
    return Z;
  }
  const box = (g, w, h, d, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const cyl = (g, rt, rb, h, m, x, y, z, seg = 14) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  const plane = (g, w, h, m, x, y, z, rx = 0, ry = 0) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, 0);
    g.add(o);
    return o;
  };
  const floorPlane = (g, w, d, m, x, z) => {
    const o = plane(g, w, d, m, x, 0, z, -Math.PI / 2);
    o.receiveShadow = true;
    return o;
  };
  // 글자 판. 기본은 앞(+z)을 본다
  const sign = (g, text, x, y, z, w = 1.6, ry = 0, bg = '#1c1d22', fg = '#ffffff') => {
    const h = w * 0.28;
    return plane(g, w, h, new THREE.MeshBasicMaterial({ map: textTex(Math.round(w * 200), Math.round(h * 200), bg, [[text, Math.round(h * 120), fg]]) }), x, y, z, 0, ry);
  };
  // 누르면 그 자리로 걸어가는 바닥. 합치지 않고 따로 둔다
  const pickFloor = (Z, w, d, x, z) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ visible: false }));
    o.rotation.x = -Math.PI / 2;
    o.position.set(Z.c.x + x, 0.002, Z.c.z + z);
    o.userData.bfloor = Z.code;
    scene.add(o);
    picks.push(o);
  };
  const pickBox = (Z, w, h, d, x, y, z, data) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    o.position.set(Z.c.x + x, y, Z.c.z + z);
    Object.assign(o.userData, data);
    scene.add(o);
    picks.push(o);
  };

  // 앉을 수 있는 자리 하나. 의자 자리에 누르는 상자를 둔다
  const addSeat = (Z, x, z, yaw, key) => {
    const seat = { id: Z.code + ':' + Z.seats.length, zone: Z.code, x: Z.c.x + x, z: Z.c.z + z, yaw, occupant: null };
    Z.seats.push(seat);
    if (key) Z.seatByKey[key] = seat;
    pickBox(Z, 0.7, 1.1, 0.7, x, 0.55, z, { oseat: seat });
    return seat;
  };

  const plant = (g, x, z, s = 1) => {
    cyl(g, 0.28 * s, 0.22 * s, 0.5 * s, std(0xe8e2d6), x, 0.25 * s, z);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), std(0x2f6a3a, { roughness: 0.9 }));
      leaf.position.set(x + Math.cos(i) * 0.16 * s, (0.75 + (i % 3) * 0.22) * s, z + Math.sin(i) * 0.16 * s);
      g.add(leaf);
    }
  };

  // ---------- 벽 ----------
  // 벽 한 줄. 가로(x 방향)는 z 위치, 세로(z 방향)는 x 위치에 세운다. gaps 는 문 자리
  // kind: low(허리 높이 + 위는 유리), full(천장까지), solid(허리 높이만), glass(통유리)
  const WALL_T = 0.18;
  function wallRun(Z, g, along, at, a0, a1, gaps, kind, m) {
    const segs = [];
    let s = a0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (g0 > s) segs.push([s, g0]);
      s = Math.max(s, g1);
    }
    if (s < a1) segs.push([s, a1]);
    for (const [s0, s1] of segs) {
      const len = s1 - s0;
      const mid = (s0 + s1) / 2;
      const put = (h, y, mm, t = 0.12) => (along === 'x' ? box(g, len, h, t, mm, mid, y, at) : box(g, t, h, len, mm, at, y, mid));
      if (kind === 'full') put(2.8, 1.4, m);
      else if (kind === 'solid') put(1.1, 0.55, m);
      else if (kind === 'glass') {
        const o = put(2.6, 1.3, glassM, 0.04);
        o.castShadow = false;
        put(0.08, 2.6, frameM, 0.1);
        put(0.08, 0.04, frameM, 0.1);
      } else {
        put(1.0, 0.5, m);
        put(0.04, 1.02, capM, 0.16);
      }
      if (along === 'x') Z.block(s0, s1, at - WALL_T, at + WALL_T);
      else Z.block(at - WALL_T, at + WALL_T, s0, s1);
    }
    // 문틀
    if (kind === 'full' || kind === 'glass')
      for (const [g0, g1] of gaps) {
        for (const e of [g0, g1]) {
          if (e <= a0 || e >= a1) continue;
          if (along === 'x') box(g, 0.06, 2.3, 0.14, frameM, e, 1.15, at);
          else box(g, 0.14, 2.3, 0.06, frameM, at, 1.15, e);
        }
      }
  }

  // ---------- 가구 ----------
  const deskM = std(0xf2f0ea, { roughness: 0.5 });
  const legM = std(0x3a3c42);
  const monM = std(0x15161a, { roughness: 0.4 });
  const chairM = std(0x2a2c34, { roughness: 0.8 });
  const woodM = std(0x7a4e32, { roughness: 0.55 });
  const sofaM = std(0x3a4a5a, { roughness: 0.9 });

  // tilt 이면 등받이를 뒤로 젖힌다(반쯤 누운 자리)
  const chair = (g, x, z, yaw, m = chairM, tilt = 0) => {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    box(g, 0.5, 0.08, 0.5, m, x, 0.45, z);
    const back = box(g, 0.5, 0.52, 0.07, m, x - fx * (0.24 + tilt * 0.3), 0.76 - tilt * 0.08, z - fz * (0.24 + tilt * 0.3), yaw);
    if (tilt) back.rotation.x = -tilt;
    cyl(g, 0.03, 0.03, 0.42, legM, x, 0.21, z, 6);
    box(g, 0.5, 0.04, 0.08, legM, x, 0.03, z);
    box(g, 0.08, 0.04, 0.5, legM, x, 0.03, z);
  };
  // 사무 책상. 모니터는 앞(+z)을 보고 사람은 그 앞 의자에 등을 보이고 앉는다
  // front 면 반대로 사람이 앞(+z)을 보고 앉는다. tilt 는 의자 등받이 젖힘
  function desk(Z, g, key, x, z, kind = 0, dual = true, front = false, tilt = 0) {
    const f = front ? -1 : 1;
    box(g, 1.1, 0.05, 0.6, deskM, x, 0.74, z);
    for (const dx of [-0.5, 0.5]) box(g, 0.05, 0.72, 0.55, legM, x + dx, 0.36, z);
    const mons = dual ? [x - 0.26, x + 0.26] : [x];
    const mw = dual ? 0.48 : 0.62;
    mons.forEach((mx, i) => {
      box(g, mw, 0.32, 0.03, monM, mx, 1.03, z - 0.2 * f);
      plane(g, mw - 0.04, 0.28, screens[dual && i ? (kind + 1) % 6 : kind], mx, 1.03, z - 0.183 * f, 0, front ? Math.PI : 0);
      box(g, 0.04, 0.2, 0.04, monM, mx, 0.86, z - 0.22 * f);
    });
    box(g, 0.44, 0.02, 0.14, std(0x2a2a2e), x, 0.77, z + 0.08 * f);
    chair(g, x, z + 0.62 * f, front ? 0 : Math.PI, chairM, tilt);
    Z.block(x - 0.57, x + 0.57, front ? z - 0.3 : z - 0.32, front ? z + 0.32 : z + 0.3);
    if (key) Z.spot(key, x, z + 0.62 * f, front ? 0 : Math.PI);
    addSeat(Z, x, z + 0.62 * f, front ? 0 : Math.PI, key);
  }
  // 옆(x 방향)을 보고 앉는 책상. dir 1 이면 서쪽에 앉아 동쪽(+x)을 본다
  function sideDesk(Z, g, key, x, z, dir, kind = 0, tilt = 0) {
    box(g, 0.6, 0.05, 1.1, deskM, x, 0.74, z);
    for (const dz of [-0.5, 0.5]) box(g, 0.55, 0.72, 0.05, legM, x, 0.36, z + dz);
    const mx = x + dir * 0.2;
    [z - 0.26, z + 0.26].forEach((mz, i) => {
      box(g, 0.03, 0.32, 0.48, monM, mx, 1.03, mz);
      plane(g, 0.44, 0.28, screens[i ? (kind + 1) % 6 : kind], mx - dir * 0.017, 1.03, mz, 0, -dir * Math.PI / 2);
      box(g, 0.04, 0.2, 0.04, monM, mx + dir * 0.02, 0.86, mz);
    });
    box(g, 0.14, 0.02, 0.44, std(0x2a2a2e), x - dir * 0.08, 0.77, z);
    const cx = x - dir * 0.62;
    chair(g, cx, z, (dir * Math.PI) / 2, chairM, tilt);
    Z.block(x - 0.32, x + 0.32, z - 0.57, z + 0.57);
    if (key) Z.spot(key, cx, z, (dir * Math.PI) / 2);
    addSeat(Z, cx, z, (dir * Math.PI) / 2, key);
  }
  // 옆을 보는 책상의 이름표. 앉는 사람 쪽 앞 가장자리에 세운다. raised 면 뒷줄 사람에게 안 가리게 높이
  const sidePlate = (g, text, x, z, dir, raised) => {
    const mat = new THREE.MeshBasicMaterial({ map: textTex(240, 66, '#2a1c14', [[text, 34, '#ffe1b8']]) });
    const px = x - dir * 0.05;
    const y = raised ? 1.32 : 0.88;
    box(g, 0.04, y - 0.78, 0.04, std(0x2a1c14), px, (y + 0.78) / 2 - 0.02, z + 0.52);
    plane(g, 0.56, 0.16, mat, px, y, z + 0.55);
  };
  // 앉는 사람 쪽 책상 가장자리에 비스듬히 세운 이름표. 마주 보는 책상에서도 위에서 읽힌다
  // side: 앉는 사람이 있는 쪽(+1 이면 +z 쪽)
  // 뒤쪽 자리(side -1)는 모니터에 가려지므로 모니터 위로 올려 단다
  const flatPlate = (g, text, x, z, side) => {
    const mat = new THREE.MeshBasicMaterial({ map: textTex(240, 66, '#2a1c14', [[text, 34, '#ffe1b8']]) });
    if (side < 0) {
      box(g, 0.04, 0.16, 0.04, std(0x2a1c14), x, 1.24, z + 0.22);
      plane(g, 0.8, 0.22, mat, x, 1.36, z + 0.235);
      return;
    }
    const zz = z + 0.22;
    box(g, 0.8, 0.05, 0.1, std(0x2a1c14), x, 0.79, zz);
    plane(g, 0.8, 0.22, mat, x, 0.86, zz + 0.04, -1.0);
  };
  // 임원 책상. 사람이 앞(+z)을 보고 앉는다. flip 이면 반대로 뒤(-z)를 보고 앉는다
  function execDesk(Z, g, key, x, z, w, plate, flip = false) {
    const f = flip ? -1 : 1;
    const top = std(0x4a3022, { roughness: 0.45 });
    box(g, w, 0.06, 0.8, top, x, 0.76, z);
    box(g, w, 0.7, 0.05, top, x, 0.38, z + 0.36 * f);
    for (const dx of [-w / 2 + 0.04, w / 2 - 0.04]) box(g, 0.06, 0.74, 0.76, top, x + dx, 0.37, z);
    // 노트북은 앉은 사람을 본다
    box(g, 0.42, 0.02, 0.3, std(0xc8ccd2, { metalness: 0.3, roughness: 0.4 }), x, 0.8, z - 0.05 * f);
    const lid = box(g, 0.42, 0.3, 0.02, std(0xc8ccd2, { metalness: 0.3, roughness: 0.4 }), x, 0.94, z + 0.1 * f);
    lid.rotation.x = -0.25 * f;
    // 명패는 앞(카메라 쪽)에서 읽히게. 뒤를 보고 앉으면 책상 위 한쪽 끝에 세운다
    if (plate && !flip) sign(g, plate, x, 0.6, z + 0.39, 0.9, 0, '#2a1c14', '#ffe1b8');
    if (plate && flip) {
      box(g, 0.72, 0.1, 0.08, std(0x2a1c14), x + w / 2 - 0.42, 0.83, z + 0.3);
      sign(g, plate, x + w / 2 - 0.42, 0.9, z + 0.35, 0.72, 0, '#2a1c14', '#ffe1b8');
    }
    const big = std(0x1a1a1e, { roughness: 0.6 });
    const cz = z - 0.72 * f;
    box(g, 0.6, 0.1, 0.56, big, x, 0.46, cz);
    box(g, 0.6, 0.85, 0.1, big, x, 0.92, cz - 0.28 * f);
    cyl(g, 0.035, 0.035, 0.42, legM, x, 0.21, cz, 6);
    Z.block(x - w / 2 - 0.03, x + w / 2 + 0.03, z - 0.42, z + 0.42);
    Z.block(x - 0.32, x + 0.32, Math.min(cz - 0.36 * f, cz - 0.26 * f), Math.max(cz - 0.36 * f, cz - 0.26 * f));
    const yaw = flip ? Math.PI : 0;
    if (key) Z.spot(key, x, cz, yaw);
    addSeat(Z, x, cz, yaw, key);
  }
  // 소파. yaw 는 앉는 사람이 보는 방향
  function sofa(Z, g, x, z, w, yaw, m = sofaM) {
    const along = Math.abs(Math.sin(yaw)) < 0.5;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    if (along) {
      box(g, w, 0.42, 0.8, m, x, 0.21, z);
      box(g, w, 0.5, 0.18, m, x, 0.62, z - fz * 0.33);
      for (const sx of [-1, 1]) box(g, 0.16, 0.6, 0.8, m, x + sx * (w / 2 - 0.08), 0.3, z);
      Z.block(x - w / 2, x + w / 2, z - 0.4, z + 0.4);
    } else {
      box(g, 0.8, 0.42, w, m, x, 0.21, z);
      box(g, 0.18, 0.5, w, m, x - fx * 0.33, 0.62, z);
      for (const sz of [-1, 1]) box(g, 0.8, 0.6, 0.16, m, x, 0.3, z + sz * (w / 2 - 0.08));
      Z.block(x - 0.4, x + 0.4, z - w / 2, z + w / 2);
    }
  }
  function lowTable(Z, g, x, z, w, d, m = woodM) {
    box(g, w, 0.05, d, m, x, 0.42, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.05, 0.4, 0.05, legM, x + dx * (w / 2 - 0.06), 0.2, z + dz * (d / 2 - 0.06));
    Z.block(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }
  function shelf(Z, g, x, z, w, ry = 0) {
    box(g, w, 1.9, 0.4, woodM, x, 0.95, z, ry);
    const cols = [0x7a2a2a, 0x2a4a7a, 0xd8c08a, 0x3a6a3a, 0x5a3a6a];
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < 5; i++) {
        const o = box(g, (w / 6) * 0.8, 0.28, 0.3, std(cols[(r + i) % 5]), 0, 0.3 + r * 0.44, 0);
        const off = -w / 2 + (w / 6) * (i + 0.8);
        o.position.set(x + Math.cos(ry) * off, 0.3 + r * 0.44, z - Math.sin(ry) * off + 0.06 * Math.cos(ry));
        o.rotation.y = ry;
      }
    if (Math.abs(Math.sin(ry)) < 0.5) Z.block(x - w / 2, x + w / 2, z - 0.25, z + 0.25);
    else Z.block(x - 0.25, x + 0.25, z - w / 2, z + w / 2);
  }
  function copier(Z, g, x, z) {
    box(g, 0.7, 1.0, 0.6, std(0xe6e6e2), x, 0.5, z);
    box(g, 0.7, 0.1, 0.6, std(0x3a3c42), x, 1.05, z);
    box(g, 0.3, 0.06, 0.2, basic(0x6fd08a), x + 0.15, 1.12, z + 0.15);
    Z.block(x - 0.38, x + 0.38, z - 0.33, z + 0.33);
  }
  // 시사실 의자. 화면은 뒤쪽(-z)
  function cinemaSeat(Z, g, key, x, z) {
    const seatM = std(0xa8182a, { roughness: 0.8 });
    box(g, 0.72, 0.4, 0.66, seatM, x, 0.2, z);
    box(g, 0.72, 0.7, 0.14, seatM, x, 0.62, z + 0.3);
    box(g, 0.07, 0.5, 0.66, std(0x2a1a1c), x + 0.39, 0.25, z);
    if (key) Z.spot(key, x, z, Math.PI);
    addSeat(Z, x, z, Math.PI, key);
  }
  function car(Z, g, x, z, color) {
    const body = std(color, { metalness: 0.25, roughness: 0.4 });
    const glass = std(0x0a0c12, { roughness: 0.2 });
    box(g, 1.8, 0.62, 4.2, body, x, 0.52, z);
    box(g, 1.62, 0.55, 2.2, body, x, 1.1, z + 0.2);
    box(g, 1.64, 0.42, 2.0, glass, x, 1.1, z + 0.2);
    for (const [dx, dz] of [[-0.82, -1.35], [0.82, -1.35], [-0.82, 1.35], [0.82, 1.35]]) {
      const w = cyl(g, 0.32, 0.32, 0.22, std(0x111111), x + dx, 0.32, z + dz);
      w.rotation.z = Math.PI / 2;
    }
    box(g, 1.5, 0.12, 0.05, basic(0xff3030), x, 0.72, z + 2.1);
    Z.block(x - 0.95, x + 0.95, z - 2.15, z + 2.15);
  }

  // ---------- 층 공통 ----------
  // 평면도(지상 4층, 11.2 x 19.7m)를 0.85 배로 줄였다. 오른쪽 뒤가 계단·엘리베이터·화장실, 가운데가 복도
  // 뒷줄 방 z -5.2 ~ -0.75, 복도 -0.75 ~ 0.3, 앞줄 방 0.3 ~ 5.2. 앞 오른쪽(x 5.95 ~ 8, 복도 앞)은 건물 밖
  const Zb = -5.2;
  const Zf = 5.2;
  const ZcN = -0.75;
  const ZcS = 0.3;
  const Xe = 8.0;
  function floorBase(code, o) {
    const west = o.west;
    const Z = zone(code, BX, -FLOOR_GAP * SLOT[code], [west + 0.25, Xe - 0.25, Zb + 0.25, Zf - 0.25]);
    const g = Z.g;
    const wallM = std(o.wall, { roughness: 0.85 });
    Z.wallM = wallM;
    const fm = o.floorMat || std(o.floor, { roughness: 0.6 });
    floorPlane(g, 5.95 - west, Zf - Zb, fm, (west + 5.95) / 2, 0);
    floorPlane(g, Xe - 5.95, ZcN - Zb + 0.05, fm, (5.95 + Xe) / 2, (Zb + ZcN) / 2);
    // 바깥벽
    box(g, Xe - west + 0.2, 3.0, 0.2, wallM, (west + Xe) / 2, 1.5, Zb - 0.1);
    if (!o.westGlass) box(g, 0.2, 3.0, Zf - Zb, wallM, west - 0.1, 1.5, 0);
    box(g, 0.2, 3.0, ZcN - Zb, wallM, Xe + 0.1, 1.5, (Zb + ZcN) / 2);
    box(g, 0.2, 2.8, Zf - ZcN, wallM, 6.05, 1.4, (ZcN + Zf) / 2);
    box(g, Xe - 5.95, 2.8, 0.2, wallM, (5.95 + Xe) / 2, 1.4, ZcN + 0.05);
    Z.block(5.95, Xe + 0.3, ZcN - 0.05, Zf + 0.3);
    // 앞쪽은 카메라가 보도록 낮은 턱만
    box(g, 5.95 - west, 0.12, 0.12, std(0x2a2a2e), (west + 5.95) / 2, 0.06, Zf + 0.06);
    // 창밖 밤 도시
    if (o.windows) {
      const cityM = new THREE.MeshBasicMaterial({ map: city });
      for (const [x0, x1] of o.windows) plane(g, x1 - x0, 1.5, cityM, (x0 + x1) / 2, 1.75, Zb + 0.01);
      plane(g, 3.6, 1.5, cityM, 5.94, 1.75, 2.8, 0, -Math.PI / 2);
    }

    // 화장실 묶음(들어갈 수 없음)
    const tile = std(0xc8ccd0, { roughness: 0.7 });
    box(g, 3.2, 2.3, -2.0 - Zb, tile, 1.55, 1.15, (Zb - 2.0) / 2);
    box(g, 1.6, 2.3, -2.65 - Zb, tile, 3.95, 1.15, (Zb - 2.65) / 2);
    Z.block(-0.05, 3.15, Zb, -2.0);
    Z.block(3.15, 4.75, Zb, -2.65);
    for (const [x, label, col] of [[0.7, '여자 화장실', '#c0406a'], [2.3, '남자 화장실', '#3a6ac0']]) {
      box(g, 0.8, 1.9, 0.04, std(0x8a9096), x, 0.95, -1.99);
      sign(g, label, x, 2.08, -1.97, 0.9, 0, col);
    }

    // 엘리베이터 홀. 왼쪽 벽은 층 안내판(4층은 조직도)
    if (code === 'B4') plane(g, 1.3, 1.13, new THREE.MeshBasicMaterial({ map: orgTex() }), 3.95, 1.55, -2.64);
    else plane(g, 0.75, 1.17, new THREE.MeshBasicMaterial({ map: directoryTex() }), 3.95, 1.5, -2.64);
    // 엘리베이터. 문은 홀 쪽(서쪽)을 본다
    const steel = std(0xbfc3ca, { metalness: 0.3, roughness: 0.4 });
    box(g, 1.9, 2.8, 1.95, std(0x8a8e96, { roughness: 0.5 }), 7.05, 1.4, -1.675);
    plane(g, 1.7, 0.6, new THREE.MeshBasicMaterial({ map: textTex(340, 120, '#1a1b1e', [['ELEVATOR', 52, '#ffd36f']]) }), 7.05, 2.81, -1.675, -Math.PI / 2);
    box(g, 0.06, 2.3, 0.62, steel, 6.08, 1.15, -1.98);
    box(g, 0.06, 2.3, 0.62, steel, 6.08, 1.15, -1.36);
    box(g, 0.08, 0.28, 0.5, std(0x140a0a), 6.07, 2.55, -1.67);
    plane(g, 0.46, 0.24, new THREE.MeshBasicMaterial({ map: textTex(120, 60, '#140a0a', [[(FLOOR_NO[code] === '-1' ? 'B1' : FLOOR_NO[code] + 'F'), 40, '#ff4a3a']]) }), 6.025, 2.55, -1.67, 0, -Math.PI / 2);
    box(g, 0.04, 0.24, 0.14, frameM, 6.08, 1.2, -0.95);
    // 앞에서도 보이게 엘리베이터 바깥벽에 표시
    sign(g, 'ELEV ◀', 7.05, 2.2, -0.68, 1.2, 0, '#2a2c30', '#ffd36f');
    Z.block(6.05, Xe + 0.3, -2.65, ZcN);
    pickBox(Z, 2.0, 2.8, 2.1, 7.05, 1.4, -1.67, { elev: code });
    plane(g, 0.9, 0.42, new THREE.MeshBasicMaterial({ map: textTex(220, 100, '#20222a', [['엘리베이터', 34, '#ffd36f']]), transparent: true, opacity: 0.92 }), 5.55, 0.015, -1.67, -Math.PI / 2);
    Z.trigger('elev', 5.1, 6.02, -2.3, -1.05);
    Z.at('elev', 4.55, -1.67, -Math.PI / 2);

    // 계단. 앞줄은 올라가고 뒷줄은 내려간다
    const stepM = std(0x9a9ca2, { roughness: 0.8 });
    const up = UP[code];
    const down = DOWN[code];
    box(g, 2.1, 1.0, 0.08, std(0x5a5c62, { metalness: 0.3 }), 6.95, 0.5, -3.92);
    if (up) for (let i = 0; i < 7; i++) box(g, 0.29, 0.17 * (i + 1), 1.05, stepM, 5.95 + i * 0.29, 0.085 * (i + 1), -3.3);
    else box(g, 2.0, 2.6, 1.0, Z.wallM, 6.95, 1.3, -3.3);
    if (down) {
      plane(g, 2.0, 1.1, basic(0x08080a), 6.95, 0.004, -4.52, -Math.PI / 2);
      for (let i = 0; i < 6; i++) box(g, 0.05, 0.02, 1.0, std(0x4a4c52), 6.0 + i * 0.32, 0.01, -4.52);
    } else box(g, 2.0, 2.6, 1.0, Z.wallM, 6.95, 1.3, -4.52);
    const pad = (t) => new THREE.MeshBasicMaterial({ map: textTex(200, 80, '#20222a', [[t, 34, '#ffd36f']]), transparent: true, opacity: 0.92 });
    const lab = (c) => (c === 'BM' ? 'B1' : c.slice(1) + '층');
    if (up) {
      plane(g, 0.62, 0.5, pad('▲ ' + lab(up)), 6.28, 0.015, -3.3, -Math.PI / 2, -Math.PI / 2);
      Z.trigger('go', 5.95, 6.6, -3.8, -2.8, up, 'fromDown');
    }
    if (down) {
      plane(g, 0.62, 0.5, pad('▼ ' + lab(down)), 6.28, 0.015, -4.52, -Math.PI / 2, -Math.PI / 2);
      Z.trigger('go', 5.95, 6.6, -5.05, -4.02, down, 'fromUp');
    }
    Z.block(6.6, Xe + 0.3, Zb - 0.3, -2.65);
    Z.block(5.9, 6.6, -4.0, -3.84);
    // 위층으로 올라오면 내려가는 계단 앞에, 내려오면 올라가는 계단 앞에 선다
    Z.at('fromDown', 5.3, -4.5, -Math.PI / 2);
    Z.at('fromUp', 5.3, -3.3, -Math.PI / 2);
    sign(g, ZONE_NAMES[code], 5.4, 2.6, Zb + 0.02, 1.8, 0, '#15161a');
    pickFloor(Z, Xe - west + 0.4, Zf - Zb + 0.4, (west + Xe) / 2, 0);
    return Z;
  }

  // 탕비실. 화장실 앞, 복도와 이어진다
  function pantry(Z, g) {
    box(g, 2.3, 0.9, 0.55, std(0xe8e4dc), 1.1, 0.45, -1.7);
    box(g, 2.32, 0.04, 0.58, std(0x3a3c42), 1.1, 0.92, -1.7);
    box(g, 0.45, 0.4, 0.35, std(0x1a1a1e), 0.4, 1.14, -1.75);
    box(g, 0.5, 0.3, 0.35, std(0xd8d8d4), 1.6, 1.09, -1.75);
    cyl(g, 0.2, 0.18, 0.06, std(0xb8bcc4, { metalness: 0.4 }), 1.0, 0.95, -1.7);
    box(g, 0.6, 1.9, 0.6, std(0xdedede, { metalness: 0.2, roughness: 0.4 }), 2.7, 0.95, -1.68);
    Z.block(-0.05, 3.1, -2.0, -1.38);
    sign(g, '탕비실', 2.15, 1.3, -1.97, 0.6, 0, '#2a2c30');
  }

  // ---------- 앞길 ----------
  // 건물(가로 20.4)을 길 가운데 둔다. 바닥 좌표 x 에 +2.2 를 하면 길 좌표
  {
    const Z = zone('B0', BX, 0, [-15, 15, -3.9, 6.5]);
    const g = Z.g;
    plane(g, 52, 30, std(0x1b1c20, { roughness: 1 }), 0, -0.01, 2, -Math.PI / 2);
    plane(g, 52, 3, std(0x5a5650, { roughness: 0.95 }), 0, 0.0, -2.5, -Math.PI / 2);
    box(g, 52, 0.16, 0.2, std(0x9a958c), 0, 0.08, -1.0);
    for (let x = -24; x < 26; x += 3) box(g, 1.4, 0.01, 0.12, basic(0xd8d0a0), x, 0.01, 3.2);
    const S = 2.2;
    const front = -4.0;
    const deep = 10.4;
    const concrete = std(0x8a8680, { roughness: 0.85 });
    const dark = std(0x2a2c30, { roughness: 0.8 });
    const band = std(0xdcd6ca, { roughness: 0.7 });
    const wx0 = -12.4 + S;
    const wx1 = 5.95 + S;
    const ex = Xe + S;
    const recess = front - (Zf - ZcN);
    // 계단·엘리베이터 탑은 뒤로 물러나 있다(지붕 위로 조금 솟음)
    box(g, ex - wx1, 14.2, ZcN - Zb, dark, (wx1 + ex) / 2, 7.1, recess - (ZcN - Zb) / 2);
    // 1층. 왼쪽은 필로티 주차장, 오른쪽은 유리 로비
    box(g, wx1 - wx0, 0.3, deep, concrete, (wx0 + wx1) / 2, 3.05, front - deep / 2);
    box(g, wx1 - wx0, 3.0, 0.2, std(0x1a1b1e), (wx0 + wx1) / 2, 1.5, front - deep + 0.1);
    plane(g, wx1 - wx0, deep, std(0x4a4a4c), (wx0 + wx1) / 2, 0.01, front - deep / 2, -Math.PI / 2);
    for (const x of [-12.2, -8.2, -4.1, 1.45]) box(g, 0.45, 3.0, 0.45, concrete, x + S, 1.5, front - 0.25);
    for (const x of [-10.2, -6.0, -2.0]) box(g, 1.8, 0.02, 0.1, basic(0xf0f0e8), x + S, 0.02, front - 0.6);
    for (const [x, c] of [[-11.2, 0xd8dade], [-6.6, 0x2a2c34], [-4.3, 0x8a1a22]]) {
      box(g, 1.8, 0.62, 4.2, std(c, { metalness: 0.25, roughness: 0.4 }), x + S, 0.52, front - 2.6);
      box(g, 1.62, 0.5, 2.2, std(c, { metalness: 0.25, roughness: 0.4 }), x + S, 1.08, front - 2.8);
      box(g, 1.5, 0.12, 0.05, basic(0xff3030), x + S, 0.72, front - 0.48);
    }
    for (let i = 0; i < 3; i++) box(g, 2.2, 0.04, 0.12, basic(0xfff2d8), -8 + i * 4.4 + S, 2.88, front - 3);
    sign(g, 'P 주차장', -11.4 + S, 2.55, front - 0.02, 1.2, 0, '#1a3a8a');
    // 로비
    const lobbyGlass = new THREE.MeshStandardMaterial({ color: 0x14100c, emissive: 0xffe2b8, emissiveIntensity: 0.5, roughness: 0.25 });
    plane(g, wx1 - (1.45 + S) - 0.1, 2.8, lobbyGlass, (1.45 + S + wx1) / 2, 1.45, front + 0.01);
    for (const x of [3.1, 4.1]) box(g, 0.08, 2.8, 0.12, frameM, x + S, 1.4, front + 0.04);
    plane(g, 1.0, 2.4, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, emissive: 0xfff0d8, emissiveIntensity: 0.4, roughness: 0.2 }), 3.6 + S, 1.2, front + 0.03);
    // 주소판
    plane(g, 1.4, 0.45, new THREE.MeshBasicMaterial({ map: textTex(280, 90, '#123a7a', [['학동로46길 25', 34, '#ffffff']], '#ffffff') }), 5.2 + S, 2.2, front + 0.03);
    // 2~3층. 층마다 띠와 창
    const glow = [null, 0xbfe0ff, 0xffd8a8, 0xe6f4ff];
    for (let k = 1; k < 3; k++) {
      const y0 = k * 3.2;
      box(g, wx1 - wx0, 3.2, deep, concrete, (wx0 + wx1) / 2, y0 + 1.6, front - deep / 2);
      box(g, wx1 - wx0 + 0.3, 0.4, 0.3, band, (wx0 + wx1) / 2, y0 + 0.2, front + 0.05);
      const gl = new THREE.MeshStandardMaterial({ color: 0x0c0c10, emissive: glow[k], emissiveIntensity: 0.55, roughness: 0.25 });
      plane(g, wx1 - wx0 - 0.6, 2.2, gl, (wx0 + wx1) / 2, y0 + 1.7, front + 0.21);
      for (let x = wx0 + 0.3; x <= wx1 - 0.2; x += 1.3) box(g, 0.1, 2.3, 0.1, dark, x, y0 + 1.7, front + 0.24);
    }
    // 4층은 왼쪽이 테라스로 비어 있다
    const t0 = -8.0 + S;
    box(g, t0 - wx0, 0.3, deep, band, (wx0 + t0) / 2, 9.75, front - deep / 2);
    box(g, wx1 - t0, 3.2, deep, concrete, (t0 + wx1) / 2, 11.2, front - deep / 2);
    box(g, wx1 - t0 + 0.3, 0.4, 0.3, band, (t0 + wx1) / 2, 9.8, front + 0.05);
    const gl4 = new THREE.MeshStandardMaterial({ color: 0x0c0c10, emissive: 0xffe6c0, emissiveIntensity: 0.6, roughness: 0.25 });
    plane(g, wx1 - t0 - 0.6, 2.2, gl4, (t0 + wx1) / 2, 11.3, front + 0.21);
    for (let x = t0 + 0.3; x <= wx1 - 0.2; x += 1.3) box(g, 0.1, 2.3, 0.1, dark, x, 11.3, front + 0.24);
    plane(g, 0.04, 2.2, gl4, t0 - 0.01, 11.3, front - 3, 0, Math.PI / 2);
    // 테라스 유리 난간과 데크 불빛
    const rail = new THREE.MeshStandardMaterial({ color: 0xa8c8d8, transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false });
    box(g, t0 - wx0, 1.0, 0.04, rail, (wx0 + t0) / 2, 10.4, front);
    box(g, 0.04, 1.0, deep, rail, wx0, 10.4, front - deep / 2);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic(0xffd890));
      b.position.set(wx0 + 0.4 + i * 0.75, 11.0 - Math.sin((i / 5) * Math.PI) * 0.25, front - 0.2);
      g.add(b);
    }
    plant(g, wx0 + 0.6, front - 1.0, 0.9);
    // 옥상 난간과 간판
    box(g, wx1 - t0 + 0.2, 0.6, 0.3, band, (t0 + wx1) / 2, 13.1, front);
    const neon = new THREE.MeshBasicMaterial({ map: textTex(512, 128, '#1a0b1a', [['스튜디오 풍논', 78, '#ff9fd8']], '#ff6fb8') });
    plane(g, 4.8, 1.2, neon, 1.0 + S, 14.1, front);
    for (const dx of [-2.0, 2.0]) box(g, 0.12, 1.1, 0.12, dark, 1.0 + S + dx, 13.5, front - 0.05);
    // 옆 건물들
    const side = std(0x23252b, { roughness: 0.9 });
    box(g, 10, 9.6, 10, side, -16.4, 4.8, -9);
    box(g, 9, 16, 10, side, 16.0, 8, -9);
    const lit = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffd98a, emissiveIntensity: 0.4 });
    for (let i = 0; i < 16; i++) {
      const left = i < 6;
      plane(g, 0.9, 0.7, lit, (left ? -16.4 : 16.0) + rnd(-3.5, 3.5), 1.5 + Math.floor(rnd(0, left ? 3 : 5)) * 3, -3.98);
    }
    // 가로등
    for (const x of [-12.8, 12.8]) {
      cyl(g, 0.06, 0.08, 4.2, std(0x2a2c30), x, 2.1, -1.5);
      box(g, 0.9, 0.08, 0.1, std(0x2a2c30), x + (x < 0 ? 0.4 : -0.4), 4.15, -1.5);
      const lamp = cyl(g, 0.16, 0.22, 0.14, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(2) }), x + (x < 0 ? 0.8 : -0.8), 4.05, -1.5);
      lamp.castShadow = false;
      Z.block(x - 0.15, x + 0.15, -1.65, -1.35);
    }
    // 가로수
    for (const x of [-6.5, 10.6]) {
      cyl(g, 0.09, 0.12, 2.2, std(0x4a3424), x, 1.1, -2.2);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), std(0x2a5232, { roughness: 0.9 }));
        leaf.position.set(x + Math.cos(i * 1.3) * 0.4, 2.5 + (i % 2) * 0.35, -2.2 + Math.sin(i * 1.3) * 0.4);
        g.add(leaf);
      }
      box(g, 1.0, 0.05, 1.0, std(0x3a3028), x, 0.03, -2.2);
      Z.block(x - 0.3, x + 0.3, -2.5, -1.9);
    }
    // 길에 세워 둔 차
    {
      const c = std(0x2e3a52, { metalness: 0.3, roughness: 0.4 });
      box(g, 4.2, 0.7, 1.8, c, -9.2, 0.55, 1.4);
      box(g, 2.3, 0.6, 1.6, c, -9.4, 1.15, 1.4);
      box(g, 2.2, 0.5, 1.62, std(0x0a0c12, { roughness: 0.2 }), -9.4, 1.15, 1.4);
      for (const [x, z] of [[-10.6, 0.55], [-7.8, 0.55], [-10.6, 2.25], [-7.8, 2.25]]) {
        const w = cyl(g, 0.34, 0.34, 0.24, std(0x111111), x, 0.34, z);
        w.rotation.x = Math.PI / 2;
      }
      Z.block(-11.4, -7.0, 0.4, 2.4);
    }
    // 돌아가는 길 표지
    {
      box(g, 0.08, 1.4, 0.08, std(0x3a2a1a), 14.4, 0.7, -2.3);
      const s = plane(g, 1.4, 0.5, new THREE.MeshBasicMaterial({ map: textTex(280, 100, '#2a1c12', [['풍속의 밤 →', 40, '#ffe1b8']], '#c49a62') }), 14.4, 1.3, -2.25);
      s.rotation.y = -0.3;
    }
    // 건물 앞면. 로비 문과 주차장 입구(가운데쯤)로만 들어간다
    Z.block(wx0, 3.1 + S, front - 1, front + 0.15);
    Z.block(4.1 + S, ex + 0.4, front - 1, front + 0.15);
    Z.trigger('go', 3.1 + S, 4.1 + S, front - 0.2, front + 0.55, 'B1', 'door');
    Z.trigger('go', -3.0 + S, 0.6 + S, front + 0.15, front + 0.5, 'B1', 'park');
    Z.trigger('shop', 14.1, 15, -3.9, 0.2);
    Z.at('shop', 13.0, -2.4, -Math.PI / 2);
    Z.at('lobby', 3.6 + S, -2.7, 0);
    Z.at('park', -1.2 + S, -2.7, 0);
    Z.at('elev', 3.6 + S, -2.7, 0);
    pickFloor(Z, 32, 12, 0, 1.3);
    Z.light(-9.5, 4, -1.5, 0xffd9a0, 14, 13);
    Z.light(9.5, 4, -1.5, 0xffd9a0, 14, 13);
    Z.light(3.0, 3, -3.0, 0xffe0b8, 12, 11);
    scene.add(mergeStatic(g));
  }

  // ---------- 지하 1층: 시사실 1~3, R&D 센터, 인사총무팀, 휴게실 ----------
  {
    const Z = floorBase('BM', { west: -12.4, floor: 0x2a2a30, wall: 0x2c2a30 });
    const g = Z.g;
    const W = Z.wallM;
    // 뒷줄 시사실 셋. 화면은 뒷벽, 방 사이 벽은 천장까지
    wallRun(Z, g, 'x', ZcN, -12.4, -0.05, [[-11.9, -11.0], [-3.7, -2.95], [-1.0, -0.2]], 'solid', W);
    for (const x of [-5.6, -2.9]) wallRun(Z, g, 'z', x, Zb, ZcN, [], 'full', W);
    wallRun(Z, g, 'z', -0.05, Zb, -2.0, [], 'full', W);
    const scr = (x, w, title) => {
      const m = new THREE.MeshBasicMaterial({
        map: canvasTex(512, 220, (c, cw, ch) => {
          const gr = c.createLinearGradient(0, 0, cw, ch);
          gr.addColorStop(0, '#2a0f3a');
          gr.addColorStop(0.5, '#a0306a');
          gr.addColorStop(1, '#f0a050');
          c.fillStyle = gr;
          c.fillRect(0, 0, cw, ch);
          c.textAlign = 'center';
          c.fillStyle = '#fff';
          c.font = '700 50px "Gowun Dodum", sans-serif';
          c.fillText(title[0], cw / 2, 96);
          c.font = '24px "Gowun Dodum", sans-serif';
          c.fillText(title[1], cw / 2, 146);
        }),
      });
      box(g, w + 0.2, w * 0.45 + 0.2, 0.06, std(0x0a0a0c), x, 1.6, Zb + 0.04);
      plane(g, w, w * 0.45, m, x, 1.6, Zb + 0.08);
      anim.screens.push(m);
    };
    scr(-9.0, 5.0, ['풍속의 밤', '감독판 시사회 · 제작 스튜디오 풍논']);
    scr(-4.25, 2.1, ['희동이의 하루', '편집본 v3']);
    scr(-1.5, 2.1, ['풍뎅이', '색보정 확인']);
    let n = 0;
    for (const z of [-3.0, -1.85]) {
      for (const x of [-10.6, -9.8, -9.0, -8.2, -7.4, -6.6]) cinemaSeat(Z, g, 's1_' + n++, x, z);
      Z.block(-11.0, -6.2, z - 0.36, z + 0.42);
      for (const x of [-4.85, -4.05]) cinemaSeat(Z, g, 's2_' + n++, x, z);
      Z.block(-5.25, -3.65, z - 0.36, z + 0.42);
      for (const x of [-2.15, -1.35]) cinemaSeat(Z, g, 's3_' + n++, x, z);
      Z.block(-2.55, -0.95, z - 0.36, z + 0.42);
    }
    // 시사실 1 영사기 빛줄기
    box(g, 0.5, 0.35, 0.6, std(0x15161a), -8.6, 2.3, ZcN - 0.35);
    {
      const len = 4.2;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.3, len, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.set(Z.c.x - 8.8, 2.0, Z.c.z + ZcN - 0.5 - len / 2);
      beam.rotation.x = -Math.PI / 2;
      scene.add(beam);
    }
    for (const [x, t] of [[-11.45, '시사실 1'], [-3.3, '시사실 2'], [-0.6, '시사실 3']]) sign(g, t, x, 1.3, ZcN + 0.08, 0.9, 0, '#3a0f1a', '#ffd8a8');
    // 앞줄. R&D 센터, 인사총무팀, 휴게실
    wallRun(Z, g, 'x', ZcS, -12.4, 5.95, [[-6.0, -5.1], [-4.3, -3.5], [1.6, 2.5]], 'low', W);
    for (const x of [-4.5, 1.45]) wallRun(Z, g, 'z', x, ZcS, Zf, [], 'low', W);
    for (const [x, z, k] of [[-11.3, 1.6, 'rd1'], [-9.9, 1.6, 'rd2'], [-8.5, 1.6, null], [-11.3, 3.6, null], [-9.9, 3.6, 'rd3'], [-8.5, 3.6, null]]) desk(Z, g, k, x, z, 3);
    // 모션 컨트롤 카메라 리그
    box(g, 0.9, 0.5, 0.9, std(0x3a3c42), -6.2, 0.25, 2.6);
    const arm = box(g, 0.2, 1.4, 0.2, std(0xe07a20), -6.2, 1.1, 2.6);
    arm.rotation.z = 0.4;
    box(g, 0.35, 0.3, 0.45, monM, -6.55, 1.75, 2.6);
    Z.block(-6.7, -5.7, 2.1, 3.1);
    plane(g, 2.6, 1.2, new THREE.MeshBasicMaterial({ map: textTex(390, 180, '#f4f4f0', [['R&D Center', 40, '#2a2c30'], ['실시간 렌더 · 버추얼 프로덕션', 22, '#4a7ac0']]) }), -12.29, 1.6, 2.8, 0, Math.PI / 2);
    for (const [x, z, k] of [[-3.4, 1.6, 'hr1'], [-2.0, 1.6, null], [-3.4, 3.6, 'hr2'], [-2.0, 3.6, null]]) desk(Z, g, k, x, z, 4, false);
    for (let i = 0; i < 4; i++) box(g, 0.5, 1.3, 0.6, std(0x8a9096, { metalness: 0.2 }), 0.95, 0.65, 1.2 + i * 0.95);
    Z.block(0.65, 1.25, 0.85, 4.5);
    sign(g, '인사총무팀', -1.5, 2.35, ZcS + 0.04, 1.2);
    sign(g, 'R&D Center', -9.0, 2.35, ZcS + 0.04, 1.4);
    // 휴게실
    box(g, 0.8, 1.9, 0.7, std(0xc0303a), 5.4, 0.95, 1.1);
    plane(g, 0.6, 1.0, new THREE.MeshBasicMaterial({ map: canvasTex(60, 100, (c) => {
      c.fillStyle = '#dff4ff';
      c.fillRect(0, 0, 60, 100);
      for (let i = 0; i < 12; i++) {
        c.fillStyle = ['#e04a4a', '#4a8ae0', '#f0c040', '#5bb08a'][i % 4];
        c.fillRect(6 + (i % 3) * 18, 8 + ((i / 3) | 0) * 22, 12, 16);
      }
    }) }), 5.4, 1.2, 0.74, 0, Math.PI);
    Z.block(4.95, 5.85, 0.7, 1.5);
    sofa(Z, g, 3.6, 4.5, 2.0, Math.PI, std(0x5a3a6a, { roughness: 0.9 }));
    lowTable(Z, g, 3.6, 3.3, 1.2, 0.6);
    sign(g, '휴게실', 3.6, 2.35, ZcS + 0.04, 1.0);
    Z.spot('lounge', 3.2, 4.4, Math.PI);
    pantry(Z, g);
    Z.light(-8.6, 2.6, -2.6, 0xffc8a0, 10, 9);
    Z.light(-6.5, 2.7, 2.5, 0xdfe8ff, 15, 13);
    Z.light(2.5, 2.7, 0.0, 0xfff0e0, 15, 13);
    scene.add(mergeStatic(g));
  }

  // ---------- 1층: 로비, 필로티 주차장 ----------
  {
    const asphalt = new THREE.MeshStandardMaterial({ map: speckleTex('#4a4b4e', ['#55575a', '#3e3f42', '#5e6064']), roughness: 0.95 });
    asphalt.map.repeat.set(5, 3);
    const Z = floorBase('B1', { west: -12.4, wall: 0x8a8680, floorMat: asphalt, windows: [[-12.2, -0.3]] });
    const g = Z.g;
    // 주차 칸과 차
    for (const x of [-12.35, -10.05, -7.75, -5.45, -3.15, -0.85]) box(g, 0.1, 0.01, 4.3, basic(0xf0f0e8), x, 0.012, -3.05);
    car(Z, g, -11.2, -3.0, 0xd8dade);
    car(Z, g, -6.6, -3.0, 0x2a2c34);
    car(Z, g, -4.3, -3.0, 0x8a1a22);
    // 오토바이
    box(g, 0.3, 0.5, 1.6, std(0x1a1a1e), -2.0, 0.5, -3.2);
    for (const dz of [-0.6, 0.6]) {
      const w = cyl(g, 0.28, 0.28, 0.1, std(0x111111), -2.0, 0.3, -3.2 + dz);
      w.rotation.z = Math.PI / 2;
    }
    Z.block(-2.25, -1.75, -4.05, -2.35);
    for (const x of [-11.2, -8.9, -6.6, -4.3]) box(g, 1.2, 0.12, 0.2, std(0xf0c020), x, 0.06, -4.8);
    for (const [x, z] of [[-8.2, 0.0], [-4.1, 0.0]]) {
      box(g, 0.45, 3.0, 0.45, std(0x9a958c), x, 1.5, z);
      box(g, 0.47, 0.6, 0.47, std(0xf0c020), x, 0.3, z);
      Z.block(x - 0.28, x + 0.28, z - 0.28, z + 0.28);
    }
    for (const x of [-10.0, -6.0, -2.0]) box(g, 2.4, 0.04, 0.14, basic(0xfff2d8), x, 2.95, -1.0);
    sign(g, 'P 주차장', -9.0, 2.5, Zb + 0.02, 1.4, 0, '#1a3a8a');
    plane(g, 1.2, 0.5, new THREE.MeshBasicMaterial({ map: textTex(240, 100, '#3a3a3e', [['출구 ▼', 40, '#ffd36f']]), transparent: true, opacity: 0.9 }), -6.0, 0.015, 4.3, -Math.PI / 2);
    // 우편함
    box(g, 2.4, 1.2, 0.35, std(0xa8acb2, { metalness: 0.3 }), 1.4, 0.9, -1.8);
    for (let i = 0; i < 12; i++) box(g, 0.34, 0.2, 0.02, std(0x6a6e74), 0.4 + (i % 6) * 0.4, 1.2 - ((i / 6) | 0) * 0.35, -1.62);
    Z.block(0.15, 2.65, -2.0, -1.6);
    // 로비. 유리벽으로 주차장과 나뉜다
    wallRun(Z, g, 'z', 1.45, ZcS, Zf, [[1.0, 1.9]], 'glass', Z.wallM);
    wallRun(Z, g, 'x', ZcS, 1.45, 3.15, [], 'glass', Z.wallM);
    wallRun(Z, g, 'x', Zf, 1.45, 5.95, [[3.1, 4.1]], 'glass', Z.wallM);
    plane(g, 4.4, 4.8, std(0xd8d2c8, { roughness: 0.4 }), 3.7, 0.006, 2.75, -Math.PI / 2);
    plane(g, 2.8, 2.6, std(0xd8d2c8, { roughness: 0.4 }), 4.6, 0.006, -1.2, -Math.PI / 2);
    sign(g, '스튜디오 풍논', 2.3, 2.3, ZcS + 0.04, 1.4, 0, '#111216', '#ffd8a8');
    sofa(Z, g, 5.35, 3.4, 1.8, -Math.PI / 2, std(0x2a2c30, { roughness: 0.9 }));
    plant(g, 5.4, 1.0, 1.1);
    Z.block(5.0, 5.8, 0.6, 1.4);
    box(g, 1.6, 0.01, 1.0, std(0x3a2a22), 3.6, 0.008, 4.4);
    // 택배 상자
    for (const [x, y, z] of [[2.2, 0.2, 4.5], [2.55, 0.2, 4.5], [2.35, 0.55, 4.5]]) box(g, 0.34, 0.34, 0.34, std(0xc8a070), x, y, z);
    Z.block(1.9, 2.8, 4.25, 4.75);
    Z.trigger('go', 3.1, 4.1, 4.85, 5.4, 'B0', 'lobby');
    Z.trigger('go', -12.2, 1.2, 4.85, 5.4, 'B0', 'park');
    Z.at('door', 3.6, 4.2, Math.PI);
    Z.at('park', -6.0, 4.2, Math.PI);
    Z.spot('guard', 4.6, 0.9, -Math.PI / 2, false);
    Z.spot('courier', 2.6, 3.9, Math.PI, false);
    Z.spot('driver', -9.2, 0.0, 0, false);
    Z.light(-9.0, 2.7, -1.0, 0xfff2e0, 12, 12);
    Z.light(-3.0, 2.7, 1.0, 0xfff2e0, 12, 12);
    Z.light(3.8, 2.6, 1.0, 0xffe2b8, 14, 11);
    scene.add(mergeStatic(g));
  }

  // ---------- 2층: COMP 1~3실, DP·COMP·3D·ART팀, Specialist실 ----------
  {
    const Z = floorBase('B2', { west: -12.4, floor: 0x3a3e46, wall: 0xd8dade, windows: [[-12.2, -2.0]] });
    const g = Z.g;
    const W = Z.wallM;
    // 뒷줄 팀 자리. 팀마다 책상 둘과 팀 이름
    wallRun(Z, g, 'x', ZcN, -12.4, -1.8, [[-11.0, -10.1], [-5.6, -4.7]], 'low', W);
    const teams = [['DP팀', -11.1, 0], ['COMP팀', -8.4, 1], ['3D팀', -5.7, 3], ['ART팀', -3.0, 5]];
    teams.forEach(([t, x, kind], i) => {
      desk(Z, g, 't' + i + 'a', x, -4.35, kind);
      desk(Z, g, 't' + i + 'b', x, -2.35, kind);
      sign(g, t, x, 2.55, Zb + 0.02, 1.0, 0, '#2a2c30', '#8fe0d0');
      // 팀 사이 칸막이. 앞쪽은 지나다닐 수 있게 짧게
      if (i) box(g, 0.06, 1.2, 3.1, std(0x8a9096), x - 1.35, 0.6, -3.55);
      if (i) Z.block(x - 1.42, x - 1.28, -5.1, -2.0);
    });
    // 아트팀 이젤
    box(g, 0.06, 1.6, 0.06, woodM, -1.9 - 0.3, 0.8, -1.6);
    plane(g, 0.7, 0.9, screens[5], -2.2, 1.3, -1.56);
    // 창고
    wallRun(Z, g, 'z', -1.8, Zb, ZcN, [], 'full', W);
    wallRun(Z, g, 'x', ZcN, -1.8, -0.05, [], 'full', W);
    Z.block(-1.8, -0.05, Zb, ZcN);
    sign(g, '창고', -0.92, 2.2, ZcN + 0.08, 0.8);
    // 앞줄. COMP 1~3실, Specialist실, 회의실
    wallRun(Z, g, 'x', ZcS, -12.4, 5.95, [[-12.2, -11.3], [-8.4, -7.5], [-4.6, -3.7], [-0.9, 0.0], [1.6, 2.5]], 'low', W);
    for (const x of [-8.7, -4.9, -1.1, 1.45]) wallRun(Z, g, 'z', x, ZcS, Zf, [], 'low', W);
    [['COMP 1실', -10.55], ['COMP 2실', -6.8], ['COMP 3실', -3.0]].forEach(([t, cx], i) => {
      for (const [dx, z, k] of [[-0.6, 1.6, 'c' + i + 'a'], [0.6, 1.6, null], [-0.6, 3.6, null], [0.6, 3.6, 'c' + i + 'b']]) desk(Z, g, k, cx + dx, z, 1);
      sign(g, t, cx, 2.35, ZcS + 0.04, 1.0);
    });
    desk(Z, g, 'spec', 0.15, 2.0, 2);
    desk(Z, g, null, 0.15, 3.9, 0);
    sign(g, 'Specialist실', 0.15, 2.35, ZcS + 0.04, 1.2);
    // 회의실
    box(g, 2.4, 0.06, 1.1, deskM, 3.65, 0.74, 2.75);
    box(g, 0.1, 0.7, 0.8, legM, 2.7, 0.37, 2.75);
    box(g, 0.1, 0.7, 0.8, legM, 4.6, 0.37, 2.75);
    Z.block(2.4, 4.9, 2.15, 3.35);
    for (const x of [2.95, 4.35]) {
      chair(g, x, 1.85, 0);
      chair(g, x, 3.65, Math.PI);
    }
    sign(g, '회의실', 3.65, 2.35, ZcS + 0.04, 1.0);
    pantry(Z, g);
    Z.light(-8.0, 2.7, -2.0, 0xe8eeff, 13, 13);
    Z.light(-5.0, 2.7, 2.8, 0xe8eeff, 12, 13);
    Z.light(2.5, 2.7, 1.0, 0xfff0e0, 12, 12);
    scene.add(mergeStatic(g));
  }

  // ---------- 3층: CGI 1~3실, 서버실 ----------
  {
    const Z = floorBase('B3', { west: -12.4, floor: 0x2c3038, wall: 0x3a3e48, windows: [[-12.2, -2.0]] });
    const g = Z.g;
    const W = Z.wallM;
    wallRun(Z, g, 'x', ZcN, -12.4, -1.8, [[-12.0, -11.1], [-7.95, -7.05]], 'low', W);
    let n = 0;
    for (const z of [-4.35, -2.35]) for (const x of [-11.4, -10.1, -8.8, -6.2, -4.9, -3.6]) desk(Z, g, n % 5 === 0 ? 'g1_' + n : null, x, z, [3, 1, 3, 2][n++ % 4]);
    sign(g, 'CGI 1실', -7.5, 2.55, Zb + 0.02, 1.0, 0, '#1a2a3a', '#9fd0ff');
    // 서버실. 유리 너머로 불빛이 깜빡인다
    wallRun(Z, g, 'z', -1.8, Zb, ZcN, [], 'low', W);
    wallRun(Z, g, 'x', ZcN, -1.8, -0.05, [], 'low', W);
    Z.block(-1.8, -0.05, Zb, ZcN);
    for (const x of [-1.35, -0.5]) box(g, 0.7, 2.1, 0.9, std(0x15161a), x, 1.05, -4.5);
    for (let i = 0; i < 32; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), anim.ledA);
      led.position.set(Z.c.x + (i < 16 ? -1.35 : -0.5) + ((i % 2) - 0.5) * 0.3, 0.3 + ((i % 16) >> 1) * 0.22, Z.c.z - 4.04);
      scene.add(led);
      anim.leds.push(led);
    }
    sign(g, '서버실', -0.92, 2.2, ZcN + 0.08, 0.8);
    // 앞줄 CGI 2실, CGI 3실
    wallRun(Z, g, 'x', ZcS, -12.4, 5.95, [[-5.2, -4.3], [-3.2, -2.3]], 'low', W);
    wallRun(Z, g, 'z', -3.6, ZcS, Zf, [], 'low', W);
    n = 0;
    for (const z of [1.6, 3.6]) for (const x of [-11.4, -10.0, -8.6, -7.2, -5.8]) desk(Z, g, n % 4 === 1 ? 'g2_' + n : null, x, z, [1, 3, 2][n++ % 3]);
    for (const z of [1.6, 3.6]) for (const x of [-2.6, -1.2, 0.2]) desk(Z, g, n % 3 === 0 ? 'g3_' + n : null, x, z, [3, 0][n++ % 2]);
    sign(g, 'CGI 2실', -8.6, 2.35, ZcS + 0.04, 1.0, 0, '#1a2a3a', '#9fd0ff');
    sign(g, 'CGI 3실', -0.5, 2.35, ZcS + 0.04, 1.0, 0, '#1a2a3a', '#9fd0ff');
    // 리뷰 화면과 소파
    box(g, 2.0, 1.15, 0.08, monM, 3.9, 1.45, 1.05);
    plane(g, 1.9, 1.05, screens[3], 3.9, 1.45, 1.1);
    box(g, 0.1, 0.9, 0.1, legM, 3.9, 0.45, 1.0);
    Z.block(2.85, 4.95, 0.85, 1.25);
    sofa(Z, g, 3.9, 3.6, 2.0, Math.PI, std(0x2a3a5a, { roughness: 0.9 }));
    Z.spot('sup', 2.6, 2.2, 0.6, false);
    pantry(Z, g);
    Z.light(-7.5, 2.7, -2.4, 0xc4d4ff, 15, 13);
    Z.light(-6.0, 2.7, 2.6, 0xc4d4ff, 15, 13);
    Z.light(1.0, 2.7, 2.6, 0xdfe8ff, 13, 12);
    scene.add(mergeStatic(g));
  }

  // ---------- 4층: 평면도 그대로. 경영지원실, 재무팀, 창고, CFO실, 대표실, 신사업실, 회의실, 테라스 ----------
  {
    const wood = new THREE.MeshStandardMaterial({ map: stripeTex('#b48a62', '#8a6444', 12, false), roughness: 0.7 });
    const Z = floorBase('B4', { west: -8.0, floor: 0xcfc8bc, wall: 0xeae6de, westGlass: true, windows: [[-7.8, -2.0]] });
    // 처음 시작하는 자리. 복도 가운데
    Z.at('start', -3.4, -0.22, 0);
    // 테라스까지 갈 수 있게 왼쪽 경계를 넓힌다
    Z.bounds.x0 = Z.c.x - 12.15;
    const g = Z.g;
    const W = Z.wallM;
    // 테라스. 눌러서 걸어갈 수 있게 누르는 바닥도 깐다
    floorPlane(g, 4.4, Zf - Zb, wood, -10.2, 0);
    pickFloor(Z, 4.4, Zf - Zb, -10.2, 0);
    const rail = new THREE.MeshStandardMaterial({ color: 0xa8c8d8, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false });
    box(g, 0.04, 1.0, Zf - Zb, rail, -12.4, 0.5, 0);
    box(g, 4.4, 1.0, 0.04, rail, -10.2, 0.5, Zb);
    box(g, 4.4, 0.06, 0.06, frameM, -10.2, 1.0, Zb);
    box(g, 0.06, 0.06, Zf - Zb, frameM, -12.4, 1.0, 0);
    // 테라스 문을 빼고는 통유리
    wallRun(Z, g, 'z', -8.0, Zb, Zf, [[-4.9, -4.0]], 'glass', W);
    for (const [x, z] of [[-10.6, -2.0], [-10.6, 2.0]]) {
      cyl(g, 0.45, 0.45, 0.05, std(0xf2f0ea), x, 0.74, z, 18);
      cyl(g, 0.04, 0.06, 0.72, legM, x, 0.36, z, 8);
      chair(g, x - 0.75, z, Math.PI / 2, std(0x6a7a5a));
      chair(g, x + 0.75, z, -Math.PI / 2, std(0x6a7a5a));
      Z.block(x - 1.05, x + 1.05, z - 0.5, z + 0.5);
    }
    for (const z of [-4.4, 4.4]) {
      box(g, 1.4, 0.5, 0.5, std(0x5a4a3a), -11.6, 0.25, z);
      plant(g, -11.6, z, 0.8);
      Z.block(-12.35, -10.85, z - 0.3, z + 0.3);
    }
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), basic(0xffd890));
      b.position.set(-10.2 + Math.sin(i * 0.7) * 0.3, 2.4 - Math.sin((i / 8) * Math.PI) * 0.3, -4.6 + i * 1.15);
      g.add(b);
    }
    box(g, 0.08, 2.5, 0.08, frameM, -10.2, 1.25, -4.9);
    box(g, 0.08, 2.5, 0.08, frameM, -10.2, 1.25, 4.9);
    sign(g, '테라스', -10.2, 2.2, Zb + 0.04, 0.9, 0, '#2a2c30');
    // 문 옆 흡연 구역. 스탠드 재떨이(모래 위 꽁초)와 표지
    {
      const steel = std(0x3a3d44, { metalness: 0.4, roughness: 0.5 });
      cyl(g, 0.17, 0.2, 0.1, steel, -9.6, 0.72, -4.65, 16);
      cyl(g, 0.15, 0.15, 0.01, std(0xd8cdb0, { roughness: 1 }), -9.6, 0.775, -4.65, 16);
      cyl(g, 0.035, 0.035, 0.68, steel, -9.6, 0.34, -4.65, 8);
      cyl(g, 0.2, 0.22, 0.03, steel, -9.6, 0.015, -4.65, 16);
      for (const [dx, dz, r] of [[0.05, 0.02, 0.4], [-0.06, 0.04, 1.9], [0.01, -0.07, 2.8]]) {
        const butt = box(g, 0.06, 0.016, 0.016, std(0xe8dcc4), -9.6 + dx, 0.79, -4.65 + dz);
        butt.rotation.y = r;
      }
      Z.block(-9.85, -9.35, -4.9, -4.4);
      sign(g, '흡연 구역', -8.07, 1.55, -3.55, 0.7, -Math.PI / 2, '#2a2c30', '#ffd36f');
    }
    // 뒷줄. 경영지원실 | 재무팀 | 창고
    wallRun(Z, g, 'x', ZcN, -8.0, -1.8, [[-7.9, -7.0], [-2.75, -1.95]], 'low', W);
    wallRun(Z, g, 'z', -4.4, Zb, ZcN, [], 'low', W);
    // 왼쪽 방은 재무팀. 책상 넷을 붙이고 좌우로 마주 본다
    //   풍뎅이 →  ← 연구리
    //   공석   →  ← 조풍순
    sideDesk(Z, g, 'lead', -6.4, -3.6, 1, 4, 0.55);
    sideDesk(Z, g, 'yeonguri', -5.8, -3.6, -1, 4);
    sideDesk(Z, g, 'empty', -6.4, -2.5, 1, 0);
    sideDesk(Z, g, 'pungsun', -5.8, -2.5, -1, 4);
    sidePlate(g, '팀장 풍뎅이', -6.4, -3.6, 1, true);
    sidePlate(g, '사원 연구리', -5.8, -3.6, -1, true);
    sidePlate(g, '사원 조풍순', -5.8, -2.5, -1, false);
    // 섬 머리(뒷벽 쪽)에 고문 주피 자리. 섬을 내려다보듯 앞(+z)을 보고 앉는다
    // 뒷벽에 의자가 묻히지 않게 책상을 조금 얕게(0.5) 둔다
    box(g, 1.0, 0.05, 0.5, deskM, -6.1, 0.74, -4.42);
    for (const dx of [-0.45, 0.45]) box(g, 0.05, 0.72, 0.45, legM, -6.1 + dx, 0.36, -4.42);
    box(g, 0.6, 0.32, 0.03, monM, -6.1, 1.03, -4.25);
    plane(g, 0.56, 0.28, screens[2], -6.1, 1.03, -4.267, 0, Math.PI);
    box(g, 0.04, 0.2, 0.04, monM, -6.1, 0.86, -4.23);
    box(g, 0.44, 0.02, 0.14, std(0x2a2a2e), -6.1, 0.77, -4.5);
    chair(g, -6.1, -4.95, 0, chairM);
    Z.block(-6.6, -5.6, -4.67, -4.17);
    Z.spot('jupi', -6.1, -4.95, 0);
    addSeat(Z, -6.1, -4.95, 0, 'jupi');
    box(g, 0.04, 0.5, 0.04, std(0x2a1c14), -6.1, 1.1, -4.19);
    plane(g, 0.6, 0.17, new THREE.MeshBasicMaterial({ map: textTex(240, 66, '#2a1c14', [['고문 주피', 34, '#ffe1b8']]) }), -6.1, 1.4, -4.16);
    sign(g, '재무팀', -6.2, 2.55, Zb + 0.02, 1.2);
    // 오른쪽 방은 경영지원팀. 인턴 둘이 마주 본다
    desk(Z, g, 'intern1', -3.3, -3.25, 4, true, true);
    desk(Z, g, 'intern2', -3.3, -2.65, 4);
    flatPlate(g, '인턴 풍준', -3.3, -3.25, -1);
    flatPlate(g, '인턴 풍열', -3.3, -2.65, 1);
    sign(g, '경영지원팀', -3.1, 2.55, Zb + 0.02, 1.0);
    wallRun(Z, g, 'z', -1.8, Zb, ZcN, [], 'full', W);
    wallRun(Z, g, 'x', ZcN, -1.8, -0.05, [], 'full', W);
    box(g, 0.8, 2.1, 0.04, std(0xb8a890), -1.2, 1.05, ZcN + 0.07);
    Z.block(-1.8, -0.05, Zb, ZcN);
    sign(g, '창고', -0.6, 2.35, ZcN + 0.08, 0.7);
    // 앞줄. CFO실 | 대표실 | 신사업실 | 회의실
    wallRun(Z, g, 'x', ZcS, -8.0, 5.95, [[-6.05, -5.45], [-2.95, -2.35], [-1.85, -1.25], [1.6, 2.5]], 'low', W);
    for (const x of [-5.3, -2.1, 1.45]) wallRun(Z, g, 'z', x, ZcS, Zf, [], 'low', W);
    // CFO실(상무 희동)
    // 상무 희동과 대표 강아지 장은 뒤(복도 쪽)를 보고 앉는다
    execDesk(Z, g, 'cfo', -6.75, 2.2, 1.5, '상무 희동', true);
    shelf(Z, g, -7.6, 4.0, 1.3, Math.PI / 2);
    sofa(Z, g, -6.1, 4.55, 1.3, Math.PI, std(0x4a3a2a, { roughness: 0.9 }));
    sign(g, 'CFO실', -6.65, 2.35, ZcS + 0.04, 0.9);
    // 대표실(대표 강아지 장)
    execDesk(Z, g, 'ceo', -3.7, 2.2, 1.8, '대표 강아지 장', true);
    sofa(Z, g, -3.7, 4.7, 2.0, Math.PI, std(0x2a2a30, { roughness: 0.8 }));
    lowTable(Z, g, -3.7, 3.85, 1.1, 0.5);
    // 강아지 방석과 뼈다귀
    cyl(g, 0.38, 0.4, 0.12, std(0xc89a6a, { roughness: 1 }), -2.6, 0.06, 1.0, 20);
    box(g, 0.22, 0.05, 0.05, std(0xf4f0e6), -2.62, 0.15, 1.0);
    for (const dx of [-0.11, 0.11]) cyl(g, 0.035, 0.035, 0.06, std(0xf4f0e6), -2.62 + dx, 0.15, 1.0, 8).rotation.x = Math.PI / 2;
    plant(g, -4.95, 0.8, 0.9);
    Z.block(-5.15, -4.75, 0.6, 1.0);
    sign(g, '대표실', -3.7, 2.35, ZcS + 0.04, 0.9, 0, '#2a1c14', '#ffe1b8');
    // 신사업실(고문 주피)
    desk(Z, g, 'new1', -1.25, 1.6, 4);
    desk(Z, g, null, 0.65, 1.6, 0);
    desk(Z, g, 'new2', 0.65, 3.6, 4);
    chair(g, -1.2, 3.75, 0, std(0x6a3a2a));
    cyl(g, 0.35, 0.35, 0.04, woodM, -1.2, 0.6, 4.5, 18);
    cyl(g, 0.04, 0.05, 0.58, legM, -1.2, 0.3, 4.5, 8);
    cyl(g, 0.05, 0.04, 0.08, std(0x6a9a6a), -1.1, 0.66, 4.45, 10);
    cyl(g, 0.05, 0.04, 0.08, std(0x6a9a6a), -1.3, 0.66, 4.55, 10);
    Z.block(-1.6, -0.8, 4.1, 4.9);
    // 고문 주피 자리는 재무팀 섬 머리로 옮겼다. 찻상 의자는 그대로 앉을 수 있다(자리 번호 유지)
    addSeat(Z, -1.2, 3.75, 0);
    copier(Z, g, 1.0, 0.75);
    sign(g, '신사업실', -0.3, 2.35, ZcS + 0.04, 1.0);
    // 회의실
    box(g, 2.4, 0.06, 1.1, deskM, 3.65, 0.74, 2.75);
    box(g, 0.1, 0.7, 0.8, legM, 2.7, 0.37, 2.75);
    box(g, 0.1, 0.7, 0.8, legM, 4.6, 0.37, 2.75);
    Z.block(2.4, 4.9, 2.15, 3.35);
    // 회의실 의자도 앉을 수 있다(엎드려 자기). 맨 끝에 붙여서 다른 자리 번호는 그대로
    let mi = 0;
    for (const x of [2.95, 4.35]) {
      chair(g, x, 1.85, 0);
      chair(g, x, 3.65, Math.PI);
      addSeat(Z, x, 1.85, 0, 'meet' + mi++);
      addSeat(Z, x, 3.65, Math.PI, 'meet' + mi++);
    }
    chair(g, 2.0, 2.75, Math.PI / 2);
    addSeat(Z, 2.0, 2.75, Math.PI / 2, 'meet' + mi++);
    box(g, 0.06, 1.0, 1.7, monM, 5.88, 1.5, 2.75);
    plane(g, 1.6, 0.9, screens[4], 5.84, 1.5, 2.75, 0, -Math.PI / 2);
    sign(g, '회의실', 3.65, 2.35, ZcS + 0.04, 0.9);
    pantry(Z, g);
    Z.light(-4.4, 2.8, -0.9, 0xfff4e4, 11, 12);
    Z.light(-3.5, 2.7, 2.6, 0xffe8cc, 12, 12);
    Z.light(2.8, 2.7, 1.2, 0xfff4e4, 11, 12);
    scene.add(mergeStatic(g));
  }

  // ---------- 엘리베이터 안 ----------
  // 사진처럼 헤어라인 스테인리스 벽, 왼쪽 판에 층 안내판, 가운데 문, 문에 주의 스티커
  {
    const Z = zone('EV', BX, -FLOOR_GAP * SLOT.EV, [-1.15, 1.15, -0.85, 1.0]);
    const g = Z.g;
    const hl = hairlineTex();
    const steel = new THREE.MeshStandardMaterial({ map: hl, metalness: 0.3, roughness: 0.38 });
    const steelSide = new THREE.MeshStandardMaterial({ map: hl, metalness: 0.3, roughness: 0.38 });
    floorPlane(g, 3.0, 2.6, new THREE.MeshStandardMaterial({ map: speckleTex('#2a2a2e', ['#4a4a50', '#1a1a1e', '#6a6a70']), roughness: 0.5 }), 0, 0);
    // 뒷벽: 왼쪽 판, 문 두 짝, 오른쪽 판
    box(g, 1.0, 2.6, 0.08, steel, -1.0, 1.3, -1.3);
    box(g, 0.5, 2.6, 0.08, steel, 1.25, 1.3, -1.3);
    box(g, 0.72, 2.3, 0.05, steel, -0.13, 1.15, -1.32);
    box(g, 0.72, 2.3, 0.05, steel, 0.63, 1.15, -1.32);
    box(g, 0.04, 2.3, 0.06, std(0x1a1a1e), 0.25, 1.15, -1.3);
    box(g, 1.55, 0.3, 0.1, std(0x2a2c30), 0.25, 2.45, -1.3);
    for (const x of [-0.5, 1.0]) box(g, 0.06, 2.6, 0.12, std(0x1a1a1e), x, 1.3, -1.28);
    plane(g, 0.62, 0.97, new THREE.MeshBasicMaterial({ map: directoryTex() }), -1.0, 1.55, -1.25);
    plane(g, 0.4, 0.22, new THREE.MeshBasicMaterial({ map: textTex(200, 110, '#f4f6fa', [['검사필', 26, '#1a3a8a'], ['승강기 안전', 18, '#2a2c30']], '#1a3a8a') }), -1.0, 2.25, -1.25);
    const sticker = (t) =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(120, 150, (c, w, h) => {
          c.fillStyle = '#ffffff';
          c.fillRect(0, 0, w, h);
          c.fillStyle = '#f2d21a';
          c.fillRect(6, 6, w - 12, 26);
          c.fillStyle = '#1a3a8a';
          c.font = '700 18px sans-serif';
          c.textAlign = 'center';
          c.fillText('주 의', w / 2, 26);
          c.fillStyle = '#2a2c30';
          c.beginPath();
          c.arc(w / 2, 76, 26, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#f2d21a';
          c.lineWidth = 6;
          c.beginPath();
          c.moveTo(w / 2 - 30, 50);
          c.lineTo(w / 2 + 30, 102);
          c.stroke();
          c.fillStyle = '#1a3a8a';
          c.fillRect(6, 112, w - 12, 30);
          c.fillStyle = '#fff';
          c.font = '700 15px sans-serif';
          c.fillText(t, w / 2, 133);
        }),
      });
    plane(g, 0.24, 0.3, sticker('손대지 마시오'), 0.1, 1.4, -1.29);
    plane(g, 0.24, 0.3, sticker('기대면 위험'), 0.6, 1.4, -1.29);
    // 버튼판
    box(g, 0.22, 0.8, 0.03, std(0x2a2c30), 1.25, 1.2, -1.25);
    ['4', '3', '2', '1', 'B1'].forEach((t, i) => {
      const b = cyl(g, 0.045, 0.045, 0.02, basic(0xffe0a0), 1.25, 1.48 - i * 0.12, -1.23, 12);
      b.rotation.x = Math.PI / 2;
    });
    // 옆벽과 손잡이
    for (const sx of [-1, 1]) {
      box(g, 0.08, 2.6, 2.6, steelSide, sx * 1.5, 1.3, 0);
      box(g, 0.05, 0.05, 2.0, std(0xd8dade, { metalness: 0.4, roughness: 0.3 }), sx * 1.38, 0.9, -0.05);
      for (const dz of [-0.95, 0.85]) box(g, 0.12, 0.04, 0.04, std(0xd8dade), sx * 1.43, 0.9, dz);
    }
    box(g, 3.0, 0.04, 0.12, std(0xf4f6ff), 0, 2.62, -1.2);
    Z.block(-1.6, 1.6, -1.6, -1.2);
    // 안내판이나 문을 누르면 층을 고른다
    pickBox(Z, 3.0, 2.6, 0.4, 0, 1.3, -1.25, { cabin: true });
    Z.at('in', 0, 0.25, 0);
    Z.at('elev', 0, 0.25, 0);
    pickFloor(Z, 3.0, 2.6, 0, 0);
    Z.light(0, 2.4, 0.6, 0xf4f6ff, 2.6, 6);
    Z.light(0, 2.0, -0.5, 0xe8ecff, 1.4, 4);
    scene.add(mergeStatic(g));
  }

  // 지금 있는 구역에만 조명을 켠다. 조명 수를 늘리지 않으려고 셋을 돌려 쓴다
  const pool = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xffffff, 0, 10, 1.3);
    scene.add(l);
    return l;
  });
  // 거리는 멀리서 보므로 안개를 옅게
  const fog0 = scene.fog ? scene.fog.density : 0;
  function setActive(code) {
    if (scene.fog) scene.fog.density = code === 'B0' ? 0.011 : fog0;
    const Z = zones[code];
    pool.forEach((l, i) => {
      const d = Z && Z.lights[i];
      if (!d) {
        l.intensity = 0;
        return;
      }
      l.position.copy(d.pos);
      l.color.setHex(d.color);
      l.intensity = d.intensity;
      l.distance = d.dist;
    });
  }
  setActive(null);

  function update(dt) {
    anim.t += dt;
    if (anim.t % 0.25 < dt) for (const led of anim.leds) led.material = Math.random() < 0.6 ? anim.ledA : anim.ledB;
    const f = 0.85 + 0.15 * Math.sin(anim.t * 7) * Math.sin(anim.t * 2.3);
    for (const m of anim.screens) m.color.setScalar(f);
  }

  // 구역 안 길 찾기
  function path(code, from, to) {
    const Z = zones[code];
    return gridPath(from, to, Z.obstacles, Z.bounds);
  }

  const seatById = (id) => {
    const [code, i] = String(id || '').split(':');
    return (zones[code] && zones[code].seats[+i]) || null;
  };

  return { zones, picks, setActive, update, path, seatById };
}
