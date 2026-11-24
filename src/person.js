// 손님 캐릭터. 둥근 도형을 이어 붙인 2등신 캐릭터
// 키 1 기준으로 만들고 SCALE 배율을 곱한다. 캐릭터는 +z 를 보고, 왼쪽은 +x 다
import * as THREE from 'three';

export const SCALE = 1.25;
const HIP_Y = 0.28;
const SKIN = 0xffdcc8;

// 공용 도형
// 앉아서 옆자리 꿀밤 자세(knockL)
const KNOCK = { roll: -0.3, slx: 0, slz: 2.85, st: 5.1 };
// 책상에 엎드려 자기 자세. 머리가 커서 엉덩이를 들고(up) 책상 쪽으로 당겨(fwd) 팔 위에 머리를 얹는다
const DESKNAP = { lean: 0.45, up: 0.17, fwd: 0.25, sx: -1.6, sz: 0.55, el: -2.1, nx: 0.25, ny: 0.7 };

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
  longBack: new THREE.CapsuleGeometry(0.2, 0.3, 6, 16),
  lock: new THREE.CapsuleGeometry(0.055, 0.22, 4, 10),
  curl: new THREE.SphereGeometry(0.05, 10, 8),
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
    else if (mood === 'meek') (inY = 86), (outY = 108), (mid = 94);
    else if (mood === 'pout') (inY = 104), (outY = 98), (mid = 100);
    else if (mood === 'serious') (inY = 103), (outY = 100), (mid = 101);
    else if (mood === 'smirk') x === RX ? ((inY = 92), (outY = 94), (mid = 86)) : ((inY = 106), (outY = 104), (mid = 104));
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
  } else if (mood === 'meek') {
    // 주눅 든 눈. 작게 뜨고 아래를 본다
    for (const x of [LX, RX]) {
      g.fillStyle = '#2b1d18';
      g.beginPath();
      g.ellipse(x, EY + 5, 7, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x + 2, EY + 2, 2.5, 0, Math.PI * 2);
      g.fill();
    }
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
  } else if (mood === 'smirk') {
    // 게슴츠레 뜬 눈. 눈꺼풀이 거의 덮고 아래만 보인다
    for (const x of [LX, RX]) {
      g.save();
      g.beginPath();
      g.rect(x - 16, EY + 4, 32, 16);
      g.clip();
      roundEye(x + 2, 11, 14, 0);
      g.restore();
      g.beginPath();
      g.moveTo(x - 14, EY + 5);
      g.quadraticCurveTo(x, EY + 2, x + 14, EY + 5);
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
  } else if (mood === 'dizzy') {
    // 기절한 X 눈
    for (const x of [LX, RX]) {
      g.beginPath();
      g.moveTo(x - 10, EY - 10);
      g.lineTo(x + 10, EY + 10);
      g.moveTo(x + 10, EY - 10);
      g.lineTo(x - 10, EY + 10);
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
    const openMood = ['idle', 'talk', 'chew', 'angry', 'sad', 'meek', 'pout', 'serious', 'annoyed', 'fury'].includes(mood);
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
  } else if (mood === 'smirk') {
    // 한쪽 입꼬리만 올라간 비웃음
    g.beginPath();
    g.moveTo(112, MY);
    g.quadraticCurveTo(128, MY + 2, 144, MY - 9);
    g.stroke();
  } else if (mood === 'sad') {
    g.beginPath();
    g.arc(128, MY + 6, 10, 1.2 * Math.PI, 1.8 * Math.PI);
    g.stroke();
  } else if (mood === 'meek') {
    // 우물거리는 작은 입
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(118, MY);
    g.quadraticCurveTo(121, MY - 4, 124, MY);
    g.quadraticCurveTo(127, MY + 4, 130, MY);
    g.quadraticCurveTo(133, MY - 4, 136, MY);
    g.stroke();
    // 이마에 드리운 그늘 줄
    g.strokeStyle = 'rgba(90,110,190,0.55)';
    g.lineWidth = 3;
    for (const x of [100, 114, 128, 142, 156]) {
      g.beginPath();
      g.moveTo(x, 56);
      g.lineTo(x, 80 - Math.abs(x - 128) * 0.3);
      g.stroke();
    }
    g.strokeStyle = '#3a2620';
    // 식은땀
    g.fillStyle = 'rgba(140,200,255,0.9)';
    for (const [x, y] of [[194, 98], [62, 108]]) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - 8, y + 16, x, y + 22);
      g.quadraticCurveTo(x + 8, y + 16, x, y);
      g.fill();
    }
  } else if (mood === 'dizzy') {
    // 꼬불꼬불한 입
    g.beginPath();
    g.moveTo(112, MY);
    g.quadraticCurveTo(118, MY - 6, 124, MY);
    g.quadraticCurveTo(130, MY + 6, 136, MY);
    g.quadraticCurveTo(140, MY - 4, 144, MY);
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

// 캬바레 셔츠 무늬. 네 칸으로 나눈 배색 새틴(남색, 검정, 보라)에 검정 어깨판
// 몸통 둘레 u=0 이 앞 가운데, u 가 커지면 몸의 왼쪽(+x, 보는 사람의 오른쪽)으로 돈다
const NAVY = '#3149c8';
const BLACK = '#141418';
const PURPLE = '#8f66ff';
let cabaretTex = null;
function cabaretTexture() {
  if (cabaretTex) return cabaretTex;
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const waist = H * 0.5;
  // 보는 사람 기준 오른쪽 앞(u 0~0.25): 위 검정, 아래 남색
  g.fillStyle = BLACK;
  g.fillRect(0, 0, W * 0.25, waist);
  g.fillStyle = NAVY;
  g.fillRect(0, waist, W * 0.25, H - waist);
  // 등판(u 0.25~0.75)은 남색
  g.fillRect(W * 0.25, 0, W * 0.5, H);
  // 보는 사람 기준 왼쪽 앞(u 0.75~1): 위 남색, 아래 보라
  g.fillRect(W * 0.75, 0, W * 0.25, waist);
  g.fillStyle = PURPLE;
  g.fillRect(W * 0.75, waist, W * 0.25, H - waist);
  // 어깨판
  g.fillStyle = BLACK;
  g.fillRect(0, 0, W, H * 0.16);
  // 앞 가운데 단추. 양 끝이 이어지므로 반씩 두 번 그린다
  g.fillStyle = '#0c0c10';
  for (const x of [0, W]) for (let y = H * 0.22; y < H * 0.95; y += H * 0.14) {
    g.beginPath();
    g.arc(x, y, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  cabaretTex = new THREE.CanvasTexture(c);
  cabaretTex.colorSpace = THREE.SRGBColorSpace;
  cabaretTex.wrapS = cabaretTex.wrapT = THREE.RepeatWrapping;
  return cabaretTex;
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
  static knockPose = KNOCK;
  static deskNapPose = DESKNAP;
  // makeup, outfit 은 조풍순처럼 따로 꾸민 캐릭터에만 준다. 기본 손님은 그대로
  constructor({ hair = 0x3b2a22, style = 'bob', shirt = 0x6c8f6a, pants = 0x2f3a4a, staff = false, name = '', makeup = null, outfit = null, skirt = null, legs = null, shoes = 0x2a211d, skin: skinColor = SKIN, acc = 'none' } = {}) {
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
    // hy: 엉덩이를 좌우로 돌리는 각도(엉덩이 흔들기)
    this.j = { lean: 0, roll: 0, nx: 0, ny: 0, nz: 0, slx: 0, slz: 0.15, srx: 0, srz: -0.15, twL: 0, twR: 0, elL: 0, elR: 0, hl: 0, hr: 0, kl: 0, kr: 0, bob: 0, hy: 0, stL: 1, fwd: 0 };

    // 따로 준 피부색은 주황 조명에 묻히지 않게 살짝 스스로 밝힌다
    const skin = skinColor === SKIN ? mat(SKIN, { roughness: 0.6 }) : mat(skinColor, { roughness: 0.6, emissive: 0x4a4242 });
    this.skinM = skin;
    // 마담 차림은 반짝이는 드레스, 캬바레 차림은 무늬 있는 번쩍이는 셔츠
    let shirtM = outfit === 'madam' || outfit === 'dress' ? mat(shirt, { metalness: 0.35, roughness: 0.35 }) : mat(shirt);
    // 롱패딩은 반질반질한 겉감
    if (outfit === 'padding') shirtM = mat(shirt, { metalness: 0.25, roughness: 0.32 });
    if (outfit === 'cabaret') shirtM = new THREE.MeshStandardMaterial({ map: cabaretTexture(), metalness: 0.15, roughness: 0.3, emissive: 0xffffff, emissiveMap: cabaretTexture(), emissiveIntensity: 0.12 });
    const pantsM = mat(pants);
    const shoeM = mat(shoes);
    let legM = legs ? mat(legs, { roughness: 0.45 }) : pantsM;
    if (outfit === 'madam') legM = new THREE.MeshStandardMaterial({ map: fishnetTexture(), roughness: 0.6 });
    // 원피스는 맨다리
    if (outfit === 'dress') legM = skin;
    // 민소매면 위팔도 맨살
    const sleeveM = outfit === 'madam' || outfit === 'dress' ? skin : shirtM;

    this.hips = new THREE.Group();
    this.hips.position.y = HIP_Y;
    this.root.add(this.hips);

    const hipBall = new THREE.Mesh(G.hipBall, skirt ? mat(skirt) : pantsM);
    // 꾸미기에서 색을 바꿀 부위들
    this.shirtParts = [];
    this.pantsParts = skirt ? [] : [hipBall];
    hipBall.scale.set(1, 0.6, 0.9);
    this.hips.add(hipBall);

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const torso = new THREE.Mesh(G.torso, shirtM);
    this.shirtParts.push(torso);
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

    this.headShape = headShape;
    this.buildHair(style, hair);
    this.accGroup = new THREE.Group();
    headShape.add(this.accGroup);
    this.buildAcc(acc);
    if (staff && !outfit) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.025, 8, 32), mat(0x2d4a33));
      band.rotation.x = Math.PI / 2 - 0.25;
      band.position.y = 0.1;
      headShape.add(band);
    }

    // 팔
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(0.15 * side, 0.2, 0);
      this.torso.add(sh);
      // 팔 길이 방향으로 비트는 관절. 팔짱 낄 때 팔꿈치를 안쪽으로 굽히려고 둔다
      const tw = new THREE.Group();
      sh.add(tw);
      const up = new THREE.Mesh(G.upperArm, sleeveM);
      if (sleeveM === shirtM) this.shirtParts.push(up);
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
      return { sh, tw, el, hand, palm, up, fo };
    };
    this.armL = arm(1);
    this.armR = arm(-1);

    // 다리
    const leg = (side) => {
      const hp = new THREE.Group();
      hp.position.set(0.07 * side, 0, 0);
      this.hips.add(hp);
      const th = new THREE.Mesh(G.thigh, legM);
      if (legM === pantsM) this.pantsParts.push(th);
      th.position.y = -0.06;
      hp.add(th);
      const kn = new THREE.Group();
      kn.position.y = -0.12;
      hp.add(kn);
      const sh = new THREE.Mesh(G.shin, legM);
      if (legM === pantsM) this.pantsParts.push(sh);
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
    if (outfit === 'dress') this.addDressOutfit(headShape, shirtM);
    if (outfit === 'padding') this.addPadding(torso, shirtM);
    if (outfit === 'cabaret') this.addCabaretOutfit();

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

  // 롱패딩. 빵빵한 몸통에 누빔 줄, 무릎까지 오는 기장, 털 달린 모자
  addPadding(torso, padM) {
    torso.scale.set(1.3, 1.12, 1.15);
    const lineM = mat(0x0a0c14, { roughness: 0.6 });
    for (const y of [0.04, 0.1, 0.16, 0.22]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.162 - Math.abs(y - 0.13) * 0.3, 0.016, 6, 28), lineM);
      r.rotation.x = Math.PI / 2;
      r.position.y = y;
      this.torso.add(r);
    }
    // 무릎까지 덮는 아랫단
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.2, 0.24, 24), padM);
    hem.position.y = -0.08;
    this.hips.add(hem);
    const hemLine = new THREE.Mesh(new THREE.TorusGeometry(0.183, 0.011, 6, 28), lineM);
    hemLine.rotation.x = Math.PI / 2;
    hemLine.position.y = -0.08;
    this.hips.add(hemLine);
    // 팔도 빵빵하게
    for (const a of [this.armL, this.armR]) {
      a.tw.children[0].scale.setScalar(1.3);
      const fo = a.el.children[0];
      fo.material = padM;
      fo.scale.setScalar(1.25);
    }
    // 털 달린 모자
    const fur = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 24), mat(0xcbb79a, { roughness: 1 }));
    fur.rotation.x = Math.PI / 2;
    fur.position.set(0, 0.28, -0.02);
    this.torso.add(fur);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), padM);
    hood.scale.set(1.1, 0.7, 0.8);
    hood.position.set(0, 0.27, -0.14);
    this.torso.add(hood);
  }

  // 손에 소주병을 든다
  holdBottle() {
    const g = new THREE.Group();
    const m = mat(0x2f8a4a, { roughness: 0.35, transparent: true, opacity: 0.85 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 12), m);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.03, 0.07, 10), m);
    neck.position.y = 0.1;
    g.add(body, neck);
    g.position.y = -0.07;
    g.rotation.x = Math.PI;
    this.armR.hand.add(g);
    this.bottle = g;
  }

  // 민소매 미니 원피스. 퍼지는 치마, 가는 금색 허리띠, 금 링 귀걸이
  addDressOutfit(headShape, dressM) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 0.17, 24), dressM);
    skirt.position.y = -0.06;
    this.hips.add(skirt);
    const gold = mat(0xd9a93a, { metalness: 0.6, roughness: 0.4 });
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.008, 6, 28), gold);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.035;
    this.hips.add(belt);
    const hoopGeo = new THREE.TorusGeometry(0.04, 0.007, 6, 16);
    for (const sx of [-1, 1]) {
      const hoop = new THREE.Mesh(hoopGeo, gold);
      hoop.position.set(0.255 * sx, -0.1, 0.03);
      hoop.rotation.y = Math.PI / 2;
      headShape.add(hoop);
    }
  }

  // 캬바레 셔츠. 소매 색이 서로 다르고 카라는 보라
  addCabaretOutfit() {
    const satin = (c) => mat(new THREE.Color(c).getHex(), { metalness: 0.15, roughness: 0.3, emissive: new THREE.Color(c).multiplyScalar(0.12).getHex() });
    // 몸의 왼팔(보는 사람 오른쪽)은 보라, 오른팔은 남색
    this.armL.tw.children[0].material = satin(PURPLE);
    this.armR.tw.children[0].material = satin(NAVY);
    const collarM = satin(PURPLE);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.016, 8, 24), collarM);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.275;
    this.torso.add(band);
    const collarGeo = new THREE.BoxGeometry(0.06, 0.075, 0.012);
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(collarGeo, collarM);
      c.position.set(0.035 * sx, 0.255, 0.088);
      c.rotation.set(-0.6, 0.3 * sx, 0.5 * sx);
      this.torso.add(c);
    }
  }

  // 머리 모양. 꾸미기로 바꿀 수 있게 따로 묶어 둔다
  buildHair(style, color) {
    if (this.hairGroup) this.headShape.remove(this.hairGroup);
    const g = new THREE.Group();
    const hairM = mat(color, { roughness: 0.55 });
    const add = (geo, x, y, z, sc) => {
      const m = new THREE.Mesh(geo, hairM);
      m.position.set(x, y, z);
      if (sc) m.scale.copy(sc);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const back = add(G.hair, 0, 0.03, -0.035);
    add(G.bangs, 0, 0.005, 0);
    if (style === 'bun') add(G.bun, 0, 0.25, -0.1);
    else if (style === 'pony') add(G.tail, 0, 0.02, -0.27).rotation.x = 0.35;
    else if (style === 'short') {
      back.scale.set(1, 0.9, 1);
      back.position.y = 0.06;
    } else if (style === 'madam') {
      // 부풀린 올림머리와 옆 웨이브
      back.scale.set(1.1, 1.08, 1.06);
      add(G.bun, 0, 0.27, -0.06, new THREE.Vector3(1.6, 1.6, 1.6));
      for (const sx of [-1, 1]) add(G.bun, 0.24 * sx, -0.1, -0.06, new THREE.Vector3(0.9, 0.9, 0.9));
    } else if (style === 'twin') {
      for (const sx of [-1, 1]) add(G.tail, 0.22 * sx, -0.05, -0.1).rotation.z = -0.4 * sx;
    } else if (style === 'long' || style === 'wave') {
      // 등까지 내려오는 긴 머리. 양옆은 어깨 앞으로 늘어뜨린다
      back.scale.set(1.04, 1.02, 1.04);
      add(G.longBack, 0, -0.2, -0.1, new THREE.Vector3(1.15, 1, 0.75));
      for (const sx of [-1, 1]) {
        const lock = add(G.lock, 0.2 * sx, -0.2, 0.03);
        lock.rotation.z = 0.12 * sx;
        // 웨이브는 끝을 동글동글 말아 준다
        if (style === 'wave') for (let k = 0; k < 3; k++) add(G.curl, 0.21 * sx + (k % 2 ? 0.02 : -0.02) * sx, -0.14 - k * 0.09, 0.05);
      }
      if (style === 'wave') for (let k = 0; k < 4; k++) add(G.curl, (k - 1.5) * 0.09, -0.4, -0.12, new THREE.Vector3(1.3, 1.3, 1.3));
    }
    this.hairGroup = g;
    this.headShape.add(g);
  }

  // 소품. 안경, 선글라스, 모자, 머리띠
  buildAcc(acc) {
    this.accGroup.clear();
    if (acc === 'glasses' || acc === 'shades') {
      const frame = mat(acc === 'shades' ? 0x111111 : 0x2a1a12, { roughness: 0.4 });
      for (const sx of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 20), frame);
        ring.position.set(0.065 * sx, 0.025, 0.252);
        this.accGroup.add(ring);
        if (acc === 'shades') {
          const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), mat(0x0a0a0a, { roughness: 0.2 }));
          lens.position.set(0.065 * sx, 0.025, 0.256);
          lens.renderOrder = 3;
          this.accGroup.add(lens);
        }
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.008), frame);
      bridge.position.set(0, 0.03, 0.256);
      this.accGroup.add(bridge);
    } else if (acc === 'hat') {
      const hm = mat(0x2b2b30, { roughness: 0.8 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.16, 20), hm);
      crown.position.y = 0.27;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 24), hm);
      brim.position.y = 0.19;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.192, 0.192, 0.035, 20), mat(0xb3123c));
      band.position.y = 0.215;
      this.accGroup.add(crown, brim, band);
      this.accGroup.rotation.x = -0.12;
    } else if (acc === 'band') {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.022, 8, 32), mat(0xff6fae));
      b.rotation.x = Math.PI / 2 - 0.35;
      b.position.y = 0.11;
      const bow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xff6fae));
      bow.scale.set(1.6, 1, 0.6);
      bow.position.set(0.14, 0.24, 0.05);
      this.accGroup.add(b, bow);
    } else if (acc === 'ears') {
      // 늘어진 강아지 귀(학동로 빌딩 대표)
      const em = mat(0x8a5a34, { roughness: 0.9 });
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), em);
        ear.scale.set(0.55, 1.35, 0.45);
        ear.position.set(0.27 * sx, 0.06, -0.02);
        ear.rotation.z = 0.35 * sx;
        this.accGroup.add(ear);
      }
    }
    if (acc !== 'hat') this.accGroup.rotation.x = 0;
    this.accGroup.traverse((o) => o.isMesh && (o.castShadow = true));
  }

  // 얼굴에 반창고. 사장님이 맞고 나면 한동안 붙인다
  // 맞고 뒤로 벌러덩. 켜 두는 동안 누워 있는다
  setKnocked(on) {
    this.knocked = on;
    this.root.rotation.order = 'YXZ';
  }

  // 책상에 엎드려 자기. 앉아 있는 동안만 팔을 베고 엎드린다
  setDeskNap(on) {
    this.deskNap = on;
  }

  setPlaster(on) {
    if (!this.plaster) {
      const g = new THREE.Group();
      const m = mat(0xf2d0a8, { roughness: 0.9 });
      for (const r of [0.6, -0.6]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.012), m);
        b.rotation.z = r;
        g.add(b);
      }
      g.position.set(-0.13, -0.02, 0.215);
      g.rotation.y = -0.55;
      this.headShape.add(g);
      this.plaster = g;
    }
    this.plaster.visible = on;
  }

  // 꿀밤 맞은 혹. 이마 위쪽에 볼록
  setBump(on) {
    if (!this.bump) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), mat(0xf4a6a0, { roughness: 0.6 }));
      b.position.set(0.07, 0.24, 0.13);
      b.scale.set(1, 0.8, 1);
      this.headShape.add(b);
      this.bump = b;
    }
    this.bump.visible = on;
  }

  // 담배. 오른손에 든다(담배 타임)
  holdCig(on) {
    if (!this.cig) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8), mat(0xf6f2ea, { roughness: 0.8 }));
      stick.rotation.z = Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
      tip.position.x = 0.05;
      g.add(stick, tip);
      g.position.copy(this.glass.position);
      g.position.y += 0.03;
      this.armR.hand.add(g);
      this.cig = g;
    }
    this.cigOn = on;
  }

  // 테니스 라켓. 오른손에 쥔다
  holdRacket() {
    const g = new THREE.Group();
    const frame = mat(0xd83a3a, { roughness: 0.5 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), mat(0x222222));
    handle.position.y = -0.05;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 24), frame);
    ring.scale.set(0.8, 1.15, 1);
    ring.position.y = -0.25;
    const net = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    net.scale.set(0.8, 1.15, 1);
    net.position.y = -0.25;
    g.add(handle, ring, net);
    g.rotation.x = Math.PI / 2;
    this.armR.hand.add(g);
    this.racket = g;
  }

  // 꾸미기 적용. { style, hair, shirt, pants, acc }
  setLook(look) {
    this.buildHair(look.style, look.hair);
    this.buildAcc(look.acc || 'none');
    const sm = mat(look.shirt);
    const pm = mat(look.pants);
    for (const m of this.shirtParts) m.material = sm;
    for (const m of this.pantsParts) m.material = pm;
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
    const D = { cheers: 1.7, oneshot: 2.3, anju: 2.0, talk: 2.4, wave: 1.5, laugh: 1.3, serve: 1.0, yeah: 3.6, tantrum: 2.4, stop: 2.4, humph: 1.3, warn: 2.2, rage: 1.4, clap: 0.7, puke: 2.6, swing: 0.55, slap: 0.8, toss: 0.9, shout: 2.6, smoke: 2.2, squat: 6.0, knock: 1.1, knockL: 1.1, ouch: 1.8, punch: 4.0, oof: 4.0, coffee: 2.2, type: 4.0, doze: 5.0, hurt: 1.4, brawl: 2.6, stomp: 4.2, ladle: 1.6, sip: 1.8, wink: 1.9, aegyo: 2.2, hairflip: 1.7 };
    this.action = { type, t: 0, dur: dur || D[type] || 1.5, fired: false };
  }

  walkTo(points) {
    this.path = points.slice();
    // 서 있다가 출발하면 천천히 시작한다. 걷던 중에 길만 바뀌면 속도 유지
    if (this.state !== 'walk') this.walkV = this.speed * 0.35;
    this.ease = true;
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
    const tgt = { lean: 0, roll: 0, nx: 0, ny: 0, nz: 0, slx: 0, slz: 0.15, srx: 0, srz: -0.15, twL: 0, twR: 0, elL: -0.1, elR: -0.1, hl: 0, hr: 0, kl: 0, kr: 0, bob: 0, hy: 0, stL: 1, fwd: 0 };
    const tipsy = this.blush;

    // 걷기
    if (this.state === 'walk') {
      // 출발할 때 살짝 가속, 마지막 점 앞에서 감속. 꺾이는 점에서 남은 거리는 다음 구간으로 넘겨 속도가 끊기지 않게
      // walkTo 로 걸을 때만(테니스처럼 매 프레임 길을 다시 주는 곳은 늘 같은 속도)
      const full = this.speed * (tipsy >= 3 ? 0.75 : 1);
      this.walkV = this.ease ? Math.min(full, (this.walkV ?? full) + full * dt * 6) : full;
      const last = this.path[this.path.length - 1];
      if (this.ease && this.path.length === 1) {
        const left = Math.hypot(last.x - this.root.position.x, last.z - this.root.position.z);
        this.walkV = Math.min(this.walkV, full * Math.max(0.45, left / 0.4));
      }
      let step = this.walkV * dt;
      while (step > 0 && this.state === 'walk') {
        const p = this.path[0];
        const dx = p.x - this.root.position.x;
        const dz = p.z - this.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d <= step) {
          this.root.position.x = p.x;
          this.root.position.z = p.z;
          this.path.shift();
          step -= d;
          if (!this.path.length) {
            this.state = 'stand';
            if (p.seat && !p.seat.occupant) this.sitAt(p.seat);
            if (p.yaw !== undefined) this.targetYaw = p.yaw;
            if (this.onArrive) this.onArrive(p);
          }
          continue;
        }
        this.root.position.x += (dx / d) * step;
        this.root.position.z += (dz / d) * step;
        this.targetYaw = Math.atan2(dx, dz);
        step = 0;
        // 취하면 옆으로 왔다 갔다 하며 걷는다. 평균은 0이라 길에서 벗어나지 않는다
        if (tipsy >= 2) {
          const side = Math.sin(this.t * 3.2) * 0.9 * (tipsy - 1) * dt;
          this.root.position.x += (dz / d) * side;
          this.root.position.z -= (dx / d) * side;
          this.targetYaw += Math.sin(this.t * 3.2) * 0.25 * (tipsy - 1);
        }
      }
      if (obstacles) pushOut(this.root.position, obstacles);
      if (bounds) {
        this.root.position.x = THREE.MathUtils.clamp(this.root.position.x, bounds.x0, bounds.x1);
        this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, bounds.z0, bounds.z1);
      }
      // 뛸 때는 다리도 빨라진다. 서빙 직원 속도(2.2)까지는 기존과 같다
      this.walkPhase += dt * 9 * Math.max(1, this.speed / 2.2) * Math.max(0.55, Math.min(1, this.walkV / (this.speed || 1)));
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
    // 앉아서 팔짱 끼고 등을 젖힌 거만한 자세(회의 때 팀장)
    if (this.idlePose === 'smug' && this.state === 'sit') {
      tgt.slx = tgt.srx = -0.75;
      tgt.slz = 0.25;
      tgt.srz = -0.25;
      tgt.twL = -Math.PI / 2;
      tgt.twR = Math.PI / 2;
      tgt.elL = tgt.elR = -1.9;
      tgt.lean = -0.22;
      tgt.nx = -0.18;
      tgt.ny = 0.15;
    }
    // 주눅 들어 움츠린 자세. 어깨를 모으고 손은 무릎에, 고개를 살짝 숙이고 조금 떤다(얼굴은 보이게)
    if (this.idlePose === 'cower' && this.state === 'sit') {
      tgt.slx = tgt.srx = -0.5;
      tgt.slz = -0.08;
      tgt.srz = 0.08;
      tgt.elL = tgt.elR = -0.7;
      tgt.lean = 0.1;
      tgt.nx = 0.15 + Math.sin(this.t * 17) * 0.02;
      tgt.bob -= 0.015;
    }
    // 의자에 반쯤 누운 자세. 등을 젖히고 다리를 뻗고, 한 손은 머리 뒤로 다른 손은 책상 위로
    if (this.idlePose === 'recline' && this.state === 'sit') {
      tgt.lean = -1.0;
      tgt.hl = tgt.hr = -1.35;
      tgt.kl = tgt.kr = 0.35;
      tgt.slx = -2.6;
      tgt.slz = 0.55;
      tgt.elL = -2.1;
      tgt.srx = -1.15;
      tgt.elR = -0.35;
      tgt.nx = 0.6;
    }
    // 누우면 등이 바닥에 묻히지 않게 조금 띄운다
    this.knockW = (this.knockW || 0) + ((this.knocked ? 1 : 0) - (this.knockW || 0)) * (1 - Math.exp(-dt * (this.knocked ? 9 : 3)));
    if (this.state !== 'hop') this.root.position.y += (this.baseY + this.knockW * 0.14 - this.root.position.y) * (1 - Math.exp(-dt * 8));

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
    this.glass.visible = this.state === 'sit' && !this.staff && !this.officeSeat;
    if (this.mug) this.mug.visible = false;
    if (this.cig) this.cig.visible = !!this.cigOn;
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
        // 앞으로 푹 숙여 엉덩이를 뒤로 빼고, 두 팔은 앞으로 둥글게 내민 채 엉덩이를 씰룩씰룩
        const w = inOut(0, 0.1, 0.9, 1);
        const wig = Math.sin(this.t * 13);
        tgt.lean = mix(tgt.lean, 0.62, w);
        tgt.hl = tgt.hr = mix(tgt.hl, -0.75, w);
        tgt.kl = tgt.kr = mix(tgt.kl, 0.85, w);
        tgt.bob += -0.05 * w + Math.abs(wig) * 0.012 * w;
        tgt.hy = wig * 0.38 * w;
        tgt.slx = tgt.srx = mix(tgt.slx, -1.35 + Math.sin(this.t * 6.5) * 0.12, w);
        tgt.slz = mix(tgt.slz, -0.12, w);
        tgt.srz = mix(tgt.srz, 0.12, w);
        tgt.elL = tgt.elR = mix(tgt.elL, -0.7, w);
        // 고개는 들어서 앞을 본다
        tgt.nx = mix(tgt.nx, -0.55, w);
        tgt.nz = -wig * 0.06 * w;
        mood = 'talk';
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
      } else if (a.type === 'swing') {
        // 테니스 스윙. 오른팔을 뒤에서 앞으로 크게 휘두르고 몸을 비튼다
        const k = smooth(p);
        tgt.srz = mix(-1.4, 0.4, k);
        tgt.srx = mix(-0.2, -1.4, k);
        tgt.elR = -0.3;
        tgt.hy = mix(-0.5, 0.5, k);
        tgt.lean = 0.15;
        mood = 'happy';
      } else if (a.type === 'punch') {
        // 왼손은 상대 어깨를 붙잡고, 오른 주먹으로 배를 퍽퍽
        const w = inOut(0, 0.05, 0.92, 1);
        const r = Math.max(0, Math.sin(a.t * 13));
        tgt.slx = mix(tgt.slx, -1.45, w);
        tgt.slz = mix(tgt.slz, -0.15, w);
        tgt.elL = mix(tgt.elL, -0.35, w);
        tgt.srx = mix(tgt.srx, mix(-0.55, -1.15, r), w);
        tgt.srz = mix(tgt.srz, 0.05, w);
        tgt.elR = mix(tgt.elR, mix(-1.9, -0.15, r), w);
        tgt.hy = mix(0, 0.12 + r * 0.3, w);
        tgt.lean = mix(tgt.lean, 0.12 + r * 0.06, w);
        mood = 'angry';
      } else if (a.type === 'oof') {
        // 배를 맞고 몸을 숙인다. 맞을 때마다 움찔
        const w = inOut(0, 0.08, 0.9, 1);
        const jolt = Math.abs(Math.sin(a.t * 7));
        tgt.lean = mix(tgt.lean, 0.32 + jolt * 0.15, w);
        tgt.slx = mix(tgt.slx, -0.7, w);
        tgt.srx = mix(tgt.srx, -0.7, w);
        tgt.elL = mix(tgt.elL, -1.6, w);
        tgt.elR = mix(tgt.elR, -1.6, w);
        tgt.twL = -1.0 * w;
        tgt.twR = 1.0 * w;
        tgt.kl = tgt.kr = mix(tgt.kl, 0.35, w);
        tgt.hl = tgt.hr = mix(tgt.hl, -0.3, w);
        tgt.nx = 0.2 * w;
        mood = 'sad';
      } else if (a.type === 'toss') {
        // 서류 던지기. 오른팔을 머리 뒤로 젖혔다가 앞으로 휙
        const up = inOut(0, 0.35, 0.4, 0.5);
        const go = inOut(0.4, 0.55, 0.75, 1);
        tgt.srx = mix(mix(tgt.srx, -2.7, up), -1.3, go);
        tgt.elR = mix(mix(tgt.elR, -1.6, up), -0.15, go);
        tgt.srz = mix(tgt.srz, -0.25, Math.max(up, go));
        tgt.hy = mix(-0.25, 0.3, go) * Math.max(up, go);
        mood = 'angry';
      } else if (a.type === 'knock') {
        // 꿀밤. 폴짝 뛰어 주먹을 들고 머리를 콩콩 두 번 내리친다(머리가 커서 뛰어야 닿는다)
        const w = inOut(0, 0.2, 0.85, 1);
        const jump = inOut(0.18, 0.32, 0.72, 0.86);
        const tap = Math.exp(-(((p - 0.45) / 0.05) ** 2)) + Math.exp(-(((p - 0.63) / 0.05) ** 2));
        tgt.bob += jump * 0.6 - inOut(0.05, 0.15, 0.15, 0.22) * 0.05;
        tgt.kl = tgt.kr = mix(tgt.kl, 0.5, jump);
        tgt.hl = tgt.hr = mix(tgt.hl, -0.3, jump);
        tgt.srx = mix(tgt.srx, -2.2 + tap * 0.35, w);
        tgt.srz = mix(tgt.srz, 0.5, w);
        tgt.elR = mix(tgt.elR, -0.2 - tap * 0.9, w);
        tgt.lean = mix(tgt.lean, 0.4, w);
        tgt.nx = 0.12 * w;
        mood = 'angry';
      } else if (a.type === 'smoke') {
        // 담배 한 모금. 손을 입으로 가져갔다가 내리고 후~
        const w = inOut(0, 0.25, 0.55, 0.8);
        tgt.srx = mix(tgt.srx, -1.75, w);
        tgt.srz = mix(tgt.srz, 0.5, w);
        tgt.elR = mix(tgt.elR, -1.9, w);
        tgt.nx = mix(tgt.nx, p > 0.55 ? -0.25 : -0.05, Math.max(w, inOut(0.55, 0.65, 0.85, 1)));
        mood = p > 0.55 ? 'blink' : 'drink';
      } else if (a.type === 'squat') {
        // 얼차려. 두 팔을 앞으로 뻗고 앉았다 일어서기를 0.7초마다
        const w = inOut(0, 0.05, 0.95, 1);
        const down = Math.sin(((a.t / 0.7) % 1) * Math.PI);
        tgt.hl = tgt.hr = -1.2 * down * w;
        tgt.kl = tgt.kr = 2.0 * down * w;
        tgt.bob = -0.11 * down * w;
        tgt.lean = 0.3 * down * w;
        tgt.slx = tgt.srx = mix(tgt.slx, -1.5, w);
        tgt.slz = 0.1;
        tgt.srz = -0.1;
        tgt.elL = tgt.elR = -0.05;
        mood = 'sad';
      } else if (a.type === 'shout') {
        // 소리지르기. 두 손을 입에 모으고 몸을 뒤로 젖혔다가 앞으로 내지른다
        const w = inOut(0, 0.12, 0.88, 1);
        const push = inOut(0.15, 0.3, 0.75, 0.9);
        tgt.slx = mix(tgt.slx, -1.9, w);
        tgt.srx = mix(tgt.srx, -1.9, w);
        tgt.slz = mix(tgt.slz, -0.45, w);
        tgt.srz = mix(tgt.srz, 0.45, w);
        tgt.elL = mix(tgt.elL, -1.9, w);
        tgt.elR = mix(tgt.elR, -1.9, w);
        tgt.lean = mix(tgt.lean, mix(-0.15, 0.12, push), w);
        tgt.nx = mix(tgt.nx, mix(-0.3, -0.12, push), w);
        tgt.bob += Math.abs(Math.sin(this.t * 20)) * 0.01 * push;
        mood = 'talk';
      } else if (a.type === 'knockL') {
        // 앉은 채로 옆자리 머리에 꿀밤. 몸을 왼쪽으로 기울이고 왼팔을 고무처럼 쭉 늘린다
        // 팔을 먼저 들고 나서 늘린다(늘리며 휘두르면 머리를 뚫고 지나감)
        const w = inOut(0, 0.18, 0.88, 1);
        const ws = inOut(0.2, 0.38, 0.76, 0.9);
        const tap = Math.exp(-(((p - 0.45) / 0.05) ** 2)) + Math.exp(-(((p - 0.63) / 0.05) ** 2));
        tgt.roll = mix(tgt.roll, KNOCK.roll, w);
        tgt.slx = mix(tgt.slx, KNOCK.slx, w);
        tgt.slz = mix(tgt.slz, KNOCK.slz - tap * 0.15, w);
        tgt.elL = mix(tgt.elL, -0.1, w);
        tgt.stL = mix(1, KNOCK.st, ws);
        tgt.nz = mix(tgt.nz, -KNOCK.roll * 0.5, w);
        mood = 'angry';
      } else if (a.type === 'ouch') {
        // 꿀밤 맞고 두 손으로 머리를 감싸며 움츠린다
        const w = inOut(0, 0.1, 0.8, 1);
        tgt.slx = mix(tgt.slx, -2.7, w);
        tgt.srx = mix(tgt.srx, -2.7, w);
        tgt.slz = mix(tgt.slz, 0.35, w);
        tgt.srz = mix(tgt.srz, -0.35, w);
        tgt.elL = mix(tgt.elL, -1.7, w);
        tgt.elR = mix(tgt.elR, -1.7, w);
        tgt.nx = mix(tgt.nx, 0.28, w);
        tgt.lean = mix(tgt.lean, 0.12, w);
        tgt.roll = Math.sin(this.t * 16) * 0.05 * w;
        mood = 'sad';
      } else if (a.type === 'slap') {
        // 손바닥으로 철썩. 팔을 들었다가 옆으로 크게 휘두른다
        const up = inOut(0, 0.3, 0.35, 0.45);
        const hit = inOut(0.35, 0.5, 0.65, 1);
        tgt.srx = mix(tgt.srx, -1.6, Math.max(up, hit));
        tgt.srz = mix(mix(tgt.srz, -1.2, up), 0.6, hit);
        tgt.elR = mix(tgt.elR, -0.4, up);
        tgt.hy = mix(-0.3, 0.4, hit) * Math.max(up, hit);
        mood = 'angry';
        if (!a.fired && p > 0.45) {
          a.fired = true;
          this.onSlap && this.onSlap(this);
        }
      } else if (a.type === 'hurt') {
        // 맞고 휘청. 뒤로 젖혀지며 고개가 돌아간다
        const w = inOut(0, 0.08, 0.6, 1);
        tgt.lean = mix(tgt.lean, -0.35, w);
        tgt.ny = mix(tgt.ny, 0.6, w);
        tgt.nz = mix(tgt.nz, 0.25, w);
        tgt.slz = mix(tgt.slz, 1.0, w);
        tgt.srz = mix(tgt.srz, -1.0, w);
        tgt.roll = Math.sin(this.t * 18) * 0.08 * w;
        mood = 'sad';
      } else if (a.type === 'stomp') {
        // 오른발을 번쩍 들었다가 쿵 내리찍기를 되풀이한다
        const w = inOut(0, 0.06, 0.94, 1);
        const ph = (a.t * 2.6) % 1;
        const lift = ph < 0.65 ? smooth(ph / 0.65) : Math.max(0, 1 - (ph - 0.65) / 0.12);
        tgt.hr = mix(tgt.hr, -0.35 - 0.95 * lift, w);
        tgt.kr = mix(tgt.kr, 0.1 + 1.3 * lift, w);
        tgt.hl = mix(tgt.hl, 0.05, w);
        tgt.lean = mix(tgt.lean, -0.12 * lift + 0.08, w);
        tgt.slx = mix(tgt.slx, -0.5 - 0.4 * lift, w);
        tgt.srx = mix(tgt.srx, -0.5 - 0.4 * lift, w);
        tgt.slz = mix(tgt.slz, 0.5, w);
        tgt.srz = mix(tgt.srz, -0.5, w);
        tgt.elL = tgt.elR = mix(tgt.elL, -1.4, w);
        tgt.nx = mix(tgt.nx, 0.35, w);
        tgt.bob -= (1 - lift) * 0.015 * w;
        mood = 'angry';
        // 발이 땅에 닿는 순간마다 알린다
        const hit = Math.floor(a.t * 2.6 + 0.23);
        if (hit > (a.hits || 0) && a.t < a.dur - 0.2) {
          a.hits = hit;
          this.onStomp && this.onStomp(this);
        }
      } else if (a.type === 'brawl') {
        // 뒤엉켜 싸운다. 팔을 마구 휘두르고 몸이 들썩인다
        const w = inOut(0, 0.05, 0.92, 1);
        const f = this.t * 22;
        tgt.slx = mix(tgt.slx, -1.6 + Math.sin(f) * 0.9, w);
        tgt.srx = mix(tgt.srx, -1.6 + Math.sin(f + 2) * 0.9, w);
        tgt.slz = mix(tgt.slz, 0.6 + Math.cos(f) * 0.5, w);
        tgt.srz = mix(tgt.srz, -0.6 - Math.cos(f + 1) * 0.5, w);
        tgt.roll = Math.sin(f * 0.7) * 0.2 * w;
        tgt.hy = Math.sin(f * 0.5) * 0.4 * w;
        tgt.bob += Math.abs(Math.sin(f)) * 0.04 * w;
        mood = 'angry';
      } else if (a.type === 'ladle') {
        // 국자로 어묵탕을 휘휘 젓고 떠 담는다
        const w = inOut(0, 0.15, 0.85, 1);
        tgt.srx = mix(tgt.srx, -1.2, w);
        tgt.elR = mix(tgt.elR, -0.6 + Math.sin(this.t * 9) * 0.25, w);
        tgt.srz = mix(tgt.srz, Math.cos(this.t * 9) * 0.25, w);
        tgt.lean = mix(tgt.lean, 0.3, w);
        tgt.nx = mix(tgt.nx, 0.25, w);
        mood = 'happy';
      } else if (a.type === 'coffee') {
        // 머그컵 커피 홀짝. 술잔 대신 머그컵을 든다
        const w = inOut(0, 0.2, 0.75, 0.9);
        if (!this.mug) {
          this.mug = new THREE.Group();
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), mat(0xf4f1ea, { roughness: 0.5 }));
          const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 12), mat(0xf4f1ea, { roughness: 0.5 }));
          handle.position.x = 0.05;
          const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.038, 14), mat(0x3a2414));
          coffee.rotation.x = -Math.PI / 2;
          coffee.position.y = 0.046;
          this.mug.add(cup, handle, coffee);
          this.mug.position.copy(this.glass.position);
          this.mug.rotation.copy(this.glass.rotation);
          this.armR.hand.add(this.mug);
        }
        this.mug.visible = true;
        this.glass.visible = false;
        tgt.srx = mix(tgt.srx, -1.75, w);
        tgt.srz = mix(tgt.srz, 0.55, w);
        tgt.elR = mix(tgt.elR, -1.75, w);
        tgt.nx = mix(0, -0.3, w);
        mood = p > 0.7 ? 'happy' : 'drink';
      } else if (a.type === 'type') {
        // 자판 두드리기. 앉아서 두 손을 번갈아 톡톡
        const w = inOut(0, 0.1, 0.9, 1);
        tgt.slx = mix(tgt.slx, -1.05, w);
        tgt.srx = mix(tgt.srx, -1.05, w);
        tgt.elL = mix(tgt.elL, -0.9 + Math.sin(a.t * 22) * 0.18, w);
        tgt.elR = mix(tgt.elR, -0.9 + Math.sin(a.t * 22 + 1.6) * 0.18, w);
        tgt.lean = mix(tgt.lean, 0.18, w);
        tgt.nx = 0.15 * w;
        mood = 'serious';
      } else if (a.type === 'doze') {
        // 꾸벅꾸벅 졸기. 눈을 감고 고개가 떨어졌다 올라온다
        const w = inOut(0, 0.1, 0.9, 1);
        const nod = Math.sin(a.t * 2.2) * 0.5 + 0.5;
        tgt.nx = mix(0, 0.25 + nod * 0.45, w);
        tgt.lean = mix(tgt.lean, 0.1 + nod * 0.1, w);
        mood = 'blink';
      } else if (a.type === 'sip') {
        // 컵을 들고 국물을 후루룩. 술은 아니라 취기는 오르지 않는다
        const w = inOut(0, 0.2, 0.75, 0.9);
        this.glass.visible = true;
        tgt.srx = mix(tgt.srx, -1.75, w);
        tgt.srz = mix(tgt.srz, 0.55, w);
        tgt.elR = mix(tgt.elR, -1.75, w);
        tgt.nx = mix(0, -0.3, w);
        this.glass.userData.tilt = w * 0.9;
        mood = p > 0.7 ? 'happy' : 'drink';
      } else if (a.type === 'clap') {
        // 짝! 두 손을 가슴 앞에서 마주친다
        const w = inOut(0, 0.25, 0.6, 1);
        const hit = Math.abs(Math.sin(p * Math.PI * 2));
        tgt.slx = tgt.srx = mix(tgt.slx, -1.25, w);
        tgt.slz = mix(tgt.slz, -0.25 + hit * 0.35, w);
        tgt.srz = mix(tgt.srz, 0.25 - hit * 0.35, w);
        tgt.elL = tgt.elR = mix(tgt.elL, -0.9, w);
        mood = 'happy';
      } else if (a.type === 'puke') {
        // 바닥에 토한다. 허리를 숙이고 몸이 들썩인다
        const w = inOut(0, 0.12, 0.85, 1);
        const heave = Math.max(0, Math.sin(this.t * 9));
        tgt.lean = mix(tgt.lean, 0.75 + heave * 0.12, w);
        tgt.nx = mix(tgt.nx, 0.35, w);
        tgt.slx = tgt.srx = mix(tgt.slx, -0.5, w);
        tgt.elL = tgt.elR = mix(tgt.elL, -0.3, w);
        tgt.kl = tgt.kr = mix(tgt.kl, 0.45, w);
        tgt.hl = tgt.hr = mix(tgt.hl, -0.4, w);
        tgt.bob += -0.05 * w + heave * 0.02 * w;
        mood = 'drink';
        if (!a.fired && p > 0.3) {
          a.fired = true;
          this.onPuke && this.onPuke(this);
        }
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

    // 쓰러져 있을 때. 팔다리를 벌리고 X 눈
    if (this.knocked) {
      tgt.slx = tgt.srx = -0.2;
      tgt.slz = 1.3;
      tgt.srz = -1.3;
      tgt.elL = tgt.elR = -0.2;
      tgt.hl = -0.15;
      tgt.hr = 0.15;
      tgt.kl = tgt.kr = 0.1;
      tgt.lean = 0;
      tgt.nx = -0.2;
      tgt.ny = Math.sin(this.t * 2) * 0.25;
      tgt.bob = 0;
      mood = 'dizzy';
      // 밟힐 때마다 움찔
      const f = this.flinch || 0;
      if (f > 0) {
        tgt.slz += f * 0.6;
        tgt.srz -= f * 0.6;
        tgt.hl -= f * 0.5;
        tgt.hr -= f * 0.3;
        tgt.nx -= f * 0.4;
        this.flinch = Math.max(0, f - dt * 5);
      }
    }

    // 책상에 엎드려 잘 때. 팔을 포개 베고 고개는 옆으로, 천천히 숨 쉰다
    if (this.deskNap && this.state === 'sit') {
      tgt.lean = DESKNAP.lean + Math.sin(this.t * 1.4) * 0.02;
      tgt.bob = DESKNAP.up;
      tgt.fwd = DESKNAP.fwd;
      tgt.slx = tgt.srx = DESKNAP.sx;
      tgt.slz = -DESKNAP.sz;
      tgt.srz = DESKNAP.sz;
      tgt.elL = tgt.elR = DESKNAP.el;
      tgt.nx = DESKNAP.nx;
      tgt.ny = DESKNAP.ny;
      tgt.nz = 0;
      tgt.roll = 0;
      mood = 'blink';
    }

    // 관절 따라가기
    const k = 1 - Math.exp(-dt * 12);
    for (const key in tgt) j[key] = lerpTo(j[key], tgt[key], k);

    this.hips.position.y = HIP_Y + j.bob;
    this.hips.position.z = j.fwd;
    this.hips.rotation.y = j.hy;
    // 엉덩이만 돌고 윗몸은 앞을 보도록 반대로 돌린다
    this.torso.rotation.set(j.lean, -j.hy * 0.8, j.roll);
    this.neck.rotation.set(j.nx, j.ny, j.nz);
    this.armL.sh.rotation.set(j.slx, 0, j.slz);
    this.armR.sh.rotation.set(j.srx, 0, j.srz);
    this.armL.tw.rotation.y = j.twL;
    this.armR.tw.rotation.y = j.twR;
    this.armL.el.rotation.x = j.elL;
    // 왼팔 늘이기(꿀밤). 1 이면 원래 길이
    const L = this.armL;
    if (Math.abs(j.stL - 1) < 0.002) j.stL = 1;
    if (j.stL !== 1 || L.up.scale.y !== 1) {
      const st = j.stL;
      L.up.scale.y = L.fo.scale.y = st;
      L.up.position.y = -0.07 * st;
      L.el.position.y = -0.12 * st;
      L.fo.position.y = -0.055 * st;
      L.hand.position.y = -0.125 * st;
    }
    this.armR.el.rotation.x = j.elR;
    this.legL.hp.rotation.x = j.hl;
    this.legR.hp.rotation.x = j.hr;
    this.legL.kn.rotation.x = j.kl;
    this.legR.kn.rotation.x = j.kr;

    // 몸 방향
    let dy = this.targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    // 너무 휙 돌지 않게 초당 12라디안까지만
    const turn = dy * (1 - Math.exp(-dt * 10));
    this.yaw += Math.max(-dt * 12, Math.min(dt * 12, turn));
    this.root.rotation.y = this.yaw;
    if (this.knockW > 0.001) this.root.rotation.x = -1.45 * this.knockW;
    else if (this.root.rotation.x) this.root.rotation.x = 0;

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
