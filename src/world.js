// 숲 콘셉트 주점 실내. 바닥, 잎 벽, 바, 테이블, 조명, 반딧불
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Particles } from './particles.js';
import { mergeStatic } from './merge.js';

export const ROOM = { w: 20, d: 14, h: 4.6 };
const HX = ROOM.w / 2;
const HZ = ROOM.d / 2;
export const TABLE_H = 0.58;
const SEAT_H = 0.35;

const rnd = (a, b) => a + Math.random() * (b - a);

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 8;
  return t;
}

// 원목 바닥
function floorTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 300;
      while (x < w) {
        const len = rnd(220, 420);
        const l = rnd(22, 27);
        g.fillStyle = `hsl(${rnd(28, 32)}, ${rnd(26, 32)}%, ${l}%)`;
        g.fillRect(x, r * rh, len, rh);
        // 나뭇결
        g.strokeStyle = `rgba(30,15,5,${rnd(0.08, 0.18)})`;
        g.lineWidth = 1;
        for (let k = 0; k < 7; k++) {
          const y = r * rh + rnd(4, rh - 4);
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + rnd(-5, 5), x + len * 0.7, y + rnd(-5, 5), x + len, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(10,5,2,0.55)';
        g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(10,5,2,0.6)';
      g.fillRect(0, r * rh, w, 2);
    }
  }, [7, 5]);
}

// 잎 한 장. 흰색으로 그리고 인스턴스 색으로 물들인다
function leafTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(64, 6);
    g.bezierCurveTo(118, 40, 108, 100, 64, 122);
    g.bezierCurveTo(20, 100, 10, 40, 64, 6);
    g.fill();
    g.strokeStyle = 'rgba(120,140,110,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(64, 14);
    g.lineTo(64, 118);
    g.stroke();
    g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const y = 34 + i * 16;
      g.beginPath();
      g.moveTo(64, y + 8);
      g.lineTo(40, y - 4);
      g.moveTo(64, y + 8);
      g.lineTo(88, y - 4);
      g.stroke();
    }
  });
}

