// 손님 캐릭터. 둥근 도형을 이어 붙인 2등신 캐릭터
// 키 1 기준으로 만들고 SCALE 배율을 곱한다. 캐릭터는 +z 를 보고, 왼쪽은 +x 다
import * as THREE from 'three';

export const SCALE = 1.25;
const HIP_Y = 0.28;
const SKIN = 0xffdcc8;

// 공용 도형
const G = {
  head: new THREE.SphereGeometry(0.25, 32, 24),
  hair: new THREE.SphereGeometry(0.258, 32, 24),
  face: new THREE.SphereGeometry(0.2515, 32, 16, Math.PI / 2 - 0.9, 1.8, 0.75, 1.4),
  bangs: new THREE.SphereGeometry(0.262, 32, 12, Math.PI / 2 - 1.05, 2.1, 0, 0.95),
  torso: new THREE.CapsuleGeometry(0.13, 0.06, 6, 16),
  hipBall: new THREE.SphereGeometry(0.125, 16, 12),
  upperArm: new THREE.CapsuleGeometry(0.05, 0.08, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.046, 0.06, 4, 10),
  hand: new THREE.SphereGeometry(0.056, 12, 10),
  thigh: new THREE.CapsuleGeometry(0.06, 0.05, 4, 10),
  shin: new THREE.CapsuleGeometry(0.055, 0.04, 4, 10),
  foot: new THREE.SphereGeometry(1, 12, 10),
  bun: new THREE.SphereGeometry(0.1, 16, 12),
  tail: new THREE.CapsuleGeometry(0.07, 0.14, 4, 10),
  apron: new THREE.BoxGeometry(0.24, 0.26, 0.02),
  pick: new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8),
};

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }));
  return matCache.get(key);
}

