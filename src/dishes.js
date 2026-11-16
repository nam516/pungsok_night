// 테이블 위 안주와 술병
import * as THREE from 'three';
import { TABLE_H } from './world.js';
import { mergeStatic } from './merge.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const M = {};
function m(key, color, o = {}) {
  if (!M[key]) M[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
  return M[key];
}

export const MENU = [
  { kind: 'jeon', name: '감자전' },
  { kind: 'jeongol', name: '전골' },
  { kind: 'chicken', name: '순살치킨' },
  { kind: 'shrimp', name: '새우튀김' },
];

function plate(r = 0.2) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 0.025, 28), m('plate', 0xf3eee6, { roughness: 0.3 }));
  p.position.y = 0.0125;
  return p;
}

export function makeDish(kind) {
  const g = new THREE.Group();
  if (kind === 'jeon') {
    g.add(plate(0.21));
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.165, 0.025, 24), m('jeon', 0xe7a64a, { roughness: 0.8 }));
    j.position.y = 0.035;
    g.add(j);
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.12;
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), m('cheese', i % 2 ? 0xfff2c4 : 0xe0574a));
      c.scale.y = 0.4;
      c.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
      g.add(c);
    }
  } else if (kind === 'jeongol') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.12, 24), m('pot', 0x3a3a3a, { metalness: 0.5, roughness: 0.45 }));
    pot.position.y = 0.06;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.012, 6, 28), m('pot', 0x3a3a3a));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.185, 24), m('soup', 0xc8452a, { roughness: 0.4, emissive: 0x3a0a00 }));
    soup.rotation.x = -Math.PI / 2;
    soup.position.y = 0.122;
    g.add(pot, rim, soup);
    const cols = [0xf0e6d0, 0x5a8a3a, 0xd9c08a, 0xb33a2a];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.14;
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.035), m('ing' + (i % 4), cols[i % 4]));
      c.position.set(Math.cos(a) * r, 0.128, Math.sin(a) * r);
      c.rotation.y = Math.random() * 3;
      g.add(c);
    }
    g.userData.steam = 0.13;
  } else if (kind === 'chicken') {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.06, 20), m('basket', 0x8a5a2a, { roughness: 0.95 }));
    basket.position.y = 0.03;
    const paper = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), m('paper', 0xf2e6c8));
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = 0.061;
    g.add(basket, paper);
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.12;
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045, 0), m('fried', 0xb8692a, { roughness: 0.9 }));
      c.position.set(Math.cos(a) * r, 0.08 + Math.random() * 0.03, Math.sin(a) * r);
      c.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      g.add(c);
    }
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.006, 6, 10), m('pepper', 0x3fa04a));
      c.position.set(rnd(-0.1, 0.1), 0.12, rnd(-0.1, 0.1));
      c.rotation.x = Math.PI / 2;
      g.add(c);
    }
  } else if (kind === 'shrimp') {
    g.add(plate(0.2));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8), m('tempura', 0xe8b25a, { roughness: 0.9 }));
      s.rotation.z = Math.PI / 2;
      s.rotation.y = -0.5 + i * 0.25;
      s.position.set(0, 0.05, -0.08 + i * 0.04);
      g.add(s);
    }
    const mayo = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 6, 24, Math.PI * 1.6), m('mayo', 0xfff6e0));
    mayo.rotation.x = Math.PI / 2;
    mayo.position.y = 0.085;
    g.add(mayo);
  }
  if (kind === 'refill') {
    // 오뎅 리필. 스테인리스 그릇에 꼬치가 한가득
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.09, 24), m('steel', 0xb8b8b8, { metalness: 0.6, roughness: 0.4 }));
    bowl.position.y = 0.045;
    g.add(bowl);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), m('oden', 0xa8642a, { roughness: 0.4, emissive: 0x2a1000 }));
    soup.rotation.x = -Math.PI / 2;
    soup.position.y = 0.085;
    g.add(soup);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5), m('stick', 0xd9c49a, { roughness: 0.9 }));
      stick.position.set(Math.cos(a) * 0.07, 0.2, Math.sin(a) * 0.07);
      stick.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      const cake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.022), m('fishcake', 0xe8b06a, { roughness: 0.8 }));
      cake.position.y = -0.08;
      stick.add(cake);
      g.add(stick);
    }
    g.userData.steam = 0.1;
  }
  return mergeStatic(g);
}

function bottle(color) {
  const g = new THREE.Group();
  const mt = m('bottle' + color, color, { roughness: 0.35, transparent: true, opacity: 0.85 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 14), mt);
  b.position.y = 0.1;
  const n = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 0.1, 12), mt);
  n.position.y = 0.25;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 10), m('cap', 0xe0e0e0, { metalness: 0.7, roughness: 0.3 }));
  cap.position.y = 0.31;
  g.add(b, n, cap);
  return mergeStatic(g);
}

// 어묵탕 통을 피해 네 칸. 양 끝 두 칸, 통 앞뒤 두 칸. 꽉 차면 가장 오래된 것을 치운다
const SLOTS = [
  { x: -0.78, z: 0 },
  { x: 0.78, z: 0 },
  { x: -0.32, z: 0.35 },
  { x: 0.32, z: -0.35 },
];

export function placeDish(W, scene, table, kind) {
  if (table.dishes.length >= SLOTS.length) {
    const old = table.dishes.shift();
    scene.remove(old.group);
    if (old.pot) W.pots.splice(W.pots.indexOf(old.pot), 1);
  }
  const used = new Set(table.dishes.map((d) => d.slot));
  const slot = SLOTS.findIndex((_, i) => !used.has(i));
  const g = makeDish(kind);
  g.position.set(table.x + SLOTS[slot].x, TABLE_H, table.z + SLOTS[slot].z);
  g.rotation.y = Math.random() * 6;
  // 좁아진 자리에 맞춰 조금 작게
  g.scale.setScalar(0.88);
  scene.add(g);
  const d = { group: g, slot, kind, pot: null };
  if (g.userData.steam) {
    d.pot = { x: g.position.x, y: TABLE_H + g.userData.steam, z: g.position.z, acc: 0 };
    W.pots.push(d.pot);
  }
  table.dishes.push(d);
  return g;
}

export function placeBottles(scene, table, n) {
  for (let i = 0; i < n; i++) {
    const b = bottle(i % 3 === 2 ? 0x7a4a1c : 0x2f8a4a);
    // 안주 칸을 피해 통 옆 가장자리에 둔다
    b.position.set(table.x + (Math.random() < 0.5 ? -1 : 1) * rnd(0.55, 0.92), TABLE_H, table.z + (Math.random() < 0.5 ? -0.45 : 0.45));
    scene.add(b);
  }
}