// 간판 글자
function signTexture() {
  return canvasTex(1024, 320, (g, w, h) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '150px "Nanum Pen Script", "Gaegu", cursive';
    g.shadowColor = '#ff9d5c';
    g.shadowBlur = 30;
    g.fillStyle = '#ffe1b8';
    g.fillText('풍속의 밤', w / 2 + 40, h / 2 - 20);
    g.shadowBlur = 0;
    // 초승달
    g.fillStyle = '#ffe1b8';
    g.beginPath();
    g.arc(190, 120, 52, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(214, 104, 48, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.font = '600 34px "Gowun Dodum", sans-serif';
    g.fillStyle = '#ffd3a1';
    g.fillText('P U N G S O K   N I G H T', w / 2 + 40, h - 52);
  });
}

function blobTexture() {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}

export function buildWorld(scene) {
  const W = { tables: [], seats: [], obstacles: [], pickables: [], pots: [], bulbs: [], lights: [] };

  scene.background = new THREE.Color(0x070b08);
  scene.fog = new THREE.FogExp2(0x0a0f0b, 0.028);

  scene.add(new THREE.HemisphereLight(0xffd7a8, 0x1a2a1c, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb8ff, 0.25);
  moon.position.set(-6, 10, 8);
  scene.add(moon);

  // 바닥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), std(0xffffff, { map: floorTexture(), roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.floor = true;
  scene.add(floor);
  W.floor = floor;

  // 입구 밖 돌바닥과 디딤돌
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w + 10, 8), std(0x1d1b16, { roughness: 1 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.set(0, -0.002, HZ + 4);
  scene.add(outside);
  const stoneM = std(0x8a8274, { roughness: 0.95 });
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(rnd(0.32, 0.4), rnd(0.34, 0.42), 0.04, 9), stoneM);
    st.position.set(rnd(-0.25, 0.25), 0.02, HZ + 0.5 + i * 0.85);
    st.rotation.y = Math.random() * 3;
    scene.add(st);
  }

  // 벽. 아래는 나무 판, 위는 잎으로 덮는다
  const wallM = std(0x16251a);
  const woodDark = std(0x3a2416, { roughness: 0.7 });
  const walls = [
    { w: ROOM.w, pos: [0, ROOM.h / 2, -HZ], ry: 0 },
    { w: ROOM.d, pos: [-HX, ROOM.h / 2, 0], ry: Math.PI / 2 },
    { w: ROOM.d, pos: [HX, ROOM.h / 2, 0], ry: -Math.PI / 2 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w.w, ROOM.h), wallM);
    m.position.set(...w.pos);
    m.rotation.y = w.ry;
    scene.add(m);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w.w, 1.1, 0.06), woodDark);
    panel.position.set(w.pos[0], 0.55, w.pos[2]);
    panel.rotation.y = w.ry;
    panel.translateZ(0.03);
    scene.add(panel);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w.w, 0.06, 0.12), std(0x5a3a22));
    rail.position.set(w.pos[0], 1.12, w.pos[2]);
    rail.rotation.y = w.ry;
    rail.translateZ(0.06);
    scene.add(rail);
  }

  // 잎 벽과 늘어진 덩굴
  const leafTex = leafTexture();
  const leafGeo = new THREE.PlaneGeometry(0.34, 0.42);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65 });
  const leaves = [];
  const addLeaf = (x, y, z, nx, nz, s = 1) => leaves.push({ x, y, z, nx, nz, s });

  // 바 뒤 선반과 간판 자리는 비운다
  const inShelf = (x, y) => Math.abs(x) < 3.7 && y > 1.15 && y < 2.4;
  const inSign = (x, y) => Math.abs(x) < 2.3 && y > 2.35 && y < 3.7;
  for (let i = 0; i < 2600; i++) {
    const y = 1.1 + Math.pow(Math.random(), 0.8) * (ROOM.h - 1.0);
    const x = rnd(-HX, HX);
    if (inShelf(x, y) || inSign(x, y)) continue;
    addLeaf(x, y, -HZ + rnd(0.04, 0.22), 0, 1);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 1500; i++) {
      const y = 1.1 + Math.pow(Math.random(), 0.8) * (ROOM.h - 1.0);
      addLeaf(side * (HX - rnd(0.04, 0.22)), y, rnd(-HZ, HZ), -side, 0);
    }
  }
  // 벽 위에서 늘어진 덩굴
  const vine = (x0, z0, nx, nz) => {
    const len = rnd(0.6, 2.4);
    for (let y = ROOM.h; y > ROOM.h - len; y -= rnd(0.1, 0.16)) {
      addLeaf(x0 + rnd(-0.08, 0.08) + nx * 0.25, y, z0 + rnd(-0.08, 0.08) + nz * 0.25, nx, nz, 0.75);
    }
  };
  for (let i = 0; i < 46; i++) {
    const x = rnd(-HX + 0.3, HX - 0.3);
    if (Math.abs(x) < 2.6) continue;
    vine(x, -HZ, 0, 1);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 26; i++) vine(side * HX, rnd(-HZ, HZ), -side, 0);

  // 앞쪽 낮은 화단. 가운데는 입구로 비운다
  const boxM = std(0x4a2e1c, { roughness: 0.8 });
  for (const side of [-1, 1]) {
    const len = HX - 1.3;
    const cx = side * (1.3 + len / 2);
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.5), boxM);
    box.position.set(cx, 0.275, HZ - 0.25);
    scene.add(box);
    for (let i = 0; i < 520; i++) {
      const x = cx + rnd(-len / 2, len / 2);
      addLeaf(x, 0.55 + Math.pow(Math.random(), 1.5) * 0.7, HZ - 0.25 + rnd(-0.3, 0.3), rnd(-1, 1), rnd(-1, 1), 1.1);
    }
  }
  W.obstacles.push({ x0: -HX, x1: -1.3 + 0.25, z0: HZ - 0.8, z1: HZ + 1 }, { x0: 1.3 - 0.25, x1: HX, z0: HZ - 0.8, z1: HZ + 1 });

  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  leaves.forEach((l, i) => {
    const yaw = Math.atan2(l.nx, l.nz);
    e.set(rnd(-0.6, 0.6), yaw + rnd(-0.5, 0.5), rnd(-Math.PI, Math.PI), 'YXZ');
    q.setFromEuler(e);
    const s = l.s * rnd(0.7, 1.3);
    m4.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(s, s, s));
    leafMesh.setMatrixAt(i, m4);
    col.setHSL(rnd(0.24, 0.36), rnd(0.35, 0.6), rnd(0.16, 0.34));
    leafMesh.setColorAt(i, col);
  });
  scene.add(leafMesh);

  // 잎 사이 작은 꽃
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe8d0, emissiveIntensity: 0.25 }), 260);
  for (let i = 0; i < 260; i++) {
    const l = leaves[(Math.random() * leaves.length) | 0];
    m4.makeTranslation(l.x + l.nx * 0.08, l.y, l.z + l.nz * 0.08);
    flowers.setMatrixAt(i, m4);
    col.setHSL(rnd(0.0, 0.12), rnd(0.3, 0.7), rnd(0.75, 0.9));
    flowers.setColorAt(i, col);
  }
  scene.add(flowers);

  // 바 카운터
  const wood = std(0x7a4f2e, { roughness: 0.55 });
  const woodLight = std(0xa8763f, { roughness: 0.45 });
  const counter = new THREE.Mesh(new RoundedBoxGeometry(7.2, 1.05, 0.75, 3, 0.06), wood);
  counter.position.set(0, 0.525, -5.75);
  counter.castShadow = counter.receiveShadow = true;
  scene.add(counter);
  const counterTop = new THREE.Mesh(new RoundedBoxGeometry(7.5, 0.08, 0.95, 3, 0.03), woodLight);
  counterTop.position.set(0, 1.09, -5.75);
  scene.add(counterTop);
  // 카운터 앞 이끼 띠
  const moss = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 0.05), std(0x3f6b34, { roughness: 1 }));
  moss.position.set(0, 0.88, -5.36);
  scene.add(moss);
  W.obstacles.push({ x0: -3.75 - 0.3, x1: 3.75 + 0.3, z0: -HZ, z1: -5.75 + 0.48 + 0.3 });

  // 선반과 술병
  const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb766).multiplyScalar(3) });
  const bottleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10);
  const neckGeo = new THREE.CylinderGeometry(0.022, 0.03, 0.1, 8);
  const bottleCols = [0x2f8a4a, 0x2f8a4a, 0x2f8a4a, 0x7a4a1c, 0xd8e8e0];
  const bottleCount = 54;
  const bottles = new THREE.InstancedMesh(bottleGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, transparent: true, opacity: 0.85 }), bottleCount);
  const necks = new THREE.InstancedMesh(neckGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, transparent: true, opacity: 0.85 }), bottleCount);
  let bi = 0;
  for (const y of [1.3, 1.95]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.05, 0.35), woodLight);
    board.position.set(0, y, -HZ + 0.18);
    scene.add(board);
    const led = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.015, 0.02), ledM);
    led.position.set(0, y - 0.035, -HZ + 0.33);
    scene.add(led);
    for (let k = 0; k < 27; k++) {
      const x = -3.2 + k * 0.245 + rnd(-0.02, 0.02);
      col.set(bottleCols[(Math.random() * bottleCols.length) | 0]);
      m4.makeTranslation(x, y + 0.155, -HZ + 0.18);
      bottles.setMatrixAt(bi, m4);
      bottles.setColorAt(bi, col);
      m4.makeTranslation(x, y + 0.335, -HZ + 0.18);
      necks.setMatrixAt(bi, m4);
      necks.setColorAt(bi, col);
      bi++;
    }
  }
  scene.add(bottles, necks);
  const barLight = new THREE.PointLight(0xffa860, 4, 7, 1.6);
  barLight.position.set(0, 2.2, -5.6);
  scene.add(barLight);

  // 간판
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 1.25),
    new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, color: new THREE.Color(1, 1, 1).multiplyScalar(1.35), depthWrite: false })
  );
  sign.position.set(0, 3.0, -HZ + 0.06);
  scene.add(sign);
  W.sign = sign;
  W.redrawSign = () => {
    sign.material.map.dispose();
    sign.material.map = signTexture();
  };

  // 테이블
  const blob = blobTexture();
  const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false });
  W.blobMat = blobMat;
  const tableTop = new RoundedBoxGeometry(2.0, 0.08, 1.1, 3, 0.03);
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, TABLE_H - 0.04, 8);
  const stoolTop = new THREE.CylinderGeometry(0.19, 0.19, 0.06, 20);
  const stoolLeg = new THREE.CylinderGeometry(0.05, 0.08, SEAT_H - 0.06, 10);
  const cushion = std(0x3d5a3a, { roughness: 0.95 });
  const seatPickGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.8, 10);
  const shadeGeo = new THREE.ConeGeometry(0.26, 0.24, 20, 1, true);
  const shadeM = new THREE.MeshLambertMaterial({ color: 0xc49a62, side: THREE.DoubleSide, emissive: 0x7a4a1a, emissiveIntensity: 0.4 });
  const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc27a).multiplyScalar(4) });
  const cordM = new THREE.MeshBasicMaterial({ color: 0x1a1410 });

  const layout = [
    [-6, -1.6], [0, -1.6], [6, -1.6],
    [-6, 3.4], [0, 3.4], [6, 3.4],
  ];
  layout.forEach(([tx, tz], ti) => {
    const T = { id: ti, x: tx, z: tz, dishes: [], seats: [] };
    const tg = new THREE.Group();
    const top = new THREE.Mesh(tableTop, woodLight);
    top.position.set(tx, TABLE_H - 0.04, tz);
    top.castShadow = top.receiveShadow = true;
    tg.add(top);
    for (const [lx, lz] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]]) {
      const leg = new THREE.Mesh(legGeo, wood);
      leg.position.set(tx + lx, (TABLE_H - 0.04) / 2, tz + lz);
      tg.add(leg);
    }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.1), blobMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(tx, 0.005, tz);
    tg.add(sh);

    // 의자 4개. 앞뒤로 둘씩, 테이블을 본다
    for (const side of [-1, 1]) {
      for (const ox of [-0.5, 0.5]) {
        const sx = tx + ox;
        const sz = tz + side * 0.86;
        const st = new THREE.Group();
        const s1 = new THREE.Mesh(stoolTop, cushion);
        s1.position.y = SEAT_H - 0.03;
        const s2 = new THREE.Mesh(stoolLeg, wood);
        s2.position.y = (SEAT_H - 0.06) / 2;
        st.add(s1, s2);
        st.position.set(sx, 0, sz);
        tg.add(st);
        const seat = { x: sx, z: sz, yaw: side < 0 ? 0 : Math.PI, table: T, occupant: null };
        const pick = new THREE.Mesh(seatPickGeo, new THREE.MeshBasicMaterial());
        pick.visible = false;
        pick.position.set(sx, 0.4, sz);
        pick.userData.seat = seat;
        scene.add(pick);
        W.pickables.push(pick);
        T.seats.push(seat);
        W.seats.push(seat);
      }
    }

    W.obstacles.push({ x0: tx - 1.0 - 0.28, x1: tx + 1.0 + 0.28, z0: tz - 0.55 - 0.28, z1: tz + 0.55 + 0.28 });

    // 펜던트 조명
    const lamp = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.9, 4), cordM);
    cord.position.y = 0.95 + 0.12;
    const shade = new THREE.Mesh(shadeGeo, shadeM);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), bulbM);
    bulb.position.y = -0.12;
    lamp.add(cord, shade, bulb);
    lamp.position.set(tx, 2.55, tz);
    tg.add(lamp);
    const pl = new THREE.PointLight(0xffa458, 5.5, 6.5, 1.4);
    pl.position.set(tx, 2.25, tz);
    scene.add(pl);
    W.lights.push({ light: pl, base: 5.5, ph: Math.random() * 10 });

    scene.add(mergeStatic(tg));
    W.tables.push(T);
  });

  // 천장을 가로지르는 전구 줄
  const bulbGeo = new THREE.SphereGeometry(0.036, 8, 6);
  const strBulbM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const strands = [];
  for (const z of [-3.9, 1.0]) strands.push([new THREE.Vector3(-HX, 4.3, z), new THREE.Vector3(HX, 4.3, z + rnd(-0.6, 0.6)), 0.6]);
  strands.push([new THREE.Vector3(-HX, 3.7, -HZ + 0.4), new THREE.Vector3(-HX + 0.4, 3.7, HZ), 0.5]);
  strands.push([new THREE.Vector3(HX, 3.7, -HZ + 0.4), new THREE.Vector3(HX - 0.4, 3.7, HZ), 0.5]);
  const strandPts = [];
  for (const [a, b, sag] of strands) {
    const n = Math.round(a.distanceTo(b) / 0.42);
    const line = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      line.push(p);
      if (i % 1 === 0) strandPts.push(p);
    }
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0x2a1f16 }));
    scene.add(wire);
  }
  const strandMesh = new THREE.InstancedMesh(bulbGeo, strBulbM, strandPts.length);
  strandPts.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y - 0.04, p.z);
    strandMesh.setMatrixAt(i, m4);
    strandMesh.setColorAt(i, col.set(0xffc47a).multiplyScalar(rnd(1.8, 3.0)));
  });
  scene.add(strandMesh);
  W.strands = { mesh: strandMesh, n: strandPts.length, ph: strandPts.map(() => Math.random() * 10) };

  // 구석 화분
  const potM = std(0x8a5a3a, { roughness: 0.9 });
  const bigLeaf = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  const potSpots = [[-9.1, 6.1, 1.4], [9.1, 6.1, 1.4], [-9.2, -5.6, 1.1], [9.2, -5.6, 1.1], [-3, 6.4, 0.8], [3, 6.4, 0.8]];
  const plantLeaves = [];
  for (const [px, pz, s] of potSpots) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.24 * s, 0.5 * s, 16), potM);
    pot.position.set(px, 0.25 * s, pz);
    pot.castShadow = true;
    scene.add(pot);
    const n = Math.round(22 * s);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
      const r = rnd(0.1, 0.45) * s;
      const h = 0.5 * s + rnd(0.2, 1.3) * s;
      plantLeaves.push({ x: px + Math.cos(a) * r, y: h, z: pz + Math.sin(a) * r, a, s: s * rnd(1.6, 2.6) });
    }
    W.obstacles.push({ x0: px - 0.45 * s, x1: px + 0.45 * s, z0: pz - 0.45 * s, z1: pz + 0.45 * s });
  }
  const plantMesh = new THREE.InstancedMesh(leafGeo, bigLeaf, plantLeaves.length);
  plantLeaves.forEach((l, i) => {
    e.set(rnd(-1.2, -0.3), -l.a + Math.PI / 2, rnd(-0.4, 0.4), 'YXZ');
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(l.s, l.s, l.s));
    plantMesh.setMatrixAt(i, m4);
    plantMesh.setColorAt(i, col.setHSL(rnd(0.27, 0.34), rnd(0.4, 0.6), rnd(0.2, 0.3)));
  });
  plantMesh.castShadow = true;
  scene.add(plantMesh);

  // 반딧불
  const FN = 140;
  const fireflies = new Particles(FN, { additive: true });
  scene.add(fireflies.points);
  const ff = [];
  for (let i = 0; i < FN; i++) {
    ff.push({ x: rnd(-HX + 0.5, HX - 0.5), y: rnd(0.6, 3.6), z: rnd(-HZ + 0.4, HZ - 0.4), ph: Math.random() * 100, sp: rnd(0.15, 0.4) });
    fireflies.set(i, ff[i].x, ff[i].y, ff[i].z, rnd(5, 9), 0.8, 1.0, 0.9, 0.45);
  }

  // 김, 반짝임
  const steam = new Particles(160, { additive: false });
  scene.add(steam.points);
  const sparks = new Particles(320, { additive: true, gravity: -2.2 });
  scene.add(sparks.points);
  W.sparkle = (p) => {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(0.6, 1.6);
      sparks.emit(p.x, p.y, p.z, Math.cos(a) * v * 0.6, rnd(1.0, 2.2), Math.sin(a) * v * 0.6, rnd(0.6, 1.0), rnd(5, 10), 1.0, rnd(0.75, 0.95), rnd(0.4, 0.6), 1.0);
    }
  };

  // 알록달록 꽃가루
  const cc = new THREE.Color();
  W.confetti = (p) => {
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(0.5, 1.4);
      cc.setHSL(Math.random(), 0.85, 0.6);
      sparks.emit(p.x, p.y, p.z, Math.cos(a) * v, rnd(1.6, 2.8), Math.sin(a) * v, rnd(1.0, 1.6), rnd(6, 10), cc.r, cc.g, cc.b, 1.0);
    }
  };

  W.update = (dt, t) => {
    for (let i = 0; i < FN; i++) {
      const f = ff[i];
      const x = f.x + Math.sin(t * f.sp + f.ph) * 0.8;
      const y = f.y + Math.sin(t * f.sp * 1.7 + f.ph * 2) * 0.35;
      const z = f.z + Math.cos(t * f.sp * 1.3 + f.ph) * 0.8;
      const a = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 1.6 + f.ph * 3)), 3);
      fireflies.setPos(i, x, y, z);
      fireflies.setAlpha(i, a);
    }
    fireflies.flush();

    for (const pot of W.pots) {
      pot.acc += dt;
      if (pot.acc > 0.14) {
        pot.acc = 0;
        steam.emit(pot.x + rnd(-0.1, 0.1), pot.y, pot.z + rnd(-0.1, 0.1), rnd(-0.05, 0.05), rnd(0.25, 0.45), rnd(-0.05, 0.05), rnd(1.4, 2.2), rnd(10, 17), 1, 1, 1, 0.07);
      }
    }
    steam.update(dt, true);
    sparks.update(dt, false);

    for (const L of W.lights) L.light.intensity = L.base * (0.92 + 0.08 * Math.sin(t * 7 + L.ph) * Math.sin(t * 3.1 + L.ph));
    const s = W.strands;
    for (let i = 0; i < s.n; i += 3) {
      s.mesh.setColorAt(i, col.set(0xffc47a).multiplyScalar(1.8 + 1.0 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.ph[i]))));
    }
    s.mesh.instanceColor.needsUpdate = true;
  };

  W.setPixelScale = (v) => {
    fireflies.setScale(v);
    steam.setScale(v);
    sparks.setScale(v);
  };

  W.bounds = { x0: -HX + 0.5, x1: HX - 0.5, z0: -HZ + 0.6, z1: HZ - 0.4 };
  return W;
}