// 얼굴 그림. 표정(mood)과 취기(blush 0~3)마다 한 장씩 만들어 같이 쓴다
const faceCache = new Map();
function faceTexture(mood, blush, makeup = null) {
  const key = mood + blush + (makeup || '');
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const EY = 132, LX = 92, RX = 164;

  // 극도로 화나면 얼굴이 벌겋게 달아오른다
  if (mood === 'fury') {
    g.fillStyle = 'rgba(225,40,40,0.32)';
    g.fillRect(0, 0, 256, 256);
  }

  if (blush > 0) {
    g.fillStyle = `rgba(255,105,120,${[0, 0.35, 0.6, 0.85][blush]})`;
    for (const x of [64, 192]) {
      g.beginPath();
      g.ellipse(x, 160, 22 + blush * 3, 12 + blush * 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.strokeStyle = '#3a2620';
  g.fillStyle = '#2b1d18';
  g.lineCap = 'round';

  const madam = makeup === 'madam';
  if (madam) {
    // 동그란 진한 볼터치
    g.fillStyle = 'rgba(255,70,120,0.55)';
    for (const x of [62, 194]) {
      g.beginPath();
      g.arc(x, 158, 24, 0, Math.PI * 2);
      g.fill();
    }
    // 보라빛 아이섀도
    for (const x of [LX, RX]) {
      const gr = g.createRadialGradient(x, EY - 10, 2, x, EY - 10, 26);
      gr.addColorStop(0, 'rgba(120,60,200,0.85)');
      gr.addColorStop(1, 'rgba(60,120,220,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, EY - 10, 26, 18, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2b1d18';
  }

  // 눈썹. 표정마다 기울기가 다르고, 취하면 바깥쪽이 처진다
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(58,38,32,0.75)';
  const droop = blush >= 3 ? 4 : 0;
  for (const [x, s] of [[LX, -1], [RX, 1]]) {
    // in: 코 쪽 끝, out: 바깥쪽 끝의 높이
    let inY = 102, outY = 102 + droop, mid = 96;
    if (mood === 'angry') (inY = 108), (outY = 92), (mid = 100);
    else if (mood === 'fury') (inY = 112), (outY = 86), (mid = 102);
    else if (mood === 'annoyed') x === RX ? ((inY = 94), (outY = 92), (mid = 88)) : ((inY = 104), (outY = 101), (mid = 100));
    else if (mood === 'sad') (inY = 92), (outY = 104), (mid = 98);
    else if (mood === 'pout') (inY = 104), (outY = 98), (mid = 100);
    else if (mood === 'serious') (inY = 103), (outY = 100), (mid = 101);
    const xIn = x - 9 * s, xOut = x + 9 * s;
    g.beginPath();
    g.moveTo(xIn, inY);
    g.quadraticCurveTo(x, mid, xOut, outY);
    g.stroke();
  }
  g.strokeStyle = '#3a2620';

  // 눈
  g.lineWidth = 6;
  const roundEye = (x, rx, ry, hx) => {
    g.fillStyle = '#2b1d18';
    g.beginPath();
    g.ellipse(x, EY, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x + hx, EY - 6, 4, 0, Math.PI * 2);
    g.fill();
  };
  if (mood === 'idle' || mood === 'talk' || mood === 'chew' || mood === 'annoyed') {
    for (const x of [LX, RX]) roundEye(x, 11, 15, 4);
  } else if (mood === 'fury') {
    // 작게 오그라든 눈동자
    for (const x of [LX, RX]) roundEye(x, 6, 8, 2);
  } else if (mood === 'angry') {
    for (const x of [LX, RX]) roundEye(x, 9, 12, 3);
  } else if (mood === 'sad') {
    for (const x of [LX, RX]) roundEye(x, 11, 14, 3);
  } else if (mood === 'pout' || mood === 'serious') {
    // 반쯤 감은 눈. 삐지면 눈동자가 옆으로 간다
    const off = mood === 'pout' ? -4 : 0;
    for (const x of [LX, RX]) {
      g.save();
      g.beginPath();
      g.rect(x - 16, EY - 1, 32, 20);
      g.clip();
      roundEye(x + off, 11, 14, off - 2);
      g.restore();
      g.beginPath();
      g.moveTo(x - 13, EY - 1);
      g.lineTo(x + 13, EY - 1);
      g.stroke();
    }
  } else if (mood === 'blink' || mood === 'drink') {
    for (const x of [LX, RX]) {
      g.beginPath();
      g.arc(x, EY - 4, 11, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
  } else if (mood === 'happy') {
    for (const x of [LX, RX]) {
      g.beginPath();
      g.arc(x, EY + 6, 11, 1.15 * Math.PI, 1.85 * Math.PI);
      g.stroke();
    }
  } else if (mood === 'wink') {
    // 왼눈은 뜨고 오른눈은 찡긋
    roundEye(LX, 11, 15, 4);
    g.beginPath();
    g.arc(RX, EY + 6, 11, 1.15 * Math.PI, 1.85 * Math.PI);
    g.stroke();
  }

  // 진한 아이라인과 속눈썹
  if (madam) {
    const openMood = ['idle', 'talk', 'chew', 'angry', 'sad', 'pout', 'serious', 'annoyed', 'fury'].includes(mood);
    g.strokeStyle = '#120808';
    for (const [x, s] of [[LX, -1], [RX, 1]]) {
      const open = openMood || (mood === 'wink' && x === LX);
      const top = open ? EY - 14 : EY - 2;
      g.lineWidth = 6;
      g.beginPath();
      if (open) g.ellipse(x, EY, 13, 16, 0, Math.PI * 1.05, Math.PI * 1.95);
      else g.arc(x, EY - 4, 12, 0.1 * Math.PI, 0.9 * Math.PI);
      g.stroke();
      // 눈꼬리 날개
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x + 12 * s, top + (open ? 6 : 2));
      g.lineTo(x + 22 * s, top - 4);
      g.stroke();
      // 속눈썹
      g.lineWidth = 3;
      for (const k of [-0.6, 0, 0.6]) {
        const bx = x + k * 11 + s * 3;
        const by = open ? top + Math.abs(k) * 4 : EY + 6;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + k * 6 + s * 3, by + (open ? -9 : 7));
        g.stroke();
      }
    }
    g.strokeStyle = '#3a2620';
  }

  // 입
  const MY = 176;
  g.lineWidth = 5;
  if (mood === 'idle' || mood === 'blink') {
    g.beginPath();
    g.arc(128, MY - 6, 10, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  } else if (mood === 'happy' || mood === 'talk') {
    g.fillStyle = '#9b2f3a';
    g.beginPath();
    if (mood === 'happy') {
      g.moveTo(112, MY - 6);
      g.lineTo(144, MY - 6);
      g.arc(128, MY - 6, 16, 0, Math.PI);
    } else {
      g.ellipse(128, MY, 9, 11, 0, 0, Math.PI * 2);
    }
    g.fill();
    g.fillStyle = '#ff8a8a';
    g.beginPath();
    g.ellipse(128, MY + (mood === 'happy' ? 4 : 5), 7, 4, 0, 0, Math.PI * 2);
    g.fill();
  } else if (mood === 'annoyed') {
    // 억지 미소와 식은땀
    g.beginPath();
    g.moveTo(112, MY - 4);
    g.quadraticCurveTo(128, MY + 2, 144, MY - 6);
    g.stroke();
    g.fillStyle = 'rgba(140,200,255,0.9)';
    g.beginPath();
    g.moveTo(198, 96);
    g.quadraticCurveTo(190, 112, 198, 118);
    g.quadraticCurveTo(206, 112, 198, 96);
    g.fill();
  } else if (mood === 'fury') {
    // 이를 꽉 문 입
    g.fillStyle = '#fff';
    g.strokeStyle = '#3a2620';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(108, MY - 12, 40, 20, 6);
    g.fill();
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(108, MY - 2);
    g.lineTo(148, MY - 2);
    for (const x of [118, 128, 138]) {
      g.moveTo(x, MY - 12);
      g.lineTo(x, MY + 8);
    }
    g.stroke();
    // 이마의 핏대
    g.strokeStyle = '#e0102a';
    g.lineWidth = 5;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.arc(190 + a * 12, 70 + b * 12, 9, a < 0 ? 0 : Math.PI, a < 0 ? Math.PI / 2 : Math.PI * 1.5, b > 0 === a < 0);
      g.stroke();
    }
  } else if (mood === 'angry') {
    // 소리 지르는 입
    g.fillStyle = '#7a1f2a';
    g.beginPath();
    g.ellipse(128, MY + 2, 15, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(117, MY - 9, 22, 5);
  } else if (mood === 'pout') {
    // 입을 삐죽 내민다
    g.beginPath();
    g.moveTo(118, MY + 2);
    g.quadraticCurveTo(126, MY - 8, 134, MY - 1);
    g.stroke();
    g.beginPath();
    g.arc(136, MY - 2, 3, 0, Math.PI * 2);
    g.stroke();
  } else if (mood === 'serious') {
    g.beginPath();
    g.moveTo(116, MY - 2);
    g.lineTo(140, MY - 2);
    g.stroke();
  } else if (mood === 'sad') {
    g.beginPath();
    g.arc(128, MY + 6, 10, 1.2 * Math.PI, 1.8 * Math.PI);
    g.stroke();
  } else if (mood === 'chew') {
    g.beginPath();
    g.moveTo(116, MY);
    g.quadraticCurveTo(122, MY - 7, 128, MY);
    g.quadraticCurveTo(134, MY - 7, 140, MY);
    g.stroke();
  } else if (mood === 'drink') {
    g.fillStyle = '#9b2f3a';
    g.beginPath();
    g.arc(128, MY, 6, 0, Math.PI * 2);
    g.fill();
  } else if (mood === 'wink') {
    // 쪽 하고 내민 입
    g.beginPath();
    g.arc(124, MY - 4, 6, 0.5 * Math.PI, 1.5 * Math.PI, true);
    g.stroke();
    g.beginPath();
    g.arc(124, MY + 6, 6, 0.5 * Math.PI, 1.5 * Math.PI, true);
    g.stroke();
  }

  // 새빨간 입술과 점
  if (madam) {
    g.fillStyle = '#d4102e';
    g.strokeStyle = '#d4102e';
    if (mood === 'wink') {
      // 쪽 하고 동그랗게 모은 입술
      g.beginPath();
      g.ellipse(126, MY, 11, 10, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7a0618';
      g.beginPath();
      g.ellipse(126, MY, 3.5, 3, 0, 0, Math.PI * 2);
      g.fill();
    } else if (['happy', 'talk', 'angry', 'drink'].includes(mood)) {
      g.lineWidth = 6;
      g.beginPath();
      if (mood === 'happy') {
        g.moveTo(110, MY - 7);
        g.lineTo(146, MY - 7);
        g.arc(128, MY - 7, 18, 0, Math.PI);
      } else g.ellipse(128, MY + 1, 12, 14, 0, 0, Math.PI * 2);
      g.stroke();
    } else {
      // 도톰하게 다문 입술. 윗입술 가운데가 살짝 파인다
      g.beginPath();
      g.moveTo(98, MY - 2);
      g.quadraticCurveTo(113, MY - 22, 128, MY - 10);
      g.quadraticCurveTo(143, MY - 22, 158, MY - 2);
      g.quadraticCurveTo(128, MY + 22, 98, MY - 2);
      g.fill();
      g.strokeStyle = 'rgba(90,0,20,0.6)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(101, MY - 2);
      g.quadraticCurveTo(128, MY + 3, 155, MY - 2);
      g.stroke();
    }
    g.fillStyle = '#2b1d18';
    g.beginPath();
    g.arc(160, 198, 3.5, 0, Math.PI * 2);
    g.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceCache.set(key, t);
  return t;
}

// 망사 스타킹 무늬. 살색 위에 검은 마름모 그물
let fishnetTex = null;
function fishnetTexture() {
  if (fishnetTex) return fishnetTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fbeee8';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#1a1014';
  g.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.moveTo(i, 128);
    g.lineTo(i + 128, 0);
    g.stroke();
  }
  fishnetTex = new THREE.CanvasTexture(c);
  fishnetTex.colorSpace = THREE.SRGBColorSpace;
  fishnetTex.wrapS = fishnetTex.wrapT = THREE.RepeatWrapping;
  fishnetTex.repeat.set(2, 1);
  return fishnetTex;
}

// 호피 무늬. 미니스커트에 쓴다
let leopardTex = null;
function leopardTexture() {
  if (leopardTex) return leopardTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d9a35a';
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256, y = Math.random() * 64, r = 4 + Math.random() * 4;
    g.fillStyle = '#7a4a1c';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.8, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a1608';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x, y, r + 1.5, Math.random() * 2, Math.random() * 2 + 3.5);
    g.stroke();
  }
  leopardTex = new THREE.CanvasTexture(c);
  leopardTex.colorSpace = THREE.SRGBColorSpace;
  return leopardTex;
}

// 잔. 손에 붙지만 항상 똑바로 서도록 매 프레임 돌린다
function makeGlass() {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.032, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.35, depthWrite: false })
  );
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.03, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6, roughness: 0.35 })
  );
  liquid.position.y = -0.012;
  g.add(cup, liquid);
  g.userData.liquid = liquid;
  return g;
}

function lerpTo(cur, target, k) {
  return cur + (target - cur) * k;
}

export class Person {
  // makeup, outfit 은 조풍순처럼 따로 꾸민 캐릭터에만 준다. 기본 손님은 그대로
  constructor({ hair = 0x3b2a22, style = 'bob', shirt = 0x6c8f6a, pants = 0x2f3a4a, staff = false, name = '', makeup = null, outfit = null, skirt = null, legs = null, shoes = 0x2a211d, skin: skinColor = SKIN } = {}) {
    this.name = name;
    this.makeup = makeup;
    this.staff = staff;
    this.root = new THREE.Group();
    this.root.scale.setScalar(SCALE);

    this.state = 'stand';
    this.action = null;
    this.seat = null;
    this.path = [];
    this.speed = 1.6;
    this.walkPhase = Math.random() * 6;
    this.yaw = 0;
    this.targetYaw = 0;
    this.drinks = 0;
    this.blinkT = 1 + Math.random() * 3;
    this.mood = 'idle';
    this.t = Math.random() * 10;
    // 서 있는 높이. 바 안 발판, 테이블 위처럼 바닥이 아닌 곳에 설 때 쓴다
    this.baseY = 0;
    this.hop = null;
    // 계속 유지하는 표정과 자세 (삐짐, 쫓겨남)
    this.faceMood = null;
    this.idlePose = null;

    // 관절 현재값
    this.j = { lean: 0, roll: 0, nx: 0, ny: 0, nz: 0, slx: 0, slz: 0.15, srx: 0, srz: -0.15, twL: 0, twR: 0, elL: 0, elR: 0, hl: 0, hr: 0, kl: 0, kr: 0, bob: 0 };

    // 따로 준 피부색은 주황 조명에 묻히지 않게 살짝 스스로 밝힌다
    const skin = skinColor === SKIN ? mat(SKIN, { roughness: 0.6 }) : mat(skinColor, { roughness: 0.6, emissive: 0x4a4242 });
    this.skinM = skin;
    // 마담 차림은 반짝이는 드레스
    const shirtM = outfit === 'madam' ? mat(shirt, { metalness: 0.35, roughness: 0.35 }) : mat(shirt);
    const pantsM = mat(pants);
    const hairM = mat(hair, { roughness: 0.55 });
    const shoeM = mat(shoes);
    let legM = legs ? mat(legs, { roughness: 0.45 }) : pantsM;
    if (outfit === 'madam') legM = new THREE.MeshStandardMaterial({ map: fishnetTexture(), roughness: 0.6 });
    // 민소매면 위팔도 맨살
    const sleeveM = outfit === 'madam' ? skin : shirtM;

    this.hips = new THREE.Group();
    this.hips.position.y = HIP_Y;
    this.root.add(this.hips);

    const hipBall = new THREE.Mesh(G.hipBall, skirt ? mat(skirt) : pantsM);
    hipBall.scale.set(1, 0.6, 0.9);
    this.hips.add(hipBall);

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const torso = new THREE.Mesh(G.torso, shirtM);
    torso.position.y = 0.13;
    torso.scale.set(1.05, 1, 0.9);
    this.torso.add(torso);
    if (staff && !outfit) {
      const apron = new THREE.Mesh(G.apron, mat(0x2d4a33));
      apron.position.set(0, 0.07, 0.115);
      this.torso.add(apron);
    }

    // 머리
    this.neck = new THREE.Group();
    this.neck.position.y = 0.27;
    this.torso.add(this.neck);
    const headShape = new THREE.Group();
    headShape.position.y = 0.2;
    headShape.scale.set(1.08, 0.95, 1);
    this.neck.add(headShape);
    headShape.add(new THREE.Mesh(G.head, skin));
    this.faceMat = new THREE.MeshBasicMaterial({ map: faceTexture('idle', 0, makeup), transparent: true, depthWrite: false });
    const face = new THREE.Mesh(G.face, this.faceMat);
    face.renderOrder = 2;
    headShape.add(face);

    const hairBack = new THREE.Mesh(G.hair, hairM);
    hairBack.position.set(0, 0.03, -0.035);
    headShape.add(hairBack);
    const bangs = new THREE.Mesh(G.bangs, hairM);
    bangs.position.y = 0.005;
    headShape.add(bangs);
    if (style === 'bun') {
      const bun = new THREE.Mesh(G.bun, hairM);
      bun.position.set(0, 0.25, -0.1);
      headShape.add(bun);
    } else if (style === 'pony') {
      const tail = new THREE.Mesh(G.tail, hairM);
      tail.position.set(0, 0.02, -0.27);
      tail.rotation.x = 0.35;
      headShape.add(tail);
    } else if (style === 'short') {
      hairBack.scale.set(1, 0.9, 1);
      hairBack.position.y = 0.06;
    } else if (style === 'madam') {
      // 부풀린 올림머리와 옆 웨이브
      hairBack.scale.set(1.1, 1.08, 1.06);
      const top = new THREE.Mesh(G.bun, hairM);
      top.scale.setScalar(1.6);
      top.position.set(0, 0.27, -0.06);
      headShape.add(top);
      for (const sx of [-1, 1]) {
        const curl = new THREE.Mesh(G.bun, hairM);
        curl.scale.setScalar(0.9);
        curl.position.set(0.24 * sx, -0.1, -0.06);
        headShape.add(curl);
      }
    }
    if (staff && !outfit) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.025, 8, 32), mat(0x2d4a33));
      band.rotation.x = Math.PI / 2 - 0.25;
      band.position.y = 0.1;
      headShape.add(band);
    }
    this.headShape = headShape;

    // 팔
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(0.15 * side, 0.2, 0);
      this.torso.add(sh);
      // 팔 길이 방향으로 비트는 관절. 팔짱 낄 때 팔꿈치를 안쪽으로 굽히려고 둔다
      const tw = new THREE.Group();
      sh.add(tw);
      const up = new THREE.Mesh(G.upperArm, sleeveM);
      up.position.y = -0.07;
      tw.add(up);
      const el = new THREE.Group();
      el.position.y = -0.12;
      tw.add(el);
      const fo = new THREE.Mesh(G.foreArm, skin);
      fo.position.y = -0.055;
      el.add(fo);
      const hand = new THREE.Group();
      hand.position.y = -0.125;
      el.add(hand);
      const palm = new THREE.Mesh(G.hand, skin);
      hand.add(palm);
      return { sh, tw, el, hand, palm };
    };
    this.armL = arm(1);
    this.armR = arm(-1);

    // 다리
    const leg = (side) => {
      const hp = new THREE.Group();
      hp.position.set(0.07 * side, 0, 0);
      this.hips.add(hp);
      const th = new THREE.Mesh(G.thigh, legM);
      th.position.y = -0.06;
      hp.add(th);
      const kn = new THREE.Group();
      kn.position.y = -0.12;
      hp.add(kn);
      const sh = new THREE.Mesh(G.shin, legM);
      sh.position.y = -0.05;
      kn.add(sh);
      const ft = new THREE.Mesh(G.foot, shoeM);
      ft.scale.set(0.06, 0.042, 0.09);
      ft.position.set(0, -0.115, 0.025);
      kn.add(ft);
      return { hp, kn };
    };
    this.legL = leg(1);
    this.legR = leg(-1);

    if (outfit === 'madam') this.addMadamOutfit(headShape);

    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });

    // 손에 든 것
    this.glass = makeGlass();
    this.glass.visible = false;
    this.armR.hand.add(this.glass);
    this.morsel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xe0a24a));
    this.morsel.position.set(0, -0.04, 0.03);
    this.morsel.visible = false;
    this.armR.hand.add(this.morsel);
    // 쫙 편 손. 손바닥이 앞(-y)을 보고 손가락이 위(+z)로 선다. 팔을 앞으로 뻗을 때만 보인다
    this.openHand = new THREE.Group();
    const skinM = this.skinM;
    const palmBox = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.12), skinM);
    palmBox.position.set(0, -0.02, 0.03);
    this.openHand.add(palmBox);
    const fingerGeo = new THREE.CapsuleGeometry(0.017, 0.055, 4, 8);
    for (const fx of [-0.045, -0.015, 0.015, 0.045]) {
      const f = new THREE.Mesh(fingerGeo, skinM);
      f.rotation.x = Math.PI / 2;
      f.position.set(fx, -0.02, 0.13 + (Math.abs(fx) < 0.02 ? 0.01 : 0));
      this.openHand.add(f);
    }
    const thumb = new THREE.Mesh(fingerGeo, skinM);
    thumb.rotation.z = Math.PI / 2 + 0.5;
    thumb.position.set(0.085, -0.02, 0.04);
    this.openHand.add(thumb);
    this.openHand.scale.setScalar(1.25);
    this.openHand.visible = false;
    this.armR.hand.add(this.openHand);
    this.tray = new THREE.Group();
    const trayM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), mat(0x6b4a2f));
    this.tray.add(trayM);
    this.tray.visible = false;
    this.tray.position.set(0, 0.36, 0.26);
    this.root.add(this.tray);

    // 누르기용 투명 기둥
    this.pick = new THREE.Mesh(G.pick, new THREE.MeshBasicMaterial());
    this.pick.position.y = 0.6;
    this.pick.visible = false;
    this.pick.userData.person = this;
    this.root.add(this.pick);

    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  // 올드한 술집 마담 차림. 퍼진 치마, 털 숄, 진주 목걸이, 금귀걸이, 브로치
  // 올드한 술집 마담 차림. 반짝이 민소매 드레스, 호피 미니스커트, 망사 스타킹, 분홍 깃털 숄, 진주, 금귀걸이, 머리꽃
  addMadamOutfit(headShape) {
    // 호피 무늬 미니스커트
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.12, 24), new THREE.MeshStandardMaterial({ map: leopardTexture(), roughness: 0.6 }));
    skirt.position.y = -0.04;
    this.hips.add(skirt);
    // 깃털 숄. 작은 공을 어깨에 둘러 복슬복슬하게
    const boaM = mat(0xff6fae, { roughness: 1 });
    const boaGeo = new THREE.SphereGeometry(0.038, 8, 6);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const front = Math.max(0, Math.sin(a));
      const puff = new THREE.Mesh(boaGeo, boaM);
      puff.position.set(Math.cos(a) * 0.15, 0.245 - front * 0.05 + (Math.random() - 0.5) * 0.02, Math.sin(a) * 0.12);
      puff.scale.setScalar(0.85 + Math.random() * 0.4);
      this.torso.add(puff);
    }
    const pearlM = mat(0xfff8ee, { roughness: 0.35 });
    const pearlGeo = new THREE.SphereGeometry(0.014, 8, 6);
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / 10);
      const pearl = new THREE.Mesh(pearlGeo, pearlM);
      pearl.position.set(Math.cos(a) * 0.08, 0.17 - Math.sin(a) * 0.05, 0.11 + Math.sin(a) * 0.02);
      this.torso.add(pearl);
    }
    const gold = mat(0xd9a93a, { metalness: 0.6, roughness: 0.4 });
    const hoopGeo = new THREE.TorusGeometry(0.045, 0.008, 6, 16);
    for (const sx of [-1, 1]) {
      const hoop = new THREE.Mesh(hoopGeo, gold);
      hoop.position.set(0.255 * sx, -0.1, 0.02);
      hoop.rotation.y = Math.PI / 2;
      headShape.add(hoop);
    }
    // 머리에 꽂은 빨간 꽃
    const flower = new THREE.Group();
    const petalM = mat(0xe0103a, { roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), petalM);
      petal.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0);
      flower.add(petal);
    }
    flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), gold));
    flower.position.set(0.2, 0.17, 0.12);
    flower.rotation.y = 0.6;
    headShape.add(flower);
  }

  get pos() {
    return this.root.position;
  }

  get blush() {
    return Math.min(3, Math.floor(this.drinks / 2));
  }

  headWorld(out) {
    return this.neck.getWorldPosition(out).add(new THREE.Vector3(0, 0.62, 0));
  }

  do(type, dur) {
    const D = { cheers: 1.7, oneshot: 2.3, anju: 2.0, talk: 2.4, wave: 1.5, laugh: 1.3, serve: 1.0, yeah: 3.6, tantrum: 2.4, stop: 2.4, humph: 1.3, warn: 2.2, rage: 1.4, wink: 1.9, aegyo: 2.2, hairflip: 1.7 };
    this.action = { type, t: 0, dur: dur || D[type] || 1.5, fired: false };
  }

  walkTo(points) {
    this.path = points.slice();
    if (this.state === 'sit') this.standUp();
    this.state = this.path.length ? 'walk' : 'stand';
  }

  // 폴짝 뛰어 다른 높이로 옮겨 간다 (테이블 위로 올라가기, 내려오기)
  // face 가 false 면 몸 방향은 그대로 두고 뛴다(뒤로 내려가기)
  hopTo(x, y, z, dur = 0.55, arc = 0.45, face = true) {
    const p = this.root.position;
    this.hop = { x0: p.x, y0: p.y, z0: p.z, x1: x, y1: y, z1: z, t: 0, dur, arc };
    if (face && Math.hypot(x - p.x, z - p.z) > 0.05) this.targetYaw = Math.atan2(x - p.x, z - p.z);
    this.path = [];
    this.state = 'hop';
  }

  sitAt(seat) {
    this.seat = seat;
    seat.occupant = this;
    this.root.position.set(seat.x, 0, seat.z);
    this.yaw = this.targetYaw = seat.yaw;
    this.state = 'sit';
    this.path = [];
  }

  standUp() {
    if (this.seat) {
      // 의자에서 테이블 반대쪽으로 조금 물러나 선다
      this.root.position.x += Math.sin(this.seat.yaw) * -0.35;
      this.root.position.z += Math.cos(this.seat.yaw) * -0.35;
      this.seat.occupant = null;
      this.seat = null;
    }
    this.state = 'stand';
  }

  update(dt, obstacles, bounds) {
    this.t += dt;
    const j = this.j;
    const tgt = { lean: 0, roll: 0, nx: 0, ny: 0, nz: 0, slx: 0, slz: 0.15, srx: 0, srz: -0.15, twL: 0, twR: 0, elL: -0.1, elR: -0.1, hl: 0, hr: 0, kl: 0, kr: 0, bob: 0 };
    const tipsy = this.blush;

    // 걷기
    if (this.state === 'walk') {
      const p = this.path[0];
      const dx = p.x - this.root.position.x;
      const dz = p.z - this.root.position.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) {
        this.root.position.x = p.x;
        this.root.position.z = p.z;
        this.path.shift();
        if (!this.path.length) {
          this.state = 'stand';
          if (p.seat && !p.seat.occupant) this.sitAt(p.seat);
          if (p.yaw !== undefined) this.targetYaw = p.yaw;
          if (this.onArrive) this.onArrive(p);
        }
      } else {
        this.root.position.x += (dx / d) * step;
        this.root.position.z += (dz / d) * step;
        this.targetYaw = Math.atan2(dx, dz);
      }
      if (obstacles) pushOut(this.root.position, obstacles);
      if (bounds) {
        this.root.position.x = THREE.MathUtils.clamp(this.root.position.x, bounds.x0, bounds.x1);
        this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, bounds.z0, bounds.z1);
      }
      // 뛸 때는 다리도 빨라진다. 서빙 직원 속도(2.2)까지는 기존과 같다
      this.walkPhase += dt * 9 * Math.max(1, this.speed / 2.2);
      const s = Math.sin(this.walkPhase);
      tgt.hl = s * 0.6;
      tgt.hr = -s * 0.6;
      tgt.kl = Math.max(0, -s) * 0.8;
      tgt.kr = Math.max(0, s) * 0.8;
      tgt.slx = -s * 0.5;
      tgt.srx = s * 0.5;
      tgt.bob = Math.abs(Math.cos(this.walkPhase)) * 0.025;
      tgt.lean = 0.08;
    } else if (this.state === 'sit') {
      tgt.hl = tgt.hr = -Math.PI / 2;
      tgt.kl = tgt.kr = Math.PI / 2 - 0.15;
      tgt.slx = tgt.srx = -0.95;
      tgt.elL = tgt.elR = -0.55;
      tgt.slz = 0.05;
      tgt.srz = -0.05;
      tgt.lean = 0.08;
    } else if (this.state === 'hop') {
      const h = this.hop;
      h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      const e = smooth(k);
      this.root.position.x = mix(h.x0, h.x1, e);
      this.root.position.z = mix(h.z0, h.z1, e);
      this.root.position.y = mix(h.y0, h.y1, k) + Math.sin(k * Math.PI) * h.arc;
      tgt.hl = tgt.hr = -0.7;
      tgt.kl = tgt.kr = 1.1;
      tgt.slz = 1.3;
      tgt.srz = -1.3;
      if (k >= 1) {
        this.root.position.y = this.baseY = h.y1;
        this.hop = null;
        this.state = 'stand';
      }
    }
    // 팔짱 끼기. 비틀기 관절로 팔꿈치를 안쪽으로 굽혀 아랫팔이 가슴 앞을 가로지른다
    if (this.idlePose === 'crossed' && this.state === 'stand') {
      tgt.slx = tgt.srx = -0.55;
      tgt.slz = 0.25;
      tgt.srz = -0.25;
      tgt.twL = -Math.PI / 2;
      tgt.twR = Math.PI / 2;
      tgt.elL = tgt.elR = -1.9;
      tgt.lean = -0.06;
      tgt.nx = -0.15;
    }
    if (this.state !== 'hop') this.root.position.y += (this.baseY - this.root.position.y) * (1 - Math.exp(-dt * 8));

    // 숨쉬기와 취기 흔들림
    const breath = Math.sin(this.t * 2.2) * 0.006;
    tgt.bob += breath;
    tgt.roll = Math.sin(this.t * 1.3) * 0.035 * tipsy;
    tgt.nz = Math.sin(this.t * 0.9 + 1) * 0.05 * tipsy;

    // 표정
    let mood = this.faceMood || 'idle';
    this.blinkT -= dt;
    if (this.blinkT < 0 && !this.faceMood) {
      mood = 'blink';
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    }

    // 동작 겹치기
    const a = this.action;
    this.glass.visible = this.state === 'sit' && !this.staff;
    this.morsel.visible = false;
    this.openHand.visible = false;
    this.armR.palm.visible = true;
    if (a) {
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      const inOut = (p0, p1, p2, p3) => {
        if (p < p0) return 0;
        if (p < p1) return smooth((p - p0) / (p1 - p0));
        if (p < p2) return 1;
        if (p < p3) return 1 - smooth((p - p2) / (p3 - p2));
        return 0;
      };
      if (a.type === 'cheers') {
        const w = inOut(0, 0.3, 0.7, 1);
        this.glass.visible = true;
        tgt.srx = mix(tgt.srx, -2.55, w);
        tgt.srz = mix(tgt.srz, -0.75, w);
        tgt.elR = mix(tgt.elR, -0.35, w);
        tgt.lean = mix(tgt.lean, 0.22, w);
        mood = w > 0.5 ? 'happy' : mood;
        if (!a.fired && p > 0.36) {
          a.fired = true;
          this.onCheersPeak && this.onCheersPeak(this);
        }
      } else if (a.type === 'oneshot') {
        const w = inOut(0, 0.22, 0.72, 0.9);
        const tilt = inOut(0.2, 0.32, 0.65, 0.75);
        this.glass.visible = true;
        tgt.srx = mix(tgt.srx, -1.75, w);
        tgt.srz = mix(tgt.srz, 0.55, w);
        tgt.elR = mix(tgt.elR, -1.75, w);
        tgt.nx = mix(0, -0.5, tilt);
        tgt.lean = mix(tgt.lean, -0.05, tilt);
        if (tilt > 0.3) mood = 'drink';
        if (p > 0.78) mood = 'happy';
        this.glass.userData.tilt = tilt * 1.6;
        if (!a.fired && p > 0.75) {
          a.fired = true;
          this.drinks++;
          this.onOneshot && this.onOneshot(this);
        }
      } else if (a.type === 'anju') {
        const reach = inOut(0, 0.2, 0.3, 0.42);
        const toMouth = inOut(0.3, 0.45, 0.55, 0.7);
        tgt.srx = mix(mix(tgt.srx, -1.45, reach), -1.7, toMouth);
        tgt.elR = mix(mix(tgt.elR, -0.15, reach), -1.8, toMouth);
        tgt.srz = mix(tgt.srz, 0.5, toMouth);
        tgt.lean = mix(tgt.lean, 0.38, reach);
        this.glass.visible = false;
        this.morsel.visible = p > 0.25 && p < 0.55;
        if (p > 0.5) {
          mood = 'chew';
          tgt.bob += Math.abs(Math.sin(this.t * 14)) * 0.006;
          tgt.nx = Math.sin(this.t * 14) * 0.04;
        }
        if (!a.fired && p > 0.5) {
          a.fired = true;
          this.onChew && this.onChew(this);
        }
      } else if (a.type === 'talk') {
        mood = Math.floor(this.t * 7.5) % 2 ? 'talk' : 'idle';
        tgt.slx = mix(tgt.slx, -1.1 + Math.sin(this.t * 6) * 0.3, inOut(0, 0.12, 0.85, 1));
        tgt.elL = mix(tgt.elL, -1.0, inOut(0, 0.12, 0.85, 1));
        tgt.ny = Math.sin(this.t * 3) * 0.15;
        tgt.nx = Math.sin(this.t * 7) * 0.05;
      } else if (a.type === 'wave') {
        const w = inOut(0, 0.2, 0.8, 1);
        tgt.slz = mix(tgt.slz, 2.5 + Math.sin(this.t * 14) * 0.3, w);
        tgt.slx = mix(tgt.slx, -0.3, w);
        tgt.elL = mix(tgt.elL, -0.3, w);
        mood = 'happy';
      } else if (a.type === 'laugh') {
        mood = 'happy';
        tgt.bob += Math.abs(Math.sin(this.t * 16)) * 0.012;
        tgt.nx = -0.15;
        tgt.lean = mix(tgt.lean, -0.08, 1);
      } else if (a.type === 'yeah') {
        // 팔을 ㄴ 자로 굽히고(위팔은 아래, 아랫팔은 앞) 번갈아 앞뒤로 흔든다. 몸도 같이 들썩인다
        const w = inOut(0, 0.1, 0.9, 1);
        const swing = Math.sin(this.t * 9);
        tgt.slx = mix(tgt.slx, swing * 0.6, w);
        tgt.srx = mix(tgt.srx, -swing * 0.6, w);
        tgt.slz = mix(tgt.slz, 0.18, w);
        tgt.srz = mix(tgt.srz, -0.18, w);
        tgt.elL = mix(tgt.elL, -1.6, w);
        tgt.elR = mix(tgt.elR, -1.6, w);
        const sway = Math.sin(this.t * 4.5);
        tgt.roll = sway * 0.12 * w;
        tgt.nz = -sway * 0.08 * w;
        tgt.nx = -0.12 * w;
        tgt.bob += Math.abs(swing) * 0.025 * w;
        tgt.kl = mix(tgt.kl, Math.max(0, swing) * 0.25, w);
        tgt.kr = mix(tgt.kr, Math.max(0, -swing) * 0.25, w);
        mood = 'happy';
      } else if (a.type === 'tantrum') {
        // 진상. 앉아 있으면 테이블을 두드리고, 서 있으면 발을 구르며 팔을 휘두른다
        const w = inOut(0, 0.08, 0.9, 1);
        const beat = Math.sin(this.t * 16);
        if (this.state === 'sit') {
          tgt.slx = mix(tgt.slx, -1.25 + Math.max(0, beat) * 0.7, w);
          tgt.srx = mix(tgt.srx, -1.25 + Math.max(0, -beat) * 0.7, w);
          tgt.elL = tgt.elR = mix(tgt.elL, -0.3, w);
          tgt.lean = mix(tgt.lean, 0.28, w);
        } else {
          tgt.slz = mix(tgt.slz, 1.4 + beat * 0.5, w);
          tgt.srz = mix(tgt.srz, -1.4 + beat * 0.5, w);
          tgt.slx = tgt.srx = mix(0, -0.4, w);
          tgt.kl = Math.max(0, beat) * 0.7 * w;
          tgt.kr = Math.max(0, -beat) * 0.7 * w;
          tgt.hl = -tgt.kl * 0.6;
          tgt.hr = -tgt.kr * 0.6;
        }
        tgt.ny = Math.sin(this.t * 11) * 0.25 * w;
        tgt.bob += Math.abs(beat) * 0.015 * w;
        mood = 'angry';
      } else if (a.type === 'stop') {
        // 팔을 앞으로 쭉 뻗고 편 손바닥을 상대에게 내민다
        const w = inOut(0, 0.15, 0.85, 1);
        tgt.srx = mix(tgt.srx, -1.5, w);
        tgt.srz = mix(tgt.srz, 0.12, w);
        tgt.elR = mix(tgt.elR, -0.12, w);
        tgt.lean = mix(tgt.lean, 0.1, w);
        tgt.nx = mix(0, 0.08, w);
        const open = w > 0.3;
        this.openHand.visible = open;
        this.armR.palm.visible = !open;
        mood = this.faceMood === 'fury' ? 'fury' : 'serious';
      } else if (a.type === 'warn') {
        // 손을 들어 상대 쪽으로 좌우로 흔든다. 그러지 마세요
        const w = inOut(0, 0.15, 0.85, 1);
        tgt.srx = mix(tgt.srx, -1.15, w);
        tgt.elR = mix(tgt.elR, -1.45, w);
        tgt.srz = mix(tgt.srz, -0.1 + Math.sin(this.t * 11) * 0.35, w);
        tgt.nx = mix(tgt.nx, 0.06, w);
        tgt.ny = Math.sin(this.t * 5.5) * 0.12 * w;
      } else if (a.type === 'rage') {
        // 주먹 쥐고 부들부들
        const w = inOut(0, 0.1, 0.9, 1);
        const shake = Math.sin(this.t * 38);
        tgt.slz = mix(tgt.slz, 0.4, w);
        tgt.srz = mix(tgt.srz, -0.4, w);
        tgt.slx = mix(tgt.slx, -0.35 + shake * 0.08, w);
        tgt.srx = mix(tgt.srx, -0.35 - shake * 0.08, w);
        tgt.elL = mix(tgt.elL, -1.3, w);
        tgt.elR = mix(tgt.elR, -1.3, w);
        tgt.roll = shake * 0.035 * w;
        tgt.nx = mix(tgt.nx, 0.18, w);
        tgt.kl = tgt.kr = mix(tgt.kl, 0.2, w);
        tgt.hl = tgt.hr = mix(tgt.hl, -0.1, w);
        tgt.bob += Math.abs(shake) * 0.006 * w;
        mood = 'fury';
      } else if (a.type === 'wink') {
        // 볼 옆에 손을 대고 고개를 갸웃하며 찡긋
        const w = inOut(0, 0.15, 0.8, 1);
        tgt.srx = mix(tgt.srx, -1.7, w);
        tgt.srz = mix(tgt.srz, 0.35, w);
        tgt.elR = mix(tgt.elR, -2.0, w);
        tgt.nz = mix(tgt.nz, 0.28, w);
        tgt.roll = mix(tgt.roll, -0.08, w);
        tgt.lean = mix(tgt.lean, 0.08, w);
        mood = w > 0.4 ? 'wink' : 'happy';
      } else if (a.type === 'aegyo') {
        // 두 주먹을 턱 밑에 모으고 고개를 좌우로 갸웃갸웃
        const w = inOut(0, 0.12, 0.85, 1);
        tgt.slx = mix(tgt.slx, -1.75, w);
        tgt.srx = mix(tgt.srx, -1.75, w);
        tgt.slz = mix(tgt.slz, -0.45, w);
        tgt.srz = mix(tgt.srz, 0.45, w);
        tgt.elL = mix(tgt.elL, -1.95, w);
        tgt.elR = mix(tgt.elR, -1.95, w);
        tgt.nz = Math.sin(this.t * 8) * 0.3 * w;
        tgt.roll = Math.sin(this.t * 8) * 0.08 * w;
        tgt.bob += Math.abs(Math.sin(this.t * 8)) * 0.012 * w;
        mood = 'happy';
      } else if (a.type === 'hairflip') {
        // 머리를 손으로 쓸어 넘기며 턱을 든다
        const w = inOut(0, 0.2, 0.7, 1);
        tgt.slz = mix(tgt.slz, 2.4, w);
        tgt.slx = mix(tgt.slx, -0.4, w);
        tgt.elL = mix(tgt.elL, -1.5, w);
        tgt.nx = mix(tgt.nx, -0.25, w);
        tgt.nz = mix(tgt.nz, -0.2, w);
        tgt.roll = mix(tgt.roll, 0.1, w);
        mood = 'wink';
      } else if (a.type === 'humph') {
        // 흥. 고개를 옆으로 홱 돌리고 턱을 든다
        const w = inOut(0, 0.12, 0.75, 1);
        tgt.ny = mix(tgt.ny, 0.7, w);
        tgt.nx = mix(tgt.nx, -0.3, w);
        mood = 'pout';
      } else if (a.type === 'serve') {
        const w = inOut(0, 0.3, 0.6, 1);
        tgt.slx = tgt.srx = mix(-1.2, -1.5, w);
        tgt.elL = tgt.elR = mix(-0.4, -0.1, w);
        tgt.lean = mix(0.05, 0.3, w);
        mood = 'happy';
      }
      if (a.t >= a.dur) {
        this.action = null;
        this.glass.userData.tilt = 0;
      }
    }

    // 쟁반 든 점원
    if (this.tray.visible && !(a && a.type === 'serve')) {
      tgt.slx = tgt.srx = -1.2;
      tgt.elL = tgt.elR = -0.4;
    }

    // 관절 따라가기
    const k = 1 - Math.exp(-dt * 12);
    for (const key in tgt) j[key] = lerpTo(j[key], tgt[key], k);

    this.hips.position.y = HIP_Y + j.bob;
    this.torso.rotation.set(j.lean, 0, j.roll);
    this.neck.rotation.set(j.nx, j.ny, j.nz);
    this.armL.sh.rotation.set(j.slx, 0, j.slz);
    this.armR.sh.rotation.set(j.srx, 0, j.srz);
    this.armL.tw.rotation.y = j.twL;
    this.armR.tw.rotation.y = j.twR;
    this.armL.el.rotation.x = j.elL;
    this.armR.el.rotation.x = j.elR;
    this.legL.hp.rotation.x = j.hl;
    this.legR.hp.rotation.x = j.hr;
    this.legL.kn.rotation.x = j.kl;
    this.legR.kn.rotation.x = j.kr;

    // 몸 방향
    let dy = this.targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-dt * 10));
    this.root.rotation.y = this.yaw;

    // 잔은 손 각도와 상관없이 똑바로. 마실 때만 입 쪽으로 기운다
    if (this.glass.visible) {
      this.root.updateMatrixWorld(true);
      this.armR.hand.getWorldQuaternion(this._q).invert();
      this._q2.setFromEuler(this._e.set(-(this.glass.userData.tilt || 0), this.yaw, 0, 'YXZ'));
      this.glass.quaternion.copy(this._q).multiply(this._q2);
    }

    if (mood !== this.mood || this._blush !== this.blush) {
      this.mood = mood;
      this._blush = this.blush;
      this.faceMat.map = faceTexture(mood, this.blush, this.makeup);
    }
  }
}

function smooth(x) {
  return x * x * (3 - 2 * x);
}
function mix(a, b, w) {
  return a + (b - a) * w;
}

// 테이블 같은 사각 장애물 밖으로 밀어낸다
export function pushOut(p, rects) {
  for (const r of rects) {
    if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) {
      const dl = p.x - r.x0, dr = r.x1 - p.x, dt = p.z - r.z0, db = r.z1 - p.z;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) p.x = r.x0;
      else if (m === dr) p.x = r.x1;
      else if (m === dt) p.z = r.z0;
      else p.z = r.z1;
    }
  }
}
