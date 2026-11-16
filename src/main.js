// 풍속의 밤. 숲 콘셉트 주점에 앉아 다른 손님과 한 잔 하는 장면
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { buildWorld, TABLE_H } from './world.js';
import { Person } from './person.js';
import { placeDish, placeBottles, makeDish, MENU } from './dishes.js';
import { createSound } from './sound.js';
import { planPath } from './path.js';
import { pushOut } from './person.js';
import { createNet } from './net.js';
import { LOOK_OPTS, lookFromIdx, encodeLook, decodeLook, defaultLookIdx } from './looks.js';
import { STAT_LABELS, emptyStats, soloTitle, roomTitles, packStats, unpackStats } from './titles.js';
import { GAMES, createGames } from './games.js';
import { createTennis } from './tennis.js';
import { createDoubles } from './doubles.js';

const $ = (s) => document.querySelector(s);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const rnd = (a, b) => a + Math.random() * (b - a);

// 렌더러
const app = $('#app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
const CAM_OFFSET = new THREE.Vector3(0, 8.8, 12.8);
camera.position.copy(CAM_OFFSET);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 1.1);
camera.position.add(controls.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 22;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.15;
// 옆으로는 50도까지만 돌린다. 더 돌리면 잎 벽 뒤에서 들여다보게 되어 아무것도 안 보인다
controls.minAzimuthAngle = -0.9;
controls.maxAzimuthAngle = 0.9;
controls.update();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// 번진 빛에 이상한 값(NaN, 무한대)이 섞이면 화면 전체가 검게 번져서 미리 걸러 낸다
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = min(c, vec4(40.0)); }',
  })
);
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.85, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// 같이 놀기. 빌드할 때 Supabase 설정이 들어가면 온라인, 주소에 ?local 이 있으면 같은 브라우저 탭끼리
// 둘 다 아니면 가짜 손님과 혼자 노는 데모
const NET_URL = typeof __NET_URL__ !== 'undefined' ? __NET_URL__ : '';
const NET_KEY = typeof __NET_KEY__ !== 'undefined' ? __NET_KEY__ : '';
const QS = new URLSearchParams(location.search);
const LOCAL_NET = QS.has('local');
const MULTI = !!(NET_URL && NET_KEY) || LOCAL_NET;
const MY_ID = Math.random().toString(36).slice(2, 10);

const W = buildWorld(scene);
// 나는 쫓겨날 때 입구 밖까지 걸어 나갈 수 있다. 누른 곳은 여전히 실내(W.bounds)로 제한한다
const ME_BOUNDS = { ...W.bounds, z1: 8.6 };
const sound = createSound();

// 테이블별 계산서. 주문한 안주 수와 원샷 잔 수를 모은다
for (const T of W.tables) T.bill = { items: {}, shots: 0 };
const PRICE = { jeon: 18900, jeongol: 22900, chicken: 21900, shrimp: 16900, hotteok: 8900 };
const SOJU_PRICE = 5000;
const SOJU_SHOTS = 7;

// 손님
const LOOKS = [
  { hair: 0x2b1d17, style: 'bob', shirt: 0xd9c6a5, pants: 0x3b4a5a },
  { hair: 0x5a3622, style: 'pony', shirt: 0x8fb39a, pants: 0x2f2f38 },
  { hair: 0x1c1512, style: 'short', shirt: 0x37557a, pants: 0x262a30 },
  { hair: 0x8a5a3a, style: 'bun', shirt: 0xe6a3a0, pants: 0x4a3a2e },
  { hair: 0x2b1d17, style: 'short', shirt: 0xf1ede4, pants: 0x3a4a3a },
  { hair: 0xc9a27a, style: 'bob', shirt: 0x6b4a7a, pants: 0x2a2a2a },
  { hair: 0x3a2a22, style: 'bun', shirt: 0xc8743a, pants: 0x2f3a4a },
  { hair: 0x1c1512, style: 'pony', shirt: 0x9aa7b8, pants: 0x3b2f2a },
  { hair: 0x6a4a3a, style: 'short', shirt: 0x5e7a4a, pants: 0x2a2f38 },
  { hair: 0x2b1d17, style: 'bob', shirt: 0xb8434a, pants: 0x2a2a2a },
  { hair: 0x8a6a5a, style: 'short', shirt: 0x4a6a8a, pants: 0x3a3a3a },
  { hair: 0x1c1512, style: 'bun', shirt: 0xe8d38a, pants: 0x3a3a4a },
  { hair: 0x4a2f22, style: 'pony', shirt: 0x7ab0a8, pants: 0x2f2a2a },
];
// 손님 이름. 수다방에 이름으로 나온다
const NAMES = ['지훈', '수빈', '민준', '하은', '도윤', '서연', '현우', '지아', '태민', '유나', '준호', '소희', '재원'];
const people = [];
const npcs = [];

function blobFor(p) {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), W.blobMat);
  b.rotation.x = -Math.PI / 2;
  b.position.y = 0.004;
  p.root.add(b);
}

function addPerson(opts) {
  const p = new Person(opts);
  scene.add(p.root);
  blobFor(p);
  people.push(p);
  W.pickables.push(p.pick);
  return p;
}

// 손님 풍녀1, 풍녀2. 1번, 3번 테이블 바 쪽 자리에 앉아 있다. 같이 놀기에서도 나온다
const FUNG = [
  // 풍녀1: 긴 생머리에 빨간 원피스. 풍녀2: 긴 웨이브 머리에 보라 원피스, 리본 머리띠
  addPerson({ name: '풍녀1', style: 'long', hair: 0x1a1210, shirt: 0xd8203e, pants: 0x1a1a1a, skirt: 0xd8203e, shoes: 0xc8102e, makeup: 'madam', outfit: 'dress' }),
  addPerson({ name: '풍녀2', style: 'wave', hair: 0x8a5a34, shirt: 0x8a3ae0, pants: 0x1a1a1a, skirt: 0x8a3ae0, shoes: 0xe8d8f0, makeup: 'madam', outfit: 'dress', acc: 'band' }),
];
FUNG[0].homeSeat = W.tables[0].seats[1];
FUNG[1].homeSeat = W.tables[2].seats[0];
// 취객 희동이. 얼굴 벌겋고 롱패딩에 소주병. 평소엔 가게 밖 멀리 숨어 있다
const heedong = addPerson({ name: '희동', style: 'short', hair: 0x1a1410, shirt: 0x34416e, pants: 0x55555c, shoes: 0x2a2a2a, skin: 0xe8735e, outfit: 'padding' });
heedong.drinks = 12;
// 술 먹어서 빨개진 코
const hdNose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8283a, roughness: 0.4, emissive: 0x3a0008 }));
hdNose.position.set(0, -0.012, 0.25);
heedong.headShape.add(hdNose);
heedong.wide = true;
heedong.holdBottle();
heedong.root.visible = false;
heedong.root.position.set(0, 0, 30);
FUNG.forEach((f, i) => {
  f.fung = i;
  f.sitAt(f.homeSeat);
  f.drinks = 2;
  f.timer = rnd(3, 8);
});

// 테이블별 손님 수. 3번 테이블은 비워 둔다. 같이 놀기에서는 실제로 들어온 사람만 있다
const FILL = MULTI ? [0, 0, 0, 0, 0, 0] : [3, 2, 4, 0, 2, 2];
let li = 0;
W.tables.forEach((T, ti) => {
  // 풍녀가 앉은 자리는 빼고 채운다
  const seats = T.seats.filter((s) => !s.occupant).sort(() => Math.random() - 0.5);
  for (let k = 0; k < Math.min(FILL[ti], seats.length); k++) {
    const p = addPerson({ ...LOOKS[li % LOOKS.length], name: NAMES[li % NAMES.length] });
    li++;
    p.sitAt(seats[k]);
    p.drinks = (Math.random() * 5) | 0;
    p.timer = rnd(1, 7);
    npcs.push(p);
  }
  if (FILL[ti]) {
    const kinds = MENU.map((m) => m.kind).sort(() => Math.random() - 0.5);
    for (let k = 0; k < 2 + (Math.random() < 0.5 ? 1 : 0); k++) {
      placeDish(W, scene, T, kinds[k]);
      T.bill.items[kinds[k]] = (T.bill.items[kinds[k]] || 0) + 1;
    }
    placeBottles(scene, T, 1 + ((Math.random() * 3) | 0));
  }
});

// 내 생김새. 꾸미기에서 고른 것을 기억해 두고, 처음이면 아이디로 정한다
let myLookIdx = defaultLookIdx(MY_ID);
try {
  myLookIdx = decodeLook(localStorage.getItem('pungsok-look')) || myLookIdx;
} catch (e) {}

// 나
const me = addPerson({ ...lookFromIdx(myLookIdx) });
// 오늘의 기록
const stats = emptyStats();
me.isMe = true;
me.root.position.set(0, 0, 6.2);
me.yaw = me.targetYaw = Math.PI;

// 점원 둘. 바 안의 사장님, 서빙하는 직원
// 사장님은 번쩍이는 캬바레 셔츠
// 사장님 이름은 풍뎅이
const BOSS_OPTS = { name: '풍뎅이', hair: 0x1c1512, style: 'short', shirt: 0xf1ede4, pants: 0x2a2a2a, staff: true, outfit: 'cabaret' };
const bartender = addPerson(BOSS_OPTS);
const BAR_HOME = { x: 0.6, y: 0.32, z: -6.4 };
bartender.root.position.set(BAR_HOME.x, BAR_HOME.y, BAR_HOME.z);
bartender.baseY = BAR_HOME.y;
bartender.timer = 6;
// 알바생 조풍순(29). 올드한 술집 마담 차림에 화장이 아주 진하다
const PUNGSUN_OPTS = {
  name: '조풍순',
  hair: 0x4a1420,
  style: 'madam',
  shirt: 0xb3123c,
  pants: 0x2a2a2a,
  skirt: 0x7a0f2e,
  legs: 0x3a2a30,
  shoes: 0xc8102e,
  staff: true,
  makeup: 'madam',
  outfit: 'madam',
  // 하얀 피부
  skin: 0xffffff,
};
const server = addPerson(PUNGSUN_OPTS);
const SERVER_HOME = { x: -4.6, z: -5.5 };
server.root.position.set(SERVER_HOME.x, 0, SERVER_HOME.z);
server.speed = 2.2;
server.jobs = [];
server.job = null;

// 말풍선
const labels = $('#labels');
function bubbleOf(p) {
  if (!p.bubbleEl) {
    p.bubbleEl = document.createElement('div');
    p.bubbleEl.className = 'bubble';
    labels.appendChild(p.bubbleEl);
  }
  return p.bubbleEl;
}
function say(p, text, dur = 2.6, big = false) {
  const el = bubbleOf(p);
  el.textContent = text;
  el.classList.toggle('big', big);
  el.classList.add('show');
  p.bubbleUntil = simT + dur;
  logChat(p, text, big);
}

// 수다방. 말풍선으로 나온 말을 이름과 함께 채팅처럼 쌓는다
// 방은 둘이다. '전체'는 가게 안 모든 말, '우리 테이블'은 내가 앉은 테이블 사람들 말만
// 말한 사람이 앉은 테이블(직원은 chatTable 로 가 있는 테이블)의 방에도 따로 남긴다
const chatLines = $('#chatLines');
const ROOM_MAX = 80;
const rooms = { all: [], table: W.tables.map(() => []) };
let viewRoom = 'all';

function roomTableOf(p) {
  if (p.seat) return p.seat.table;
  const last = p.state === 'walk' && p.path[p.path.length - 1];
  if (last && last.seat) return last.seat.table;
  return p.chatTable || null;
}

function lineEl(m) {
  const line = document.createElement('div');
  line.className = 'line' + m.role + (m.big ? ' big' : '');
  if (m.who) {
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = m.who;
    line.append(who);
  }
  line.append(document.createTextNode(m.text));
  return line;
}

function pushRoom(list, m, visible) {
  list.push(m);
  if (list.length > ROOM_MAX) list.shift();
  if (!visible) return;
  // 위로 올려 읽는 중이면 아래로 끌어내리지 않는다
  const atBottom = chatLines.scrollHeight - chatLines.scrollTop - chatLines.clientHeight < 30;
  chatLines.querySelector('.empty')?.remove();
  chatLines.appendChild(lineEl(m));
  while (chatLines.children.length > ROOM_MAX) chatLines.firstChild.remove();
  if (atBottom) chatLines.scrollTop = chatLines.scrollHeight;
}

function logChat(p, text, big) {
  const m = {
    who: p.isMe ? '나' : p === bartender ? '풍뎅이 사장' : p.name || '손님',
    role: p.isMe ? ' me' : p === bartender ? ' boss' : p === server ? ' pungsun' : '',
    text,
    big,
  };
  pushRoom(rooms.all, m, viewRoom === 'all');
  const T = roomTableOf(p);
  if (!T) return;
  const mine = me.seat && me.seat.table === T;
  pushRoom(rooms.table[T.id], m, mine && viewRoom === 'table');
  // 보고 있지 않은 방에 새 말이 오면 탭에 점을 찍는다
  if (mine && viewRoom === 'all') tabBtn('table').classList.add('new');
}

const tabBtn = (room) => $(`#chatTabs [data-room="${room}"]`);

function showRoom(room) {
  viewRoom = room;
  for (const b of document.querySelectorAll('#chatTabs button')) b.classList.toggle('on', b.dataset.room === room);
  tabBtn(room).classList.remove('new');
  const list = room === 'table' && me.seat ? rooms.table[me.seat.table.id] : rooms.all;
  chatLines.replaceChildren(...list.map(lineEl));
  if (!list.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = room === 'table' ? '아직 이 테이블에서 나눈 얘기가 없어요' : '아직 아무 말도 없어요';
    chatLines.appendChild(e);
  }
  chatLines.scrollTop = chatLines.scrollHeight;
}
for (const b of document.querySelectorAll('#chatTabs button')) b.onclick = () => showRoom(b.dataset.room);

// 앉은 테이블이 바뀌면 탭 이름을 바꾸고 그 테이블 방을 연다. 일어나면 전체로 돌아간다
let roomSeatId = null;
function syncChatRoom() {
  const id = me.seat ? me.seat.table.id : null;
  if (id === roomSeatId) return;
  roomSeatId = id;
  const tb = tabBtn('table');
  tb.hidden = id === null;
  tb.classList.remove('new');
  if (id !== null) tb.textContent = `우리 테이블 (${id + 1}번)`;
  showRoom(id === null ? 'all' : 'table');
}
// 머리 위 이름표. 나와 이름 있는 직원에게 단다
function addTag(p, text, cls) {
  p.tagEl = document.createElement('div');
  p.tagEl.className = 'tag' + (cls ? ' ' + cls : '');
  p.tagEl.textContent = text;
  labels.appendChild(p.tagEl);
}
addTag(me, '나');
addTag(server, server.name, 'staffTag');
addTag(bartender, '풍뎅이 사장', 'bossTag');
FUNG.forEach((f) => addTag(f, f.name, 'fungTag'));
addTag(heedong, heedong.name, 'hdTag');
heedong.tagEl.style.display = 'none';

const toastEl = $('#toast');
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// 잠깐 뒤에 할 일
const jobs = [];
const later = (sec, fn) => jobs.push({ at: simT + sec, fn });

const PUNGSUN_TAP = ['어머~ 풍순이 불렀어요? 호호', '오빠 오늘 멋지다~ 찡긋', '주문은 아래 버튼으로 해요~ 호호', '어머 손님, 풍순이한테 반했죠?', '저기 사장님이 우리 자기예요~ 호호'];
const PUNGSUN_IDLE = ['어머~ 오늘 손님 많네', '호호호', '풍순이 오늘 화장 좀 됐죠?', '언니 오빠들 천천히 드세요~', '우리 자기 오늘도 멋있다~ 호호'];
const CHAT = ['여기 숲속 같다', '오늘 하루 고생했어', '이거 진짜 맛있다', '다음 주에 또 오자', '조명 너무 예쁘다', '한 잔 더?', 'ㅋㅋㅋㅋㅋ', '사진 찍자!', '요즘 어떻게 지내?', '여기 분위기 최고'];
const REPLY = ['ㅋㅋㅋ 맞아', '와 진짜?', '그러니까!', '한 잔 하자', '나도 그 생각했어', '오 좋다'];
const GREET = ['안녕하세요~', '같이 한 잔 해요!', '여기 자리 있어요~', '반가워요'];

function seated(T) {
  return T.seats.map((s) => s.occupant).filter(Boolean);
}

// 저절로 반응해도 되는 사람. 같이 놀기에서는 실제 사람(나, 친구) 대신 말하지 않는다
const autoOk = (q) => !q.remote && !(MULTI && q.isMe);

// 테이블 전체 건배
function tableCheers(T, by) {
  const ps = seated(T);
  if (by) say(by, '짠!', 1.6);
  for (const p of ps) {
    if (p.isMe && p !== by && (me.action || me.locked)) continue;
    p.do('cheers');
  }
  later(0.62, () => {
    sound.clink(Math.min(4, ps.length));
    W.sparkle(new THREE.Vector3(T.x, TABLE_H + 0.75, T.z));
  });
}

function onOneshot(p) {
  later(0.15, () => say(p, pick(['캬~', '크으~', '좋다!']), 1.4));
  if (p.isMe || (me.seat && p.seat && p.seat.table === me.seat.table)) {
    sound.ahh();
  }
  if (p.seat) p.seat.table.bill.shots++;
  if (p.isMe) {
    stats.shots++;
    updateMeter();
    // 8잔이 넘으면 속이 뒤집힌다
    if (me.drinks >= NAUSEA_AT && !nausea && !me.wc) startNausea();
  }
}
for (const p of people) {
  p.onOneshot = onOneshot;
  p.onChew = (q) => (q.isMe || (me.seat && q.seat && q.seat.table === me.seat.table)) && sound.crunch();
}

// 손님 행동
function npcThink(p, dt) {
  if (!p.seat) return;
  p.timer -= dt;
  if (p.timer > 0 || p.action) return;
  p.timer = rnd(4, 11);
  const r = Math.random();
  if (r < 0.32) {
    p.do('talk');
    // 안주가 없는 테이블에서는 음식 얘기를 하지 않는다
    say(p, pick(p.seat.table.dishes.length ? CHAT : CHAT.filter((c) => !c.includes('맛있다'))));
    const mates = seated(p.seat.table).filter((q) => q !== p && !q.isMe && !q.remote);
    if (mates.length && Math.random() < 0.6) later(1.6, () => {
      const q = pick(mates);
      if (!q.action) {
        q.do('laugh');
        say(q, pick(REPLY), 1.8);
      }
    });
  } else if (r < 0.52) {
    // 안주가 없으면 가운데 어묵탕을 떠 먹는다
    if (p.seat.table.dishes.length && Math.random() < 0.55) p.do('anju');
    else npcEomuk(p);
  } else if (r < 0.68) {
    if (p.drinks < 9) {
      p.do('oneshot');
      if (p.seat.table === (me.seat && me.seat.table)) later(0.5, () => sound.gulp());
    }
  } else if (r < 0.82) {
    p.do('laugh');
  } else if (seated(p.seat.table).length > 1) {
    tableCheers(p.seat.table, p);
  }
}

// 서빙
// 풍순이는 한가하면 테이블을 돌아다니며 손님들에게 여우 짓을 한다
// 여우 짓 대사. 테이블에 안주가 있는지에 따라 할 말이 다르다
const FLIRT = ['오빠~ 한 잔 더 하실래요? 호호', '어머~ 오늘 왜 이렇게 멋있어요~', '풍순이 보러 또 와야 돼요~ 알았죠?', '언니 피부 진짜 좋다~ 호호', '나 오늘 예뻐요? 호호호'];
const FLIRT_FOOD = ['안주 맛있죠~? 풍순이가 직접 날랐잖아요~ 찡긋', '이거 식기 전에 드세요~ 호호'];
const FLIRT_NOFOOD = ['어머~ 아직 주문 안 하셨네? 풍순이가 추천해 줄까요~?', '빈속에 마시면 안 돼요~ 감자전 어때요? 호호'];
const FLIRT_BACK = ['ㅎㅎ...네', '어, 어...', '풍순씨 오늘 왜 이래요ㅋㅋ', '한 잔 더 주세요!', '아 부끄럽네...'];
let roam = null;

// 같이 놀 때는 직원 행동을 방장 한 명만 정하고 신호로 나머지에게 알린다
const decides = () => !MULTI || isHost();

function pungsunIdle(dt) {
  // 손님에게 맞는 중에는 가만히 있는다
  if (server.frozenUntil > simT) return;
  if (roam) return roamUpdate();
  if (date) return dateUpdate();
  // 사장님이 작업 거는 중에는 제자리에서 지켜본다
  if (woo) return;
  // 술게임 진행 중에는 진행만 한다
  if (!decides() || tableGames.size) return;
  if (server.job || server.jobs.length || server.state !== 'stand' || server.action) return;
  // 맞고 들어온 사장님부터 챙긴다
  if (comfortDue && !bossBusy() && bartender.state === 'stand') {
    comfortDue = false;
    return beginDate('comfort');
  }
  // 삐졌으면 돌아다니지 않는다
  if (pSulk) return;
  // 너무 자주 오지 않게 쉬는 시간을 길게
  server.idleT = (server.idleT ?? rnd(10, 20)) - dt;
  if (server.idleT > 0) return;
  server.idleT = rnd(15, 25);
  if (!bossBusy()) {
    if (boss.sulky && Math.random() < 0.7) return beginDate('soothe');
    if (!boss.sulky && Math.random() < 0.25) return beginDate('love');
  }
  if (Math.random() < 0.55 && goFlirt()) return;
  staffDo(server, 'hairflip', pick(PUNGSUN_IDLE), 2.2);
}

// ---------- 사장님과 풍순이 ----------
// 둘은 연인. 풍순이가 바 앞에 가서 꽁냥대고, 삐진 사장님을 달래고, 맞고 들어온 사장님을 챙긴다
// [풍순, 사장님]
const LOVE = [
  ['자기야~ 오늘 손님 많아서 힘들지?', '우리 풍순이 보니까 하나도 안 힘들어~'],
  ['자기 오늘 셔츠 핏 미쳤다~ 호호', '풍순이 화장이 더 미쳤어~'],
  ['자기야 이따 끝나고 포차 갈까?', '콜! 오늘 마감 일찍 한다~'],
  ['자기~ 나 이뻐? 응? 응?', '세상에서 제일 이뻐, 우리 풍순이~'],
];
const SOOTHE = [
  ['자기야~ 화 풀어~ 응? 풍순이가 뽀뽀해 줄게~', '...흥. 두 번.'],
  ['우리 자기 삐졌어? 아이 귀여워~ 호호', '...안 삐졌거든.'],
  ['자기야~ 손님들 다 보잖아~ 웃어 봐~', '...풍순이 때문에 참는다.'],
];
const COMFORT = [
  ['자기 괜찮아? 많이 아팠지? 호오~', '풍순이 보니까 다 나았어...'],
  ['어떡해 우리 자기 반창고... 흐엉', '괜찮아. 울지 마, 풍순아.'],
];
const LOVE_SEEN = ['아 둘이 사귀어?', '염장 지르네...', '사장님 부럽다...', '눈꼴셔 진짜ㅋㅋ'];
const DATE_SPOT = { x: -0.6, z: -4.6 };
let date = null;
// 사장님 패기가 끝나면 켜진다. 사장님이 돌아오면 풍순이가 달래러 간다
let comfortDue = false;

// 방장(혼자면 나)이 정해서 모두에게 알린다
function beginDate(k) {
  const set = k === 'soothe' ? SOOTHE : k === 'comfort' ? COMFORT : LOVE;
  const i = (Math.random() * set.length) | 0;
  send('date', { k, i });
  startDate(k, i);
}

function startDate(k, i) {
  if (server.job || server.jobs.length) return;
  roam = null;
  server.action = null;
  server.chatTable = null;
  date = { k, i, phase: 'go', until: simT + 20 };
  server.walkTo(planPath(server.pos, DATE_SPOT, W.obstacles));
}

function dateHome() {
  date.phase = 'back';
  server.walkTo(planPath(server.pos, SERVER_HOME, W.obstacles));
}

function dateUpdate() {
  const D = date;
  const b = bartender;
  const set = D.k === 'soothe' ? SOOTHE : D.k === 'comfort' ? COMFORT : LOVE;
  const L = set[D.i % set.length];
  if (D.phase !== 'back' && simT > D.until) return dateHome();
  if (D.phase === 'go' && server.state === 'stand') {
    // 그 사이 사장님이 바빠지면 그냥 돌아간다
    if (bossBusy() || b.state !== 'stand') return dateHome();
    server.targetYaw = Math.atan2(b.pos.x - server.pos.x, b.pos.z - server.pos.z);
    server.do(D.k === 'love' ? 'wink' : 'aegyo');
    if (D.k === 'comfort') server.faceMood = 'sad';
    say(server, L[0], 2.4);
    hearts(server);
    sound.smooch();
    D.phase = 'talk';
    D.t = simT + 2.2;
  } else if (D.phase === 'talk' && simT >= D.t) {
    if (server.faceMood === 'sad') server.faceMood = null;
    if (bossBusy()) return dateHome();
    if (D.k === 'soothe') {
      // 삐진 사장님은 돌아보지 않고 대답만 한다. 기분이 많이 풀린다
      say(b, L[1], 2.2);
      if (!b.action && b.state === 'stand') b.do('humph');
      later(1.8, () => setBossMood(boss.mood + 25));
    } else {
      b.targetYaw = Math.atan2(server.pos.x - b.pos.x, server.pos.z - b.pos.z);
      if (!b.action && b.state === 'stand') b.do('laugh');
      say(b, L[1], 2.4);
      later(0.3, () => hearts(b));
      if (D.k === 'comfort') later(1.2, () => setBossMood(boss.mood + 15));
      if (D.k === 'love')
        npcs
          .filter((q) => q.seat && Math.abs(q.pos.z - server.pos.z) < 6)
          .slice(0, 2)
          .forEach((q, i) => later(1.2 + i * 0.5, () => say(q, pick(LOVE_SEEN), 1.8)));
    }
    D.phase = 'after';
    D.t = simT + 2.6;
  } else if (D.phase === 'after' && simT >= D.t) {
    if (!boss.sulky && !bossBusy() && b.state === 'stand' && !b.action) b.targetYaw = 0;
    dateHome();
  } else if (D.phase === 'back' && server.state === 'stand') {
    server.targetYaw = 0;
    date = null;
  }
}

// 손님이 있는 테이블 끝으로 간다. 갈 곳이 없으면 false
function goFlirt(prev) {
  const list = W.tables.filter((T) => T !== prev && seated(T).length);
  if (!list.length) return false;
  const T = pick(list);
  send('roamGo', { tid: T.id });
  roamTo(T);
  return true;
}

function roamTo(T) {
  if (server.job || server.jobs.length) return;
  const spot = { x: T.x + (server.pos.x < T.x ? -1.48 : 1.48), z: T.z };
  roam = { T, spot, phase: 'go', visits: (roam ? roam.visits : 0) + 1 };
  server.chatTable = T;
  server.walkTo(planPath(server.pos, spot, W.obstacles));
}

function roamHome() {
  if (!roam) return;
  roam.phase = 'back';
  server.chatTable = null;
  server.walkTo(planPath(server.pos, SERVER_HOME, W.obstacles));
}

function roamUpdate() {
  const R = roam;
  if (R.phase === 'go' && server.state === 'stand' && (decides() || R.pending)) {
    // 방장이 아니면 방장이 보낸 동작과 대사(pending)를 쓴다
    const f = R.pending || { act: pick(['wink', 'aegyo', 'hairflip']), line: pick([...FLIRT, ...(R.T.dishes.length ? FLIRT_FOOD : FLIRT_NOFOOD)]) };
    R.pending = null;
    if (decides()) send('roamFlirt', f);
    server.targetYaw = Math.atan2(R.T.x - server.pos.x, 0);
    server.do(f.act);
    say(server, f.line, 2.4);
    hearts(server);
    sound.smooch();
    seated(R.T)
      .filter((q) => !q.isMe && !q.remote)
      .forEach((q, i) =>
        later(0.9 + i * 0.4, () => {
          if (!q.action) q.do('laugh');
          say(q, pick(FLIRT_BACK), 1.8);
        })
      );
    R.phase = 'flirt';
  } else if (R.phase === 'flirt' && !server.action && decides()) {
    // 한두 테이블 더 돌고 제자리로
    if (R.visits < 2 && Math.random() < 0.35 && goFlirt(R.T)) return;
    send('roamHome');
    roamHome();
  } else if (R.phase === 'back' && server.state === 'stand') {
    server.targetYaw = 0;
    server.chatTable = null;
    roam = null;
  }
}

// 머리 위로 하트가 떠오른다
const heartV = new THREE.Vector3();
function hearts(p) {
  p.headWorld(heartV).project(camera);
  if (heartV.z > 1) return;
  const x = (heartV.x * 0.5 + 0.5) * app.clientWidth;
  const y = (-heartV.y * 0.5 + 0.5) * app.clientHeight;
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('span');
    el.className = 'heart';
    el.textContent = '\u2665';
    el.style.left = x + rnd(-24, 24) + 'px';
    el.style.top = y + rnd(-6, 10) + 'px';
    el.style.setProperty('--dx', rnd(-20, 20) + 'px');
    el.style.animationDelay = i * 0.12 + 's';
    labels.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}

function serverUpdate() {
  // 주문이 들어오면 돌아다니던 걸 멈추고 서빙부터
  if ((roam || date) && server.jobs.length) {
    roam = null;
    date = null;
    server.action = null;
  }
  if (!server.job && server.jobs.length) {
    const job = server.jobs.shift();
    const T = job.table;
    const sx = T.x + (server.pos.x < T.x ? -1.48 : 1.48);
    job.spot = { x: sx, z: T.z };
    server.job = job;
    server.chatTable = T;
    server.tray.visible = true;
    server.trayDish = makeDish(job.kind);
    server.trayDish.scale.setScalar(0.8);
    server.trayDish.position.y = 0.01;
    server.tray.add(server.trayDish);
    server.walkTo(planPath(server.pos, job.spot, W.obstacles));
    job.phase = 'go';
  }
  const job = server.job;
  if (!job) return;
  if (job.phase === 'go' && server.state !== 'walk') {
    server.targetYaw = Math.atan2(job.table.x - server.pos.x, 0);
    server.do('serve');
    job.phase = 'serve';
    later(0.6, () => {
      server.tray.remove(server.trayDish);
      server.tray.visible = false;
      if (job.kind === 'refill') refillTrough(job.table);
      else placeDish(W, scene, job.table, job.kind);
      sound.pop();
      const name = job.kind === 'refill' ? '오뎅 리필' : MENU.find((m) => m.kind === job.kind).name;
      if (pSulk) sulkyServe(name, job.table);
      else say(server, `${name} 나왔어요~ 호호`, 2.2);
    });
    later(1.4, () => {
      server.walkTo(planPath(server.pos, SERVER_HOME, W.obstacles));
      job.phase = 'back';
    });
  } else if (job.phase === 'back' && server.state !== 'walk') {
    server.targetYaw = 0;
    server.job = null;
    server.chatTable = null;
  }
}

// 바텐더는 가끔 손을 흔든다
function bartenderUpdate(dt) {
  if (!decides()) return;
  wooTimer(dt);
  hdTimer(dt);
  if (party || kick || brawl || woo) return;
  bartender.timer -= dt;
  if (bartender.timer < 0 && !bartender.action) {
    bartender.timer = rnd(8, 16);
    if (boss.sulky) {
      bartender.timer = rnd(5, 9);
      staffDo(bartender, 'humph', pick(SASS), 2, Math.random() < 0.5);
    } else if (Math.random() < 0.5) {
      staffDo(bartender, 'wave', pick(['어서오세요~', '편하게 계세요', '오늘 밤도 좋네요', '풍순아~ 쉬엄쉬엄 해~']), 2);
    } else staffDo(bartender, 'talk', null);
  }
}

// 직원 동작과 대사. 방장이면 다른 사람에게도 같은 걸 보낸다
function staffDo(p, act, line, dur = 2, humph = false, fromNet = false) {
  if (act && !p.action) p.do(act);
  if (line) say(p, line, dur);
  if (humph) sound.humph();
  if (!fromNet) send('staff', { w: p === server ? 's' : 'b', a: act, l: line, d: dur, h: humph });
}

// 주문이 들어오면 사장님이 자기 바 위로 올라가 몸을 숙이고 엉덩이를 씰룩이며 환호한다
const COUNTER = { y: 1.13, z: -5.75 };
let party = null;
const CHEER_BACK = ['사장님 최고!', '와아아~', 'ㅋㅋㅋㅋ 뭐야', '앵콜!', '예에에~'];

function startParty(T) {
  // 진상 손님을 내보내는 중이면 환호는 건너뛴다
  if (party || kick || woo) return;
  party = { T, phase: 'up' };
  bartender.action = null;
  bartender.hopTo(BAR_HOME.x, COUNTER.y, COUNTER.z, 0.6, 0.8);
}

function partyUpdate() {
  const P = party;
  if (!P) return;
  const b = bartender;
  if (P.phase === 'up' && b.state === 'stand') {
    b.targetYaw = Math.atan2(camera.position.x - b.pos.x, camera.position.z - b.pos.z);
    b.do('yeah');
    say(b, '예에에에~~!', 3.4, true);
    sound.yeah();
    const top = new THREE.Vector3(b.pos.x, COUNTER.y + 1.6, b.pos.z);
    [0, 0.9, 1.8].forEach((d) => later(d, () => W.confetti(top)));
    // 주문한 테이블 일행과 다른 손님 몇 명이 반응한다
    const others = npcs.filter((q) => q.seat && q.seat.table !== P.T).sort(() => Math.random() - 0.5).slice(0, 2);
    [...seated(P.T), ...others].filter(autoOk).forEach((q, i) =>
      later(0.6 + i * 0.35, () => {
        if (q.isMe && me.locked) return;
        if (!q.action) q.do(Math.random() < 0.5 ? 'laugh' : 'wave');
        say(q, pick(CHEER_BACK), 2);
      })
    );
    later(1.4, () => say(server, pSulk ? '...흥. 또 시작이네.' : '어머 우리 자기 또 시작이네~ 호호', 2.2));
    P.phase = 'dance';
  } else if (P.phase === 'dance' && !b.action) {
    b.hopTo(BAR_HOME.x, BAR_HOME.y, BAR_HOME.z, 0.6, 0.8, false);
    P.phase = 'down';
  } else if (P.phase === 'down' && b.state === 'stand') {
    b.timer = rnd(8, 16);
    party = null;
    if (boss.sulky) applySulkPose();
    else b.targetYaw = 0;
  }
}

// 사장님 기분. 콕콕 찌르거나 진상을 부리면 떨어지고, 0이 되면 삐진다
// 삐지면 돌아서서 팔짱 끼고 주문을 안 받는다. 사장님을 눌러 달래거나 시간이 지나면 풀린다
const boss = { mood: 100, sulky: false };
const SASS = ['흥.', '네~ 네~', '알아서 하세요~', '주문은 마감이에요.', '...뭐요', '저 지금 기분 별로예요'];
const REFUSE = ['안 받아요. 흥.', '오늘 주문 마감이에요~', '다른 데 가세요~', '지금 기분 아니에요.'];
const bossBusy = () => party || kick || brawl || woo;

function setBossMood(v) {
  boss.mood = THREE.MathUtils.clamp(v, 0, 100);
  updateBossUI();
  if (!boss.sulky && boss.mood <= 0) startSulk();
  else if (boss.sulky && boss.mood >= 50) endSulk();
}

// 화면에는 기분 대신 짜증(100 - 기분)으로 보여 준다. 짜증이 가득 차면 삐진다
function updateBossUI() {
  const irr = 100 - boss.mood;
  const fill = $('#bossFill');
  fill.style.width = irr + '%';
  fill.classList.toggle('low', irr > 65);
  $('#bossState').textContent = boss.sulky ? '삐짐' : irr < 30 ? '평온' : irr < 65 ? '짜증' : '폭발 직전';
}

function startSulk() {
  boss.sulky = true;
  updateBossUI();
  toast('사장님이 삐졌어요! 사장님을 눌러 달래 보세요');
  sound.humph();
  if (!bossBusy()) {
    applySulkPose();
    bartender.do('humph');
  }
  say(bartender, '흥. 됐어요.', 2.4);
}

function applySulkPose() {
  bartender.faceMood = 'pout';
  bartender.idlePose = 'crossed';
  // 손님 쪽에서 반쯤 돌아선다
  bartender.targetYaw = 2.3;
}

function endSulk() {
  boss.sulky = false;
  updateBossUI();
  // 내보내러 가는 중의 화난 얼굴은 끝날 때까지 둔다
  if (bartender.faceMood !== 'fury') bartender.faceMood = null;
  bartender.idlePose = null;
  if (!bossBusy()) bartender.targetYaw = 0;
  say(bartender, '...알았어요. 이번만이에요.', 2.6);
  later(0.8, () => !bartender.action && bartender.state === 'stand' && bartender.do('wave'));
  toast('사장님 기분이 풀렸어요');
}

// 사장님을 누르면 찌르기. 삐졌을 때는 달래기. 누가 눌렀든 모두에게 같은 일이 생긴다
function pokeBoss(fromNet = false) {
  if (!fromNet) send('poke');
  if (boss.sulky) {
    if (bossBusy()) return say(bartender, '...', 1.2);
    const next = boss.mood + 18;
    if (next < 50) {
      say(bartender, next < 20 ? '흥.' : next < 35 ? '...진짜 미안해요?' : '...조금만 더 사과해요', 2);
      bartender.do('humph');
    }
    setBossMood(next);
    return;
  }
  const next = boss.mood - 15;
  if (next > 0) {
    say(bartender, next > 70 ? '어서오세요~' : next > 40 ? '왜요~ 그만 찔러요' : '아 진짜 하지 마요...', 2);
    if (!bartender.action && bartender.state === 'stand') bartender.do(next > 40 ? 'wave' : 'humph');
  }
  setBossMood(next);
}

// 진상을 부리면 사장님이 나와서 손바닥을 내밀고 내보낸다
let kick = null;
const JINSANG = ['사장 나와!!', '이거 왜 이렇게 늦어요!', '서비스 안 줘요?!', '내가 누군 줄 알아?!'];
const SHOCK = ['헐...', '뭐야 저 사람', '아 깜짝이야', '진상이다...'];
const BYE = ['ㅋㅋㅋ 쫓겨났다', '헐 대박', '잘 가요~', '속 시원하다'];
// 쫓겨나면 입구 밖 디딤돌까지 나간다
const EXIT = { x: 0, z: 8.3 };

// 진상은 세 번에 걸쳐 사장님이 점점 화가 난다. 한동안(ANGER_KEEP 초) 조용하면 처음부터
// 1단계: 바에서 억지 미소로 부탁, 2단계: 굳은 얼굴로 손을 저으며 경고, 3단계: 폭발해서 뛰어나와 내보낸다
const ANGER_KEEP = 45;
const WARN = [
  ['손님~ 조금만 조용히 부탁드려요~', '손님~ 다들 계시니까요~ 하하...'],
  ['손님. 다른 분들도 계십니다.', '손님, 한 번만 더 그러시면 곤란해요.'],
];

// 진상 단계 올리기. 난동, 알바생 때리기가 같은 단계를 쓴다
function nextAngerLevel(step = 1) {
  const lv = simT - (me.jinAt ?? -1e9) < ANGER_KEEP ? Math.min(3, (me.jinLv || 0) + step) : step;
  me.jinAt = simT;
  stats.jin++;
  // 쫓겨나면 다음 진상은 다시 1단계부터
  me.jinLv = lv === 3 ? 0 : lv;
  if (lv === 3) {
    me.locked = true;
    me.lockedAt = simT;
  } else later(1.2, () => toast(lv === 1 ? '사장님이 눈치를 줘요 (화남 1/3)' : '사장님 표정이 굳었어요 (화남 2/3) 한 번 더 하면 쫓겨나요'));
  return lv;
}

function startJinsang() {
  const lv = nextAngerLevel();
  me.path = [];
  if (me.state === 'walk') me.state = 'stand';
  me.do('tantrum');
  meSay(pick(JINSANG), 2.4, true);
  // 경고 문구도 모두에게 같게 보이도록 고른 번호를 같이 보낸다
  const wi = (Math.random() * 2) | 0;
  send('jinsang', { lv, wi });
  jinsangEffects(me, lv, wi);
}

// 진상 부린 사람이 누구든 가게 쪽 반응은 같다
function jinsangEffects(p, lv = 3, wi = 0) {
  sound.bang();
  // 가까운 손님들이 놀란다
  npcs
    .filter((q) => q.pos.distanceTo(p.pos) < 4)
    .slice(0, 4)
    .forEach((q, i) => later(0.7 + i * 0.3, () => say(q, pick(SHOCK), 1.8)));
  if (lv < 3) {
    later(0.9, () => bossWarn(p, lv, wi));
    later(1.4, () => setBossMood(boss.mood - (lv === 1 ? 10 : 15)));
    return;
  }
  later(0.8, () => bossRage(p));
  later(1.4, () => say(server, '어머머, 사장님 폭발했다...', 1.8));
  later(1.6, () => setBossMood(boss.mood - 25));
  later(2.2, () => requestKick(p));
}

function faceBossTo(p) {
  const b = bartender;
  b.targetYaw = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
}

// 1, 2단계. 바에서 그 손님 쪽을 보며 말한다. 바쁠 때는 말만
function bossWarn(p, lv, wi = 0, set = WARN) {
  bossGrumble(p, set[lv - 1][wi % set[lv - 1].length], lv === 1 ? 'annoyed' : 'serious', lv === 2 ? 'warn' : null, lv === 2);
}

// 사장님이 바에서 그 손님 쪽을 보며 한마디. 바쁠 때는 말만
function bossGrumble(p, line, face, act, big) {
  const b = bartender;
  // 경고하는 동안에는 평소 혼잣말을 하지 않는다
  b.timer = Math.max(b.timer, 6);
  // 그 손님 테이블 수다방에도 남긴다
  b.chatTable = p.seat ? p.seat.table : null;
  if (b.faceMood !== 'fury') b.faceMood = face;
  say(b, line, 2.6, big);
  if (!bossBusy() && b.state === 'stand') {
    faceBossTo(p);
    if (act) b.do(act);
  }
  if (big) sound.humph();
  later(3.2, restoreBossFace);
}

// 3단계. 핏대 세우고 부들부들 떤 뒤 뛰어나간다
function bossRage(p, line = '...하.') {
  const b = bartender;
  b.timer = Math.max(b.timer, 6);
  b.chatTable = p.seat ? p.seat.table : null;
  b.faceMood = 'fury';
  say(b, line, 1.6, line !== '...하.');
  if (!bossBusy() && b.state === 'stand') {
    faceBossTo(p);
    b.do('rage');
  }
}

// 화난 얼굴을 원래대로. 내보내러 가는 중이면 끝날 때 finishKick 이 한다
function restoreBossFace() {
  const b = bartender;
  if (kick || b.faceMood === 'fury') return;
  b.chatTable = null;
  b.faceMood = boss.sulky ? 'pout' : null;
  if (party) return;
  if (boss.sulky) applySulkPose();
  else b.targetYaw = 0;
}

// 사장님이 설 자리. 앉아 있으면 의자 바깥 옆, 서 있으면 그 사람 앞
function kickSpot(t) {
  let p;
  if (t.seat) {
    const s = t.seat;
    const side = Math.sign(s.x - s.table.x) || 1;
    p = { x: s.x + side * 0.75, z: s.z - Math.cos(s.yaw) * 0.25 };
  } else p = { x: t.pos.x, z: t.pos.z - 0.8 };
  pushOut(p, W.obstacles);
  p.x = THREE.MathUtils.clamp(p.x, ME_BOUNDS.x0, ME_BOUNDS.x1);
  p.z = THREE.MathUtils.clamp(p.z, ME_BOUNDS.z0, ME_BOUNDS.z1);
  return p;
}

// 바 끝을 돌아 나오면 너무 오래 걸려서, 바를 폴짝 넘어 나온 뒤 뛰어간다
const BAR_FRONT_Z = -4.85;
const BOSS_RUN = 4.0;
const BOSS_WALK = 1.6;

// 사장님이 같은 사람에게 돌아가는 중이면 다시 오라고 표시만 하고, 다른 사람이면 줄을 세운다
const kickQueue = [];
function requestKick(t = me) {
  if (kick && kick.target === t) kick.again = true;
  else if (kick) {
    if (!kickQueue.includes(t)) kickQueue.push(t);
  } else kick = { target: t, phase: 'wait' };
}
const kickPendingFor = (t) => (kick && kick.target === t) || kickQueue.includes(t);
// 나간 사람(같이 놀기에서 접속을 끊은 사람)은 내보낼 필요가 없다
const kickGone = (K) => !people.includes(K.target);

function finishKick(K) {
  bartender.timer = rnd(8, 16);
  // 들어오는 사이에 또 진상을 부렸으면 다시 나온다
  kick = K.again && K.mode !== 'eomuk' && !kickGone(K) ? { target: K.target, phase: 'wait' } : kickQueue.length ? { target: kickQueue.shift(), phase: 'wait' } : null;
  if (!kick) {
    bartender.faceMood = null;
    if (boss.sulky) applySulkPose();
    else bartender.targetYaw = 0;
  }
}

function walkBossHome(K) {
  const b = bartender;
  b.chatTable = null;
  b.speed = BOSS_WALK;
  b.walkTo(planPath(b.pos, { x: BAR_HOME.x, z: BAR_FRONT_Z }, W.obstacles));
  K.phase = 'back';
}

function kickUpdate() {
  const K = kick;
  if (!K) return;
  const b = bartender;
  // 어묵탕을 말리러 갈 때는 화내지 않고 정색만 한다
  const calm = K.mode === 'eomuk';
  if (K.phase === 'wait') {
    // 바 위에서 춤추던 중이면 바로 멈추고 거기서 앞으로 뛰어내린다
    if (party) {
      if (party.phase === 'dance') {
        party = null;
        b.action = null;
        b.faceMood = calm ? 'serious' : 'fury';
        say(b, calm ? '손님, 잠깐만요.' : '손님!!', 1.6, !calm);
        K.phase = 'overUp';
      }
      return;
    }
    if (brawl || woo || b.state !== 'stand' || (b.action && b.action.type === 'rage')) return;
    if (kickGone(K)) return finishKick(K);
    b.action = null;
    b.faceMood = calm ? 'serious' : 'fury';
    b.hopTo(BAR_HOME.x, COUNTER.y, COUNTER.z, 0.45, 0.8);
    say(b, calm ? '손님, 잠깐만요.' : '손님!!', 1.6, !calm);
    K.phase = 'overUp';
  } else if (K.phase === 'overUp' && b.state === 'stand') {
    b.hopTo(BAR_HOME.x, 0, BAR_FRONT_Z, 0.45, 0.6);
    K.phase = 'overDown';
  } else if (K.phase === 'overDown' && b.state === 'stand') {
    if (kickGone(K)) return walkBossHome(K);
    b.speed = BOSS_RUN;
    b.walkTo(planPath(b.pos, kickSpot(K.target), W.obstacles));
    K.phase = 'go';
  } else if (K.phase === 'go' && b.state === 'stand') {
    if (kickGone(K)) return walkBossHome(K);
    const t = K.target;
    b.chatTable = t.seat ? t.seat.table : null;
    b.targetYaw = Math.atan2(t.pos.x - b.pos.x, t.pos.z - b.pos.z);
    if (calm) {
      // 손바닥을 내밀며 그만 드시죠. 내보내지는 않는다
      b.faceMood = 'serious';
      b.do('stop');
      say(b, '그만 드시죠.', 2.6, true);
      K.phase = 'stop';
      K.retorted = true;
      K.holdUntil = simT + 2.6;
      t.targetYaw = Math.atan2(b.pos.x - t.pos.x, b.pos.z - t.pos.z);
      later(1.3, () => say(t, EOMUK_REPLY[(t.eomukTotal || 0) % EOMUK_REPLY.length], 2));
      // 앉은 채로 돌아봤으면 다시 테이블 쪽으로
      later(3, () => t.seat && (t.targetYaw = t.seat.yaw));
      return;
    }
    b.faceMood = 'fury';
    b.do('stop');
    say(b, '나가주시죠.', 2.6, true);
    K.phase = 'stop';
    K.retorted = false;
    // 쫓겨나는 사람이 말대꾸하거나 버틴다. 내 쪽은 내가 고르고, 친구는 그 친구가 보낸 신호를 기다린다
    K.holdUntil = simT + 8;
    if (t === me) later(1.4, askKickChoice);
    else if (t.pendingRetort) {
      const r = t.pendingRetort;
      t.pendingRetort = null;
      later(1.4, () => runRetort(t, r.i, r.j));
    } else if (t.pendingHold) {
      const h = t.pendingHold;
      t.pendingHold = null;
      later(1.4, () => runHold(t, h.ok, h.j));
    } else if (t.pendingFight) {
      t.pendingFight = false;
      later(1.4, () => runFight(t));
    }
  } else if (K.phase === 'hold' && kickGone(K)) {
    // 버티던 친구가 나가 버리면 사장님은 돌아간다
    walkBossHome(K);
  } else if (K.phase === 'stop' && !K.retorted && simT >= K.holdUntil) {
    // 말대꾸 신호가 안 오면 그냥 내보낸다
    K.retorted = true;
    K.holdUntil = simT + 1;
    kickOut(K.target, 0);
  } else if (K.phase === 'stop' && K.retorted && !b.action && simT >= K.holdUntil) {
    walkBossHome(K);
  } else if (K.phase === 'back' && K.again && !calm && !kickGone(K)) {
    // 바로 돌아서서 다시 뛰어온다
    K.again = false;
    b.speed = BOSS_RUN;
    b.walkTo(planPath(b.pos, kickSpot(K.target), W.obstacles));
    K.phase = 'go';
  } else if (K.phase === 'back' && b.state === 'stand') {
    b.hopTo(BAR_HOME.x, COUNTER.y, COUNTER.z, 0.45, 0.75);
    K.phase = 'backUp';
  } else if (K.phase === 'backUp' && b.state === 'stand') {
    b.hopTo(BAR_HOME.x, BAR_HOME.y, BAR_HOME.z, 0.45, 0.8, false);
    K.phase = 'backDown';
  } else if (K.phase === 'backDown' && b.state === 'stand') {
    finishKick(K);
  }
}

// 쫓겨날 때 순순히 나가지 않고 말대꾸한다. [말대꾸, 사장님 대답]
const RETORT = [
  ['아 왜요! 돈 내고 마시는 건데!', '돈 안 받을 테니까 나가세요.'],
  ['나 여기 단골인데?!', '오늘부로 아닙니다.'],
  ['사장님 너무하시네 진짜!', '...하아. 문은 저쪽이에요.'],
  ['한 잔만 더 마시고 갈게요~', '안 됩니다. 지금 당장이요.'],
];
// 문 밖에서 돌아보며 한마디. [외침, 사장님 대답]
const EXIT_SHOUT = [
  ['흥! 이 집 다신 안 와요!', '네~ 오지 마세요.'],
  ['리뷰에 다 쓸 거예요!!', '...마음대로 하세요.'],
  ['두고 봐요 진짜!', '하아...'],
  ['내일 또 올 거예요~ 메롱!', '...소금 뿌려.'],
];

// ---------- 버티기 ----------
// 나가라는데 안 나간다. 풍순이가 달려와 사장님을 말려 준다. 하루에 한 번만 통한다
const HOLD_KEY = 'pungsok-hold-day';
const HOLD_LINES = ['안 나가요!! 절대 못 나가요!!', '여기 의자랑 한 몸이에요!!', '저 이 집 아니면 갈 데 없어요!!'];
let kickChoice = null;

const today = () => new Date().toLocaleDateString('ko-KR');
function holdUsedToday() {
  try {
    return localStorage.getItem(HOLD_KEY) === today();
  } catch {
    return false;
  }
}

function askKickChoice() {
  if (!kick || kick.target !== me || kick.phase !== 'stop' || kick.retorted) return;
  kickChoice = { until: simT + 3 };
  const used = holdUsedToday();
  $('#holdSub').textContent = used ? '오늘은 안 통할걸요...' : '안 나가요!!';
  $('#kickHint').textContent = used ? '버티기는 하루에 한 번만 통해요' : '버티면 풍순이가 말려 줄지도? 안 고르면 말대꾸하고 나가요';
  $('#kickCount').textContent = '3';
  $('#kickSheet').classList.add('show');
}

function pickKick(c) {
  if (!kickChoice) return;
  kickChoice = null;
  $('#kickSheet').classList.remove('show');
  if (!kick || kick.target !== me || kick.retorted) return;
  if (c === 'hold') startHold();
  else if (c === 'fight') startFight();
  else startRetort();
}

function kickChoiceUpdate() {
  if (!kickChoice) return;
  if (!kick || kick.target !== me) {
    kickChoice = null;
    $('#kickSheet').classList.remove('show');
    return;
  }
  $('#kickCount').textContent = String(Math.max(1, Math.ceil(kickChoice.until - simT)));
  if (simT >= kickChoice.until) pickKick('retort');
}
document.querySelectorAll('[data-kick]').forEach((el) => (el.onclick = () => pickKick(el.dataset.kick)));

function startHold() {
  const ok = !holdUsedToday();
  if (ok) {
    try {
      localStorage.setItem(HOLD_KEY, today());
    } catch {}
  }
  stats.hold++;
  const i = (Math.random() * HOLD_LINES.length) | 0;
  const j = (Math.random() * EXIT_SHOUT.length) | 0;
  send('hold', { ok: ok ? 1 : 0, i, j });
  runHold(me, ok, j, i);
}

function runHold(t, ok, j, i = 0) {
  if (!people.includes(t)) return;
  const K = kick && kick.target === t ? kick : null;
  if (K) {
    K.retorted = true;
    K.phase = 'hold';
  }
  const b = bartender;
  t.targetYaw = Math.atan2(b.pos.x - t.pos.x, b.pos.z - t.pos.z);
  t.faceMood = 'angry';
  t.do('tantrum', 1.5);
  say(t, HOLD_LINES[i % HOLD_LINES.length], 2.2, true);
  sound.bang();
  later(0.6, () => setBossMood(boss.mood - 10));
  later(1.4, () => {
    b.faceMood = 'fury';
    say(b, '...손님.', 1.2);
  });
  pungsunMediate(t, ok);
  if (ok) {
    later(5.2, () => {
      say(b, '...풍순이 봐서 참는다. 오늘만이에요.', 2.6, true);
      if (!b.action && b.state === 'stand') b.do('humph');
      sound.humph();
      setBossMood(boss.mood - 25);
    });
    later(7.8, () => {
      t.faceMood = null;
      if (t.seat) t.targetYaw = t.seat.yaw;
      if (K && kick === K) walkBossHome(K);
      if (t === me) {
        me.locked = false;
        toast('풍순이 덕분에 버텼어요! 오늘은 다시 안 통해요');
      }
    });
  } else {
    later(5.2, () => {
      say(b, '풍순아, 이번엔 안 돼. 나가주시죠.', 2.6, true);
      if (b.state === 'stand') b.do('stop', 1.8);
    });
    later(6.0, () => say(server, '어머... 손님 미안해요~', 1.8));
    later(7.4, () => {
      if (K && kick === K) {
        K.phase = 'stop';
        K.holdUntil = simT + 1;
      }
      kickOut(t, j);
    });
  }
}

// ---------- 풍순이 놀리기 ----------
// 놀리면 풍순이 기분이 세 단계로 상한다. 세 번째엔 울면서 사장님한테 이르고 한동안 삐진다
// 삐진 풍순이는 돌아다니지 않고 팔짱 끼고 있고, 서빙도 퉁명스럽다. 풍순이를 세 번 눌러 사과하면 풀린다
const TEASE = ['풍순씨 화장 너무 진한 거 아니에요?', '29살 맞아요? 주민증 좀 보여 줘요~', '풍순씨 여우 짓 좀 그만해요~ ㅋㅋ', '사장님이 아깝다~ ㅋㅋㅋ'];
const TEASE_KEEP = 60;
let pSulk = null;

function startTease() {
  if (pSulk) return toast('풍순이가 이미 삐져 있어요. 풍순이를 눌러 사과해 보세요');
  const lv = simT - (me.teaseAt ?? -1e9) < TEASE_KEEP ? Math.min(3, (me.teaseLv || 0) + 1) : 1;
  me.teaseAt = simT;
  me.teaseLv = lv === 3 ? 0 : lv;
  const i = (Math.random() * TEASE.length) | 0;
  send('tease', { lv, i });
  teaseEffects(me, lv, i);
}

function teaseEffects(p, lv, i) {
  const s = server;
  p.targetYaw = Math.atan2(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
  if (!p.action) p.do('laugh');
  say(p, TEASE[i % TEASE.length], 2.2);
  const free = !s.job && !s.jobs.length && s.state === 'stand';
  if (lv === 1) {
    later(1.4, () => {
      s.faceMood = 'annoyed';
      say(s, '...네? 뭐라구요? 호호... 하.', 2);
      if (free && !s.action) s.do('humph');
      later(3.5, () => !pSulk && s.faceMood === 'annoyed' && (s.faceMood = null));
    });
    if (p === me) later(2, () => toast('풍순이 표정이 굳었어요 (1/3)'));
  } else if (lv === 2) {
    later(1.4, () => {
      s.faceMood = 'angry';
      say(s, '손님!! 진짜 너무하시네요!!', 2.2, true);
      sound.bang();
      if (free && !s.action) s.do('tantrum', 1.2);
      later(4, () => !pSulk && s.faceMood === 'angry' && (s.faceMood = null));
    });
    if (p === me) later(2, () => toast('풍순이가 화났어요 (2/3) 한 번 더 하면 울어요'));
  } else {
    later(1.4, () => pungsunCry(p));
  }
}

// 울면서 사장님한테 이르고 삐진다
function pungsunCry(p) {
  const s = server;
  const b = bartender;
  roam = null;
  date = null;
  pSulk = { until: simT + 90, sorry: 0, n: 0 };
  s.faceMood = 'sad';
  say(s, '흐엉~ 자기야~ 저 손님이 나 놀려!!', 2.4, true);
  if (!s.job && !s.jobs.length) {
    s.action = null;
    s.chatTable = null;
    s.frozenUntil = simT + 6;
    s.speed = 3.2;
    s.walkTo(planPath(s.pos, DATE_SPOT, W.obstacles));
    later(5, () => {
      s.speed = 2.2;
      if (!s.job && !s.jobs.length) s.walkTo(planPath(s.pos, SERVER_HOME, W.obstacles));
    });
  }
  later(1.6, () => {
    bossGrumble(p, '누가 우리 풍순이를 울려!!', 'angry', 'rage', true);
    setBossMood(boss.mood - 25);
  });
  later(4, () => {
    s.faceMood = 'pout';
    s.idlePose = 'crossed';
    say(s, '흥. 풍순이 오늘 아무하고도 말 안 해요.', 2.2);
  });
  if (p === me) later(2.4, () => toast('풍순이가 삐졌어요! 풍순이를 눌러 사과해 보세요'));
}

// 삐진 풍순이는 주문도 서빙도 싸가지 없게. 대사는 순서대로 돌려서 모든 화면에 같게
const SULKY_ORDER = ['녜에...', '녜에~ 녜에~ 알겠어요오...', '...녜에. 기다리세요.', '아 또 주문이에요? 녜에...'];
const SULKY_SERVE = ['녜에... 여기요. 흥.', '...{n}. 드세요.', '탁! {n}이요. 녜에.', '알아서 드세요. 흥.'];
function sulkyOrder() {
  if (!pSulk) return;
  const s = server;
  const line = SULKY_ORDER[pSulk.n++ % SULKY_ORDER.length];
  later(0.7, () => {
    s.faceMood = 'pout';
    say(s, line, 2);
    sound.humph();
    if (!s.action && s.state === 'stand' && !s.job) s.do('humph');
  });
}
function sulkyServe(name, T) {
  const s = server;
  // 접시를 탁 내려놓고 고개를 홱 돌린다
  sound.bang();
  say(s, SULKY_SERVE[pSulk.n++ % SULKY_SERVE.length].replace('{n}', name), 2.2);
  s.action = null;
  s.do('humph');
  later(0.4, () => (s.targetYaw = Math.atan2(s.pos.x - T.x, 0)));
}

// 삐진 풍순이를 누르면 사과. 세 번이면 풀린다
function sorryPungsun(fromNet = false) {
  if (!pSulk) return;
  if (!fromNet) send('psorry');
  pSulk.sorry++;
  const s = server;
  if (pSulk.sorry >= 3) return endPSulk('...이번만 봐 줄게요. 흥!');
  say(s, pSulk.sorry === 1 ? '...흥.' : '...진짜 미안해요?', 1.8);
  if (!s.action && s.state === 'stand') s.do('humph');
  sound.humph();
}

function endPSulk(line) {
  const s = server;
  pSulk = null;
  s.idlePose = null;
  s.faceMood = null;
  say(s, line, 2.2);
  later(0.8, () => !s.action && s.state === 'stand' && s.do('wink'));
}

function pSulkUpdate() {
  if (pSulk && simT > pSulk.until) endPSulk('...이제 좀 풀렸어요. 흥.');
}

// ---------- 취객 희동이 ----------
// 가끔 얼굴 벌건 롱패딩 취객 희동이가 들어와 한 테이블에서 깽판을 친다. 사장님이 나와서 내보낸다
// 방장이 4~7분마다 정해 hd{ti} 로 알리고, 나머지는 모든 화면에서 똑같이 흘러간다
const HD_AWAY = { x: 0, z: 30 };
const HD_TAP = ['뭘 봐!! 한잔 할래?!', '끅... 나 안 취했어!!', '희동이 몰라 희동이?!', '여기 사장 내 친구야~ 끅'];
let hd = null;
let hdT = rnd(240, 420);
// 나간 뒤 잠깐은 다시 못 부른다
let hdCool = 0;

function hdTimer(dt) {
  if (hd || woo || party || kick || brawl) return;
  hdT -= dt;
  if (hdT > 0) return;
  hdT = rnd(240, 420);
  hdBegin();
}

function hdBegin() {
  const list = W.tables.filter((T) => seated(T).length);
  if (!list.length || hd) return;
  const T = pick(list);
  send('hd', { ti: T.id });
  startHd(T.id);
}

function startHd(ti) {
  const T = W.tables[ti];
  if (hd || !T) return;
  const p = heedong;
  p.root.visible = true;
  p.tagEl.style.display = '';
  p.kickedOut = false;
  p.action = null;
  p.faceMood = 'angry';
  p.path = [];
  p.state = 'stand';
  p.root.position.set(EXIT.x, 0, EXIT.z + 0.3);
  // 테이블의 가게 가운데 쪽 끝에 선다
  const spot = { x: T.x + (T.x <= 0 ? 1.5 : -1.5), z: T.z };
  pushOut(spot, W.obstacles);
  hd = { T, phase: 'walk', deadline: simT + 80 };
  p.speed = 1.3;
  p.walkTo(planPath(p.pos, spot, W.obstacles));
  say(p, '야!!! 여기 술 좀 줘 봐!!! 끅', 2.4, true);
  sound.bang();
  npcs
    .filter((q) => q.seat)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .forEach((q, k) => later(1.2 + k * 0.5, () => say(q, pick(['헐 저 사람 뭐야', '완전 취했네...', '패딩 입고 술집을...?']), 1.6)));
}

// 안주 접시를 하나 엎는다
function hdSmash(T) {
  const p = heedong;
  if (!T.dishes.length) {
    say(p, '술!! 술 내놔!!', 1.8, true);
    sound.bang();
    return;
  }
  const d = T.dishes.pop();
  const at = d.group.position.clone();
  scene.remove(d.group);
  if (d.pot) W.pots.splice(W.pots.indexOf(d.pot), 1);
  W.sparkle(at.add(new THREE.Vector3(0, 0.2, 0)));
  sound.pop();
  sound.bang();
  say(p, '이딴 안주는 치워!!', 1.8, true);
  const q = seated(T).find(autoOk);
  if (q) later(0.8, () => say(q, '아 내 안주!!', 1.6, true));
}

function hdUpdate() {
  const H = hd;
  if (!H) return;
  const p = heedong;
  if (simT > H.deadline) return hdGone();
  if (H.phase === 'walk' && p.state === 'stand') {
    H.phase = 'rampage';
    const T = H.T;
    p.targetYaw = Math.atan2(T.x - p.pos.x, T.z - p.pos.z);
    p.do('tantrum', 1.6);
    sound.bang();
    say(p, '이 집 술이 왜 이렇게 싱거워?!', 2.2, true);
    seated(T)
      .filter(autoOk)
      .slice(0, 3)
      .forEach((q, k) =>
        later(0.8 + k * 0.4, () => {
          if (!q.action) q.do('hurt');
          say(q, pick(['아 깜짝이야!!', '아저씨 왜 이러세요!', '헐...']), 1.6);
        })
      );
    later(2.6, () => hd === H && hdSmash(T));
    later(5.2, () => {
      if (hd !== H) return;
      p.do('wave');
      say(p, '♬ 오늘은 내가 왕이다~ 희동이가 왕이다~ ♬', 2.6, true);
    });
    later(8.2, () => {
      if (hd !== H) return;
      say(p, '풍순아~ 이리 와서 한잔 따라 봐~ 끅', 2.2);
      later(1.2, () => say(server, '어머 이 아저씨 왜 이래?! 자기야!!', 2, true));
    });
    // 사장님 출동. 말대꾸와 문 밖 외침은 정해 둔 대사로
    later(9.6, () => {
      if (hd !== H) return;
      p.pendingRetort = { i: 1, j: 3 };
      requestKick(p);
    });
  } else if (H.phase !== 'leaving' && p.kickedOut && p.state === 'stand') {
    H.phase = 'leaving';
    exitShout(p);
    later(3, () => hd === H && hdGone());
  }
}

// ☰ 메뉴 "희동이 부르기". 누가 부르든 모든 화면에 같이 나온다
function callHd() {
  if (hd) return toast('희동이가 이미 와 있어요');
  if (simT < hdCool) return toast('희동이가 아직 집에 가는 중이에요. 조금 이따가...');
  if (woo || party || kick || brawl || knockout) return toast('지금은 사장님이 바빠서 희동이가 눈치 보고 있어요. 조금 이따가...');
  const list = W.tables.filter((T) => seated(T).length);
  if (!list.length) return toast('희동이는 손님이 앉은 테이블로 와요. 먼저 자리에 앉아 주세요');
  const T = pick(list);
  hdT = rnd(240, 420);
  send('hd', { ti: T.id, call: 1 });
  logSystem('희동이를 불렀어요. 곧 비틀비틀 들어와요');
  startHd(T.id);
}

// 사라진다. 사장님이 데리러 가는 중이면 그만두게 한다
function hdGone() {
  const p = heedong;
  hd = null;
  hdCool = simT + 20;
  if (kick && kick.target === p) {
    if (kick.phase === 'wait') kick = null;
    else if (!kick.phase.startsWith('back')) walkBossHome(kick);
  }
  const qi = kickQueue.indexOf(p);
  if (qi >= 0) kickQueue.splice(qi, 1);
  p.pendingRetort = null;
  p.kickedOut = false;
  p.action = null;
  p.faceMood = 'angry';
  p.path = [];
  p.state = 'stand';
  p.root.visible = false;
  p.tagEl.style.display = 'none';
  p.root.position.set(HD_AWAY.x, 0, HD_AWAY.z);
}

// ---------- 사장님 작업 ----------
// 사장님이 풍녀1, 풍녀2 에게 번갈아 작업을 걸다가 들킨다. 작업 걸린 풍녀와 질투한 풍순이가 같이 밟는다
// 방장(혼자면 나)이 2~4분마다 정해서 woo{i} 로 알리고, 나머지는 모든 화면에서 똑같이 흘러간다
// [사장님, 풍녀 대답]. a, b 는 작업, c 는 들키는 장면
const WOO_SETS = [
  {
    a: ['혼자 오셨어요? 오늘 유난히 빛나시네~', '어머~ 사장님 왜 이러세요~ 호호'],
    b: ['이 테이블만 조명이 다르네? 미모 때문인가~', '진짜요? 사장님 말 잘하신다~'],
    c: ['서비스 드릴게요~ 이따 저랑 따로 한잔 어때요?', '...아까 저쪽 테이블에서도 똑같이 말하던데요?'],
  },
  {
    a: ['손님 같은 분 처음 봐요. 혹시 연예인이세요?', '호호 사장님 농담도~'],
    b: ['저 원래 이런 말 안 하는데... 눈이 너무 예뻐요', '어머 진짜요? 부끄럽게~'],
    c: ['진심이에요. 이 가게에서 제일 예뻐요~', '...방금 저 언니한테도 제일 예쁘다면서요?!'],
  },
];
let woo = null;
let wooT = rnd(120, 240);

function canWoo() {
  const b = bartender;
  return !boss.sulky && !bossBusy() && b.state === 'stand' && !b.action && !tableGames.size && FUNG.every((f) => f.seat && !f.action);
}

// 방장이 가끔 시작한다
function wooTimer(dt) {
  if (woo || party || kick || brawl) return;
  wooT -= dt;
  if (wooT > 0) return;
  wooT = rnd(120, 240);
  if (canWoo()) beginWoo();
}

function beginWoo() {
  const i = (Math.random() * 4) | 0;
  send('woo', { i });
  startWoo(i);
}

function startWoo(i) {
  if (woo || party || kick || brawl) return;
  const b = bartender;
  const first = (i >> 1) % 2;
  woo = { i, set: WOO_SETS[i % 2], order: [first, 1 - first, first], vi: 0, phase: 'up', deadline: simT + 75 };
  b.action = null;
  b.chatTable = null;
  b.faceMood = null;
  b.idlePose = null;
  if (roam) roamHome();
  say(b, '흠흠~ 오늘 손님들 좀 예쁘시네~', 1.8);
  b.hopTo(BAR_HOME.x, COUNTER.y, COUNTER.z, 0.45, 0.8);
}

// 다음 풍녀 옆으로 걸어간다
function wooGo() {
  const b = bartender;
  const f = FUNG[woo.order[woo.vi]];
  b.speed = 2.2;
  b.walkTo(planPath(b.pos, kickSpot(f), W.obstacles));
  woo.phase = 'walk';
}

function wooUpdate() {
  const Wo = woo;
  if (!Wo) return;
  const b = bartender;
  // 어딘가 꼬이면 바 안으로 되돌린다
  if (simT > Wo.deadline) return wooReset();
  if (Wo.phase === 'up' && b.state === 'stand') {
    b.hopTo(BAR_HOME.x, 0, BAR_FRONT_Z, 0.45, 0.6);
    Wo.phase = 'over';
  } else if (Wo.phase === 'over' && b.state === 'stand') {
    wooGo();
  } else if (Wo.phase === 'walk' && b.state === 'stand') {
    const f = FUNG[Wo.order[Wo.vi]];
    b.targetYaw = Math.atan2(f.pos.x - b.pos.x, f.pos.z - b.pos.z);
    b.chatTable = f.seat ? f.seat.table : null;
    if (Wo.vi < 2) {
      const line = Wo.vi === 0 ? Wo.set.a : Wo.set.b;
      b.do('wink');
      say(b, line[0], 2.6);
      hearts(b);
      sound.smooch();
      later(1.6, () => {
        if (!f.action) f.do('laugh');
        say(f, line[1], 2.2);
        hearts(f);
      });
      // 두 번째부터 풍순이가 수상하게 본다
      if (Wo.vi === 1) later(3.0, () => say(server, '...자기 지금 뭐 하는 거지?', 1.8));
      Wo.phase = 'talk';
      Wo.t = simT + 4.4;
    } else {
      Wo.phase = 'caught';
      wooCaught(f, FUNG[1 - Wo.order[Wo.vi]]);
    }
  } else if (Wo.phase === 'talk' && simT >= Wo.t) {
    Wo.vi++;
    wooGo();
  } else if (Wo.phase === 'home' && b.state === 'stand') {
    b.hopTo(BAR_HOME.x, COUNTER.y, COUNTER.z, 0.45, 0.75);
    Wo.phase = 'homeUp';
  } else if (Wo.phase === 'homeUp' && b.state === 'stand') {
    b.hopTo(BAR_HOME.x, BAR_HOME.y, BAR_HOME.z, 0.45, 0.8, false);
    Wo.phase = 'homeDown';
  } else if (Wo.phase === 'homeDown' && b.state === 'stand') {
    wooEnd();
  }
}

function wooEnd() {
  const b = bartender;
  woo = null;
  b.timer = rnd(8, 16);
  b.chatTable = null;
  b.faceMood = boss.sulky ? 'pout' : null;
  if (boss.sulky) applySulkPose();
  else b.targetYaw = 0;
}

function wooReset() {
  const b = bartender;
  b.setKnocked(false);
  b.path = [];
  b.state = 'stand';
  b.root.position.set(BAR_HOME.x, BAR_HOME.y, BAR_HOME.z);
  b.baseY = BAR_HOME.y;
  knockout = null;
  FUNG.forEach((f) => {
    f.faceMood = null;
    if (!f.seat && f.homeSeat && !f.homeSeat.occupant) f.sitAt(f.homeSeat);
  });
  wooEnd();
}

// 움직이던 중이면 멈출 때까지 기다렸다가 한다
function whenStill(p, fn, tries = 8) {
  if (p.state !== 'walk' || tries <= 0) {
    if (p.state === 'walk') {
      p.path = [];
      p.state = 'stand';
    }
    return fn();
  }
  later(0.3, () => whenStill(p, fn, tries - 1));
}

// 누운 사장님 배 쪽을 쿵쿵 밟는다
function stompOn(p, belly) {
  const b = bartender;
  p.targetYaw = Math.atan2(belly.x - p.pos.x, belly.z - p.pos.z);
  p.onStomp = () => {
    sound.slap();
    b.flinch = 1;
    W.sparkle(new THREE.Vector3(belly.x, 0.35, belly.z));
  };
  p.action = null;
  p.do('stomp');
}

function wooCaught(f, other) {
  const b = bartender;
  const line = woo.set.c;
  // 사장님은 풍녀 쪽을 보고 서 있다가 뒤로 넘어진다. 배 양옆이 밟는 자리
  const yaw = b.targetYaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const belly = { x: b.pos.x - fx * 0.45, z: b.pos.z - fz * 0.45 };
  const spotF = { x: belly.x + fz * 0.36, z: belly.z - fx * 0.36 };
  const spotP = { x: belly.x - fz * 0.36, z: belly.z + fx * 0.36 };
  pushOut(spotF, W.obstacles);
  pushOut(spotP, W.obstacles);

  b.do('wink');
  say(b, line[0], 2.4);
  hearts(b);
  later(1.6, () => {
    f.faceMood = 'angry';
    say(f, line[1], 2.2, true);
  });
  later(2.6, () => {
    other.faceMood = 'angry';
    if (!other.action) other.do('tantrum', 1.4);
    say(other, '뭐야? 나한테도 그랬잖아!!', 2, true);
    sound.bang();
  });
  // 풍순이가 질투해서 달려온다
  const pungsunCan = !server.job && !server.jobs.length;
  later(3.2, () => {
    say(server, '자기야!!! 지금 뭐 하는 거야?!', 2, true);
    if (!pungsunCan) return;
    roam = null;
    date = null;
    server.action = null;
    server.chatTable = null;
    server.frozenUntil = simT + 16;
    server.faceMood = 'angry';
    server.speed = 3.6;
    server.walkTo(planPath(server.pos, spotP, W.obstacles));
  });
  later(4.0, () => {
    b.faceMood = 'sad';
    say(b, '아, 아니 그게...', 1.4);
  });
  // 밀쳐서 눕힌다
  later(4.8, () => {
    f.standUp();
    f.path = [];
    f.targetYaw = Math.atan2(b.pos.x - f.pos.x, b.pos.z - f.pos.z);
    f.onSlap = null;
    f.do('slap');
    say(f, '저리 가!!', 1.4, true);
  });
  later(5.1, () => {
    b.action = null;
    b.faceMood = null;
    b.setKnocked(true);
    b.setPlaster(true);
    later(90, () => b.setPlaster(false));
    sound.slap();
    sound.bang();
    say(b, '어어억?!', 1.2, true);
    knockout = { t: f, spark: 0 };
    f.walkTo([spotF]);
  });
  later(6.0, () =>
    whenStill(f, () => {
      stompOn(f, belly);
      say(f, '이 바람둥이 같으니!!', 2, true);
    })
  );
  if (pungsunCan)
    later(6.4, () =>
      whenStill(server, () => {
        server.speed = 2.2;
        stompOn(server, belly);
        say(server, '풍순이 놔두고 바람을 펴?!', 2.2, true);
      })
    );
  later(7.4, () => say(b, '아악! 오해야 자기야!!', 1.6, true));
  later(7.8, () =>
    npcs
      .filter((q) => q.seat)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .forEach((q, k) => later(k * 0.4, () => say(q, pick(['ㅋㅋㅋ 사장님 밟힌다', '자업자득이다', '풍순이 무섭다...', '와 둘이 같이 밟네']), 1.6)))
  );
  later(9.2, () => say(b, '자, 잘못했어요...!', 1.6));
  // 다 밟고 돌아간다
  later(11.2, () => {
    f.onStomp = null;
    f.faceMood = 'pout';
    say(f, '흥!', 1.2);
    if (f.homeSeat && !f.homeSeat.occupant) f.sitAt(f.homeSeat);
    later(6, () => f.faceMood === 'pout' && (f.faceMood = null));
    other.faceMood = null;
  });
  later(11.6, () => {
    server.onStomp = null;
    server.faceMood = 'pout';
    if (pungsunCan && !server.action) server.do('humph');
    say(server, '오늘 집에 들어오지 마!! 흥!!', 2.2, true);
  });
  later(12.8, () => {
    if (pungsunCan && !server.job && !server.jobs.length) server.walkTo(planPath(server.pos, SERVER_HOME, W.obstacles));
    later(5, () => server.faceMood === 'pout' && (server.faceMood = null));
  });
  // 사장님이 일어나 바로 돌아간다
  later(14.0, () => {
    knockout = null;
    b.setKnocked(false);
    b.flinch = 0;
    b.faceMood = 'sad';
    say(b, '...장사나 해야겠다.', 2.2);
    setBossMood(boss.mood - 20);
    if (!woo) return;
    b.speed = BOSS_WALK;
    b.walkTo(planPath(b.pos, { x: BAR_HOME.x, z: BAR_FRONT_Z }, W.obstacles));
    woo.phase = 'home';
  });
}

// ---------- 너가 뭔데? ----------
// 나가라는 사장님을 밀쳐 눕히고 마구 밟는다. 일어나면 사장님이 삐져서 주문을 안 받는다
// 나는 안 쫓겨난다
let knockout = null;

function startFight() {
  stats.ko++;
  send('fight');
  runFight(me);
}

function runFight(t) {
  if (!people.includes(t)) return;
  const K = kick && kick.target === t ? kick : null;
  if (K) {
    K.retorted = true;
    K.phase = 'fight';
  }
  const b = bartender;
  if (t.seat) t.standUp();
  t.path = [];
  t.targetYaw = Math.atan2(b.pos.x - t.pos.x, b.pos.z - t.pos.z);
  t.faceMood = 'fury';
  t.do('tantrum', 1.0);
  say(t, '너가 뭔데?', 1.6, true);
  sound.bang();
  later(1.0, () => {
    b.faceMood = 'fury';
    say(b, '...뭐요?', 1.0);
  });
  // 확 밀쳐서 눕힌다
  later(1.4, () => {
    t.targetYaw = Math.atan2(b.pos.x - t.pos.x, b.pos.z - t.pos.z);
    b.targetYaw = Math.atan2(t.pos.x - b.pos.x, t.pos.z - b.pos.z);
    t.action = null;
    // 풍순이 때리기 때 걸어 둔 것이 다시 불리지 않게
    t.onSlap = null;
    t.do('slap');
    say(t, '저리 가!!', 1.2, true);
  });
  later(1.75, () => {
    b.action = null;
    b.faceMood = null;
    b.setKnocked(true);
    b.setPlaster(true);
    later(90, () => b.setPlaster(false));
    sound.slap();
    sound.bang();
    say(b, '어어억?!', 1.2, true);
    knockout = { t, spark: 0 };
    npcs.slice(0, 4).forEach((q, i) => later(0.5 + i * 0.3, () => say(q, pick(['헐 사장님을?!', '눕혔어!!', '대박...']), 1.6)));
    pungsunRush(b, '자기야!!!', '그만 밟아요!! 우리 자기 죽어!!');
    // 누운 사장님 옆으로 한 걸음 다가간다
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const spot = { x: b.pos.x - fx * 0.3 + fz * 0.34, z: b.pos.z - fz * 0.3 - fx * 0.34 };
    pushOut(spot, W.obstacles);
    t.walkTo([spot]);
  });
  // 쿵! 쿵! 밟는다
  later(2.8, () => {
    // 누운 사장님 배 쪽을 본다
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const belly = { x: b.pos.x - fx * 0.45, z: b.pos.z - fz * 0.45 };
    if (t.state === 'walk') {
      t.path = [];
      t.state = 'stand';
    }
    t.targetYaw = Math.atan2(belly.x - t.pos.x, belly.z - t.pos.z);
    t.onStomp = () => {
      sound.slap();
      b.flinch = 1;
      W.sparkle(new THREE.Vector3(belly.x, 0.35, belly.z));
    };
    t.do('stomp');
    say(t, '쿵! 쿵! 쿵!! 밟아 주마!!', 2.4, true);
    later(0.8, () => say(b, '아악! 아파요!!', 1.4, true));
    later(2.4, () => say(b, '자, 잘못했어요...', 1.6));
  });
  // 다 밟고 나서 의기양양
  later(7.1, () => {
    t.onStomp = null;
    t.faceMood = 'happy';
    t.do('yeah', 2.4);
    say(t, '덤벼!! 덤벼 보라고!!', 2.2, true);
    say(b, '으... 으어...', 2.4);
    npcs.slice(0, 3).forEach((q, i) => later(0.8 + i * 0.4, () => say(q, pick(['사장님 납작해졌다...', 'KO다 KO!!', '119 불러야 돼?']), 1.6)));
  });
  later(9.0, () => say(server, '자기야!! 정신 차려!! 흐엉', 2.4, true));
  later(11.4, () => {
    server.targetYaw = Math.atan2(t.pos.x - server.pos.x, t.pos.z - server.pos.z);
    if (!server.action) server.do('humph');
    say(server, '손님 너무해요!! 흥!!', 2);
  });
  // 일어나서 삐진다
  later(13.6, () => {
    knockout = null;
    b.setKnocked(false);
    b.flinch = 0;
    // 삐짐 대사보다 이 대사가 보이도록 먼저 기분을 바꾼다
    setBossMood(0);
    b.faceMood = 'pout';
    say(b, '...오늘 장사 끝이에요. 흥.', 2.6, true);
    t.faceMood = null;
    if (t === me) {
      me.locked = false;
      toast('사장님을 눕혀서 밟았어요! 사장님이 삐져서 주문을 안 받아요');
    }
  });
  later(14.8, () => {
    if (K && kick === K) walkBossHome(K);
  });
}

// 쓰러진 사장님 머리 위로 별이 돈다
function knockoutUpdate(dt) {
  const O = knockout;
  if (!O) return;
  O.spark -= dt;
  if (O.spark <= 0) {
    O.spark = 0.45;
    W.sparkle(bartender.headWorld(new THREE.Vector3()).add(new THREE.Vector3(Math.cos(simT * 4) * 0.3, 0.25, Math.sin(simT * 4) * 0.3)));
  }
}

// 풍순이가 그 사람 옆으로 달려온다. 서빙 중이면 멀리서 말만
function pungsunRush(near, shout, line) {
  later(0.4, () => say(server, shout, 1.6, true));
  if (server.job || server.jobs.length) {
    later(2.4, () => say(server, line, 2.2, true));
    return;
  }
  roam = null;
  date = null;
  server.action = null;
  server.chatTable = null;
  server.frozenUntil = simT + 15;
  server.faceMood = 'sad';
  const spot = { x: near.pos.x - 0.9, z: near.pos.z + 0.5 };
  pushOut(spot, W.obstacles);
  spot.x = THREE.MathUtils.clamp(spot.x, ME_BOUNDS.x0, ME_BOUNDS.x1);
  spot.z = THREE.MathUtils.clamp(spot.z, ME_BOUNDS.z0, ME_BOUNDS.z1);
  server.speed = 3.6;
  server.walkTo(planPath(server.pos, spot, W.obstacles));
  const arrive = Math.min(3.5, Math.hypot(server.pos.x - spot.x, server.pos.z - spot.z) / 3.0 + 0.4);
  later(Math.max(2.4, arrive), () => {
    server.speed = 2.2;
    server.targetYaw = Math.atan2(near.pos.x - server.pos.x, near.pos.z - server.pos.z);
    if (!server.action && server.state === 'stand') server.do('hurt');
    say(server, line, 2.2, true);
  });
  later(14, () => {
    if (server.faceMood === 'sad') server.faceMood = null;
    if (!server.job && !server.jobs.length) server.walkTo(planPath(server.pos, SERVER_HOME, W.obstacles));
  });
}

// 풍순이가 사장님과 손님 사이로 달려와 말린다. 서빙 중이면 멀리서 말만
function pungsunMediate(t, ok) {
  const line = ok ? '자기야~ 참아~ 손님이 술이 좀 되셨나 봐~ 호호' : '자기야~ 한 번만 더 참...';
  if (server.job || server.jobs.length) {
    later(2.6, () => say(server, line, 2.4));
    return;
  }
  roam = null;
  date = null;
  server.action = null;
  server.chatTable = null;
  server.frozenUntil = simT + 10;
  const spot = { x: (t.pos.x + bartender.pos.x) / 2 + 0.5, z: (t.pos.z + bartender.pos.z) / 2 + 0.3 };
  pushOut(spot, W.obstacles);
  spot.x = THREE.MathUtils.clamp(spot.x, ME_BOUNDS.x0, ME_BOUNDS.x1);
  spot.z = THREE.MathUtils.clamp(spot.z, ME_BOUNDS.z0, ME_BOUNDS.z1);
  server.speed = 3.6;
  server.walkTo(planPath(server.pos, spot, W.obstacles));
  later(1.2, () => say(server, '자기야 잠깐만!!', 1.4, true));
  const arrive = Math.min(3.5, Math.hypot(server.pos.x - spot.x, server.pos.z - spot.z) / 3.0 + 0.4);
  later(Math.max(2.6, arrive), () => {
    server.speed = 2.2;
    server.targetYaw = Math.atan2(bartender.pos.x - server.pos.x, bartender.pos.z - server.pos.z);
    if (!server.action && server.state === 'stand') server.do('aegyo');
    say(server, line, 2.4);
    if (ok) hearts(server);
  });
  later(9, () => !server.job && !server.jobs.length && server.walkTo(planPath(server.pos, SERVER_HOME, W.obstacles)));
}

function startRetort() {
  const i = (Math.random() * RETORT.length) | 0;
  const j = (Math.random() * EXIT_SHOUT.length) | 0;
  send('retort', { i, j });
  runRetort(me, i, j);
}

function runRetort(t, i, j) {
  if (!people.includes(t)) return;
  const K = kick && kick.target === t ? kick : null;
  if (K) {
    K.retorted = true;
    K.holdUntil = simT + 3.6;
  }
  const b = bartender;
  t.targetYaw = Math.atan2(b.pos.x - t.pos.x, b.pos.z - t.pos.z);
  t.faceMood = 'angry';
  t.do('tantrum', 1.5);
  say(t, RETORT[i][0], 2.4, true);
  sound.bang();
  // 말대꾸할수록 사장님 짜증이 오른다
  later(0.6, () => setBossMood(boss.mood - 10));
  later(1.5, () => {
    b.faceMood = 'fury';
    say(b, RETORT[i][1], 2.2, true);
    if (b.state === 'stand') b.do('stop', 1.8);
  });
  later(3.0, () => kickOut(t, j));
}

function kickOut(t, j = 0) {
  if (!people.includes(t)) return;
  // 누가 쫓겨나든 모든 화면에서 똑같이 나간다. 친구 위치는 접속 신호로 다시 맞춰진다
  t.action = null;
  t.faceMood = 'pout';
  t.exitShout = j;
  t.walkTo(planPath(t.seat ? seatFront(t.seat) : t.pos, EXIT, W.obstacles));
  t.kickedOut = true;
  if (t === me) {
    stats.kick++;
    return;
  }
  npcs
    .filter((q) => q.pos.distanceTo(t.pos) < 5)
    .slice(0, 3)
    .forEach((q, k) =>
      later(1.0 + k * 0.4, () => {
        say(q, pick(BYE), 1.8);
        if (!q.action) q.do('laugh');
      })
    );
}

// 문 밖에 도착하면 가게를 돌아보며 한마디 던지고, 사장님이 받아친다
function exitShout(t) {
  const [line, reply] = EXIT_SHOUT[t.exitShout || 0];
  t.kickedOut = false;
  t.targetYaw = Math.PI;
  t.faceMood = 'angry';
  t.do('humph');
  say(t, line, 2.4, true);
  later(0.5, () => setBossMood(boss.mood - 5));
  later(1.4, () => say(bartender, reply, 2));
  later(2.6, () => {
    if (!t.kickedOut) t.faceMood = null;
  });
  // 방장이 내보낸 사람은 문 밖에서 사라진다
  if (t.banned)
    later(3, () => {
      if (t === me) return showBanned();
      bannedIds.add(t.netId);
      removePeer(t.netId);
    });
}

// 의자에서 일어난 자리. walkTo 가 일으켜 세우기 전에 길을 계산하려고 쓴다
function seatFront(s) {
  return { x: s.x - Math.sin(s.yaw) * 0.35, z: s.z - Math.cos(s.yaw) * 0.35 };
}

function meUpdate() {
  // 안전장치. 진상 뒤에 사장님 일이 하나도 없으면 다시 부른다
  if (me.locked && !me.kickedOut && !brawl && !tennisOn && !kickPendingFor(me) && simT - (me.lockedAt || 0) > 3) requestKick(me);
  if (me.kickedOut && me.state === 'stand') {
    me.locked = false;
    exitShout(me);
    later(1.5, () => toast('쫓겨났어요... 빈 의자를 누르면 다시 들어갈 수 있어요'));
  }
  // 다른 사람이 쫓겨나 밖에 도착해도 똑같이 한마디 한다
  for (const r of peers.values()) {
    if (r.p.kickedOut && r.p.state === 'stand') exitShout(r.p);
  }
}

// 화장실. 소변, 대변, 토하기. 칸에 들어가 볼일을 보고 나오면 사장님 짜증이 오른다
// 같이 놀 때는 시작만 wc 로 알리고, 나머지 장면은 모든 화면에서 똑같이 흘러간다
const WC = {
  pee: { name: '소변', dur: 4 },
  poop: { name: '대변', dur: 7 },
  vomit: { name: '토하기', dur: 4.6 },
};
const SMELL = ['윽 무슨 냄새야', '아 누구야...', '코 막혀...', '환기 좀 해요!'];

function runToilet(p, kind) {
  if (p.isMe) {
    me.wcSeat = me.seat;
    stats.wc++;
    // 화장실로 가면 속 안 좋은 건 넘어간다
    endNausea();
  }
  p.wc = { kind, phase: 'go' };
  p.walkTo(planPath(p.seat ? seatFront(p.seat) : p.pos, W.wc.front, W.obstacles));
}

function wcUpdate() {
  const c = W.wc;
  for (const p of people) {
    const w = p.wc;
    if (!w) continue;
    if (w.phase === 'go' && p.state === 'stand') {
      // 누가 안에 있으면 앞에서 기다린다
      if (c.user && c.user !== p) continue;
      c.user = p;
      c.setBusy(true);
      c.openTarget = 1;
      p.noClip = true;
      p.targetYaw = -Math.PI / 2;
      w.phase = 'opening';
      w.until = simT + 0.35;
    } else if (w.phase === 'opening' && simT >= w.until) {
      p.walkTo([{ ...c.inside }]);
      w.phase = 'enter';
    } else if (w.phase === 'enter' && p.state === 'stand') {
      c.openTarget = 0;
      p.root.visible = false;
      w.phase = 'inside';
      w.until = simT + WC[w.kind].dur;
      insideScene(p, w.kind);
    } else if (w.phase === 'inside' && simT >= w.until) {
      sound.flush();
      c.openTarget = 1;
      p.root.visible = true;
      w.phase = 'leaving';
      w.until = simT + 0.5;
    } else if (w.phase === 'leaving' && simT >= w.until) {
      p.walkTo([{ ...c.front }]);
      w.phase = 'exit';
    } else if (w.phase === 'exit' && p.state === 'stand') {
      c.openTarget = 0;
      c.user = null;
      c.setBusy(false);
      p.noClip = false;
      p.wc = null;
      afterToilet(p, w.kind);
    }
  }
}

function insideScene(p, kind) {
  const c = W.wc;
  const nearNpcs = () => npcs.filter((q) => q.pos.distanceTo(new THREE.Vector3(c.front.x, 0, c.front.z)) < 7).slice(0, 3);
  if (kind === 'pee') {
    say(p, '쉬이이~', 2.6);
    sound.pee(3.2);
  } else if (kind === 'poop') {
    say(p, '끄으응...', 1.8);
    sound.strain();
    c.rattle = 1.2;
    later(1.9, () => {
      say(p, '뿌지직!!', 1.8, true);
      sound.plop();
      c.rattle = 0.6;
      W.stink(c.top, 14);
    });
    later(3.4, () => nearNpcs().forEach((q, i) => later(i * 0.4, () => say(q, pick(SMELL), 1.8))));
    later(4.2, () => say(server, '어머~ 이게 무슨 냄새야~', 2));
    later(5.2, () => say(p, '휴우~ 살 것 같다', 2));
  } else if (kind === 'vomit') {
    say(p, '우웨에엑!!', 1.8, true);
    sound.gag();
    c.rattle = 0.8;
    later(1.7, () => {
      say(p, '우웩...', 1.4);
      sound.gag();
      c.rattle = 0.6;
    });
    later(3.2, () => say(p, '...이제 좀 낫다', 1.8));
  }
}

function afterToilet(p, kind) {
  if (kind === 'pee') {
    setBossMood(boss.mood - 12);
    bossGrumble(p, '손님... 조준 좀 하세요. 하아.', 'annoyed');
    later(1.6, () => say(server, '어머~ 바닥이 흥건하네~ 호호', 2));
  } else if (kind === 'poop') {
    setBossMood(boss.mood - 20);
    bossGrumble(p, '누가 화장실 막았어요?! 하...', 'serious', 'warn', true);
  } else if (kind === 'vomit') {
    // 토하고 나면 술이 좀 깬다
    p.drinks = Math.max(0, p.drinks - 4);
    if (p.isMe) updateMeter();
    setBossMood(boss.mood - 25);
    bossGrumble(p, '아 진짜!! 화장실에 토하면 어떡해요!', 'serious', 'warn', true);
    later(1.6, () => say(server, '어머머~ 이거 풍순이가 치워야 돼? 흥', 2));
  }
  if (p.isMe) {
    // 앉았던 자리가 비어 있으면 돌아간다
    const s = me.wcSeat;
    me.wcSeat = null;
    if (s && !s.occupant) later(0.8, () => !me.wc && !me.locked && me.state === 'stand' && goTo({ x: s.x, z: s.z }, s));
  } else if (p.pendingGo) {
    const d = p.pendingGo;
    p.pendingGo = null;
    walkPeer(p, { x: d.x, z: d.z }, seatFromKey(d.s));
  }
}

// 취기
const meter = $('#meterFill');
function updateMeter() {
  meter.style.width = Math.min(100, (me.drinks / 8) * 100) + '%';
  $('#meterNum').textContent = `${me.drinks}잔`;
}
setInterval(() => {
  if (me.drinks > 0) {
    me.drinks--;
    updateMeter();
  }
}, 30000);

// 버튼
// 쫓겨나는 동안에는 아무것도 못 한다
function blocked() {
  if (me.wc) {
    toast('화장실에 있어요...');
    return true;
  }
  if (me.locked) {
    toast(me.kickedOut ? '쫓겨나는 중이에요...' : '사장님이 오고 있어요...');
    return true;
  }
  return false;
}
function needSeat() {
  if (!me.seat) {
    toast('빈 의자를 눌러 먼저 앉아 주세요');
    return true;
  }
  return false;
}
$('#bCheers').onclick = () => {
  if (blocked() || me.action) return;
  send('act', { a: 'cheers' });
  if (me.seat && seated(me.seat.table).length > 1) {
    tableCheers(me.seat.table, me);
  } else {
    me.do('cheers');
    say(me, '짠!', 1.4);
    later(0.62, () => {
      sound.clink(1);
      W.sparkle(me.headWorld(new THREE.Vector3()));
    });
    if (!me.seat) toast('일행이 있는 테이블에 앉으면 다 같이 건배해요');
  }
};
$('#bShot').onclick = () => {
  if (blocked() || me.action) return;
  if (me.drinks >= MAX_DRINKS) {
    meSay('오늘은 물만 마실래...', 2);
    toast('더는 못 마셔요. 잠깐 쉬면 줄어들어요');
    return;
  }
  me.do('oneshot');
  send('act', { a: 'oneshot' });
  later(0.55, () => sound.gulp());
};
$('#bAnju').onclick = () => {
  if (blocked() || me.action || needSeat()) return;
  if (!me.seat.table.dishes.length) {
    toast('안주가 없어요. 주문하거나 가운데 어묵탕을 눌러 보세요');
    return;
  }
  me.do('anju');
  send('act', { a: 'anju' });
};
const chatBox = $('#chat');
const chatInput = $('#chatInput');
$('#bTalk').onclick = () => {
  if (blocked()) return;
  setFold(false);
  chatInput.focus();
};
function setFold(fold) {
  chatBox.classList.toggle('fold', fold);
  setTimeout(updateViewOffset, 0);
  $('#chatFold').textContent = fold ? '+' : '−';
}
$('#chatFold').onclick = () => setFold(!chatBox.classList.contains('fold'));
function sendChat(e) {
  e && e.preventDefault();
  const text = chatInput.value.trim().slice(0, 40);
  chatInput.value = '';
  if (!text) return;
  // 업다운 내 차례에는 수다방에 쓴 숫자를 답으로 받는다
  if (myTurn && myTurn.kind === 'updown' && /^\d{1,2}$/.test(text)) return submitTurn(text);
  if (blocked()) return;
  stats.chat++;
  me.do('talk');
  send('act', { a: 'talk' });
  meSay(text, 3);
  if (me.seat) {
    const mates = seated(me.seat.table).filter((q) => q !== me && !q.remote);
    mates.forEach((q, i) =>
      later(1.3 + i * 0.7, () => {
        q.do(Math.random() < 0.5 ? 'laugh' : 'talk');
        say(q, pick(REPLY), 2);
      })
    );
  }
}
$('#chatForm').addEventListener('submit', sendChat);

const menuBox = $('#menu');
$('#bOrder').onclick = () => {
  if (blocked() || needSeat()) return;
  menuBox.classList.add('show');
};
$('#menuClose').onclick = () => menuBox.classList.remove('show');
menuBox.querySelectorAll('[data-kind]').forEach((b) => {
  b.onclick = () => {
    menuBox.classList.remove('show');
    if (!me.seat || me.locked) return;
    if (boss.sulky) {
      toast('사장님이 삐져서 주문을 안 받아요');
      say(bartender, pick(REFUSE), 2.2);
      if (!bossBusy() && !bartender.action) bartender.do('humph');
      sound.humph();
      return;
    }
    const kind = b.dataset.kind;
    send('order', { tid: me.seat.table.id, kind });
    const ok = acceptOrder(me.seat.table, kind, me);
    toast(ok ? `${b.dataset.name} 주문했어요` : '사장님이 오뎅 리필을 막았어요...');
    if (ok && kind !== 'refill') stats.order++;
  };
});

// 주문 받기. 내 주문이든 친구 주문이든 똑같이 서빙하고 환호한다
// 받았으면 true. 오뎅 리필이 너무 잦으면 false
function acceptOrder(T, kind, who) {
  if (kind === 'refill') {
    const ok = acceptRefill(T, who);
    if (ok) sulkyOrder();
    return ok;
  }
  sulkyOrder();
  server.jobs.push({ table: T, kind });
  T.bill.items[kind] = (T.bill.items[kind] || 0) + 1;
  sound.bell();
  if (!bossBusy()) {
    say(bartender, '네~ 주문 받았습니다!', 2);
    bartender.do('wave');
    later(1.2, () => startParty(T));
  }
  return true;
}

// 오뎅 리필은 공짜. 한 테이블이 3분 안에 세 번째로 시키면 사장님이 나와서 "그만 드시죠."
const REFILL_LIMIT = 2;
const REFILL_WINDOW = 180;
function acceptRefill(T, who) {
  T.refills = (T.refills || []).filter((t) => simT - t < REFILL_WINDOW);
  sound.bell();
  if (T.refills.length >= REFILL_LIMIT) {
    T.refills = [];
    say(bartender, '오뎅 리필이요? ...또요?', 1.8);
    if (who && people.includes(who)) later(1.0, () => stopEating(who));
    return false;
  }
  T.refills.push(simT);
  server.jobs.push({ table: T, kind: 'refill' });
  T.bill.items.refill = (T.bill.items.refill || 0) + 1;
  if (!bossBusy()) {
    say(bartender, '오뎅 리필 들어갑니다~', 2);
    if (!bartender.action && bartender.state === 'stand') bartender.do('wave');
  }
  return true;
}

// 가운데 통에 오뎅을 쏟아 붓는다
function refillTrough(T) {
  W.sparkle(new THREE.Vector3(T.x, TABLE_H + 0.3, T.z));
  if (T.pot) T.pot.boost = 2.5;
  seated(T)
    .filter((q) => !q.isMe && !q.remote)
    .slice(0, 2)
    .forEach((q, i) => later(0.6 + i * 0.4, () => say(q, pick(['오~ 리필이다!', '국물 끝내준다', '풍순씨 최고!']), 1.6)));
}

const soundBtn = $('#bSound');
soundBtn.onclick = () => {
  sound.start();
  sound.setOn(!sound.on);
  soundBtn.classList.toggle('off', !sound.on);
};
const wcBox = $('#wcMenu');
$('#bWc').onclick = () => {
  if (blocked()) return;
  if (nausea) return goToilet('vomit');
  wcBox.classList.add('show');
};
$('#wcClose').onclick = () => wcBox.classList.remove('show');
wcBox.querySelectorAll('[data-wc]').forEach((b) => {
  b.onclick = () => {
    wcBox.classList.remove('show');
    if (blocked()) return;
    goToilet(b.dataset.wc);
  };
});

function goToilet(kind) {
  const u = W.wc.user;
  if (u && u !== me) {
    sound.knock();
    toast(`${u.remote ? u.name + '님이 ' : '누가 '}화장실 쓰는 중이에요`);
    return;
  }
  send('wc', { k: kind });
  runToilet(me, kind);
}

$('#bJinsang').onclick = () => {
  if (blocked()) return;
  $('#jinSheet').classList.add('show');
};
$('#jinClose').onclick = () => $('#jinSheet').classList.remove('show');
document.querySelectorAll('[data-jin]').forEach(
  (b) =>
    (b.onclick = () => {
      $('#jinSheet').classList.remove('show');
      // 건배 같은 다른 동작 중이어도 진상은 끊고 들어간다. 진상끼리만 겹치지 않게
      if (blocked()) return;
      if (me.action && ['tantrum', 'slap'].includes(me.action.type)) return toast('하던 동작이 끝나면 다시 눌러 주세요');
      if (b.dataset.jin === 'rant') startJinsang();
      else if (b.dataset.jin === 'slap') startSlap();
      else if (b.dataset.jin === 'tease') startTease();
      else startBeat();
    })
);
$('#bCam').onclick = () => {
  camReset = true;
};
let camReset = false;

$('#enter').onclick = () => {
  if (MULTI) {
    const name = $('#nameInput').value.trim().slice(0, 8);
    if (!name) {
      $('#nameInput').focus();
      toast('이름을 적어 주세요');
      return;
    }
    myName = name;
    try {
      localStorage.setItem('pungsok-name', name);
    } catch (e) {}
    const pw = $('#pwInput').value.trim();
    roomPwHash = pw ? hashText(pw) : '';
    myPw = pw;
    startNet();
    // 한참 아무도 없으면 방 코드나 비밀번호를 확인하라고 알려 준다
    setTimeout(() => {
      if (!peers.size) logSystem('아직 아무도 없어요. 친구가 안 보이면 방 코드와 비밀번호가 같은지 확인해 주세요');
    }, 15000);
  }
  sound.start();
  $('#intro').classList.add('hide');
  $('#chat').hidden = false;
  updateViewOffset();
  camReset = true;
  setTimeout(() => toast('빈 의자를 누르면 앉고, 바닥을 누르면 걸어가요'), 600);
};

// 누르기. 끌어서 돌린 것은 무시한다
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  // 처리 시각이 아니라 이벤트가 생긴 시각으로 잰다. 느린 휴대폰에서 짧게 누른 것도 길게 누른 것으로 보던 문제
  down = { x: e.clientX, y: e.clientY, t: e.timeStamp };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = e.timeStamp - down.t < 500;
  down = null;
  if (moved > 8 || !quick) return;
  sound.start();
  if (tennisOn) return courtSwing();
  if (blocked()) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...W.pickables, W.floor], false);
  for (const h of hits) {
    const o = h.object;
    if (o.userData.person) {
      const p = o.userData.person;
      if (p === me) continue;
      if (p.remote) {
        toast(`${p.name}님이에요`);
      } else if (p === bartender) {
        pokeBoss();
      } else if (p === heedong) {
        say(p, pick(HD_TAP), 2);
        if (!p.action) p.do('humph');
      } else if (p === server && pSulk) {
        sorryPungsun();
      } else if (p.staff) {
        say(p, pick(PUNGSUN_TAP), 2);
        if (!p.action && p.state === 'stand') p.do('wink');
        hearts(p);
        if (!p.action && p.state === 'stand') p.do('wave');
      } else {
        if (!p.action) p.do('wave');
        const same = me.seat && p.seat && me.seat.table === p.seat.table;
        say(p, same ? '짠 할까요?' : pick(GREET), 2);
      }
      return;
    }
    if (o.userData.eomukTable) {
      const T = o.userData.eomukTable;
      if (me.seat && me.seat.table === T) return goEomuk();
      if (me.seat) return toast('우리 테이블 어묵탕에서 드세요~');
      // 안 앉았으면 그 테이블 빈자리로 간다
      const s = T.seats.find((q) => !q.occupant);
      if (!s) return toast('그 테이블은 자리가 없어요');
      goTo({ x: s.x, z: s.z }, s);
      toast('앉아서 가운데 어묵탕을 누르면 떠 먹어요');
      return;
    }
    if (o.userData.seat) {
      const s = o.userData.seat;
      if (s.occupant === me) return;
      if (s.occupant) {
        say(s.occupant, '여기 자리 있어요~', 1.8);
        return;
      }
      goTo({ x: s.x, z: s.z }, s);
      return;
    }
    if (o.userData.floor) {
      const p = h.point;
      const b = W.bounds;
      const x = THREE.MathUtils.clamp(p.x, b.x0, b.x1);
      const z = THREE.MathUtils.clamp(p.z, b.z0, b.z1);
      goTo({ x, z });
      ripple(x, z);
      return;
    }
  }
});

function goTo(target, seat) {
  if (me.seat) me.standUp();
  const path = planPath(me.pos, target, W.obstacles);
  if (seat) path[path.length - 1].seat = seat;
  me.walkTo(path);
  send('go', { x: target.x, z: target.z, s: seatKey(seat) });
}

// 누른 자리 표시
const ringGeo = new THREE.RingGeometry(0.16, 0.2, 32);
const rings = [];
function ripple(x, z) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd29a).multiplyScalar(1.6), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  scene.add(m);
  rings.push({ m, t: 0 });
}

// 화면 크기
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  // 세로 화면은 조금 멀리서 본다
  camera.fov = w < h ? 52 : 40;
  viewOffY = -1;
  updateViewOffset();
  W.setPixelScale(((h * DPR) / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 0.01);
}

// 위쪽 상태 표시와 아래쪽 버튼, 수다방에 가리지 않는 가운데에 화면 중심이 오도록 그림을 올린다
let viewOffY = -1;
let visTop = 0;
let visBottom = 9999;
function updateViewOffset() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  if (!w || !h) return;
  const topB = $('#brand').getBoundingClientRect().bottom;
  let bottomT = $('#actions').getBoundingClientRect().top;
  const chat = $('#chat');
  if (!chat.hidden) {
    const r = chat.getBoundingClientRect();
    // 수다방이 화면 가운데를 가로질러 있을 때만(좁은 화면) 가리는 것으로 본다
    if (r.width > w * 0.5 && r.height) bottomT = Math.min(bottomT, r.top);
  }
  visTop = topB;
  visBottom = bottomT;
  const off = Math.round(THREE.MathUtils.clamp((h - bottomT - topB) / 2, 0, h * 0.3));
  if (off === viewOffY) return;
  viewOffY = off;
  if (off) camera.setViewOffset(w, h, 0, off, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
// 휴대폰은 주소창이나 키보드가 나타나고 사라질 때 크기가 바뀐다
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// 휴대폰에서 화면이 확대되거나 밀려서 엉뚱한 곳을 보게 되는 것을 막는다
const TOUCH_UI = window.matchMedia('(pointer: coarse)').matches;
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 60));

// 손가락으로 돌린 시점은 잠시 뒤 원래대로 돌아온다. 내 캐릭터가 화면 밖으로 나가도 다시 맞춘다
let camTouching = false;
let camTouchedAt = 0;
controls.addEventListener('start', () => {
  camTouching = true;
  camReset = false;
});
controls.addEventListener('end', () => {
  camTouching = false;
  camTouchedAt = performance.now();
});

// 매 프레임
const clock = new THREE.Clock();
const v3 = new THREE.Vector3();
const lastTarget = controls.target.clone();
const camGoal = new THREE.Vector3();

// ---------- 같이 놀기 ----------
// 한 방(채널)에 모인 사람끼리 짧은 메시지를 주고받는다. 각자 자기 캐릭터만 책임지고,
// 직원(사장님, 풍순이)의 평소 행동은 가장 먼저 들어온 방장 한 명이 정해서 알린다
// 메시지: hi(2초마다 내 상태), bye, go(이동), say(말), act(동작), jinsang, order, poke(사장님 누름),
//         staff(직원 동작), roamGo/roamFlirt/roamHome(풍순이), boss(사장님 기분), snap(늦게 온 사람에게 현재 상태)
let net = null;
let myName = '';
let joinedAt = 0;
let netOk = false;
let snapDone = false;
let hbCount = 0;
const peers = new Map();
// 무료 요금제의 초당 메시지 한도를 아끼려고 접속 신호는 2초마다 보낸다
const HEARTBEAT_MS = 2000;
const PEER_TIMEOUT = 9000;
const ROOM_HASH = MULTI ? roomFromHash() : { code: '', pw: '' };
const ROOM = ROOM_HASH.code;
// 비밀번호가 있으면 채널 이름에 비밀번호 해시를 붙인다. 비밀번호가 다르면 아예 다른 방이 된다
let roomPwHash = '';
const channelName = () => ROOM + (roomPwHash ? '-' + roomPwHash : '');

function send(t, d) {
  if (net) net.send({ t, f: MY_ID, d });
}

// 내 말은 친구들에게도 보낸다
function meSay(text, dur, big) {
  say(me, text, dur, big);
  send('say', { t: text, b: big });
}

function seatKey(seat) {
  return seat ? seat.table.id + '-' + seat.table.seats.indexOf(seat) : null;
}
function seatFromKey(k) {
  if (!k) return null;
  const [t, i] = k.split('-').map(Number);
  return (W.tables[t] && W.tables[t].seats[i]) || null;
}

// 방 코드는 주소 # 뒤에 둔다. 비밀번호를 같이 넣은 초대 링크는 #방코드~비밀번호. 없으면 새로 만든다
function roomFromHash() {
  const raw = location.hash.slice(1);
  const cut = raw.indexOf('~');
  let c = (cut < 0 ? raw : raw.slice(0, cut)).toLowerCase();
  let pw = '';
  try {
    pw = cut < 0 ? '' : decodeURIComponent(raw.slice(cut + 1));
  } catch (e) {}
  if (!/^[a-z0-9-]{3,24}$/.test(c)) {
    c = Math.random().toString(36).slice(2, 8);
    history.replaceState(null, '', location.pathname + location.search + '#' + c);
  }
  return { code: c, pw };
}

function hashText(t) {
  let h = 2166136261;
  for (const ch of 'pungsok:' + t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}

// 방장. 가장 먼저 들어온 사람(같으면 아이디 순)
function isHost() {
  if (!MULTI) return true;
  for (const r of peers.values()) {
    if (r.joinedAt < joinedAt || (r.joinedAt === joinedAt && r.id < MY_ID)) return false;
  }
  return true;
}

function hostId() {
  let best = { id: MY_ID, j: joinedAt };
  for (const r of peers.values()) if (r.joinedAt < best.j || (r.joinedAt === best.j && r.id < best.id)) best = { id: r.id, j: r.joinedAt };
  return best.id;
}

function updateCount() {
  let t = `손님 ${(MULTI ? peers.size : npcs.length + FUNG.length) + 1}명`;
  if (MULTI && peers.size) t += isHost() ? ' · 내가 방장' : ` · 방장 ${peers.get(hostId()) ? peers.get(hostId()).p.name : ''}`;
  $('#count').textContent = t;
}

function logSystem(text) {
  pushRoom(rooms.all, { who: '', role: ' sys', text }, viewRoom === 'all');
}

function startNet() {
  joinedAt = Date.now();
  connectNet();
  setInterval(heartbeat, HEARTBEAT_MS);
  window.addEventListener('pagehide', () => send('bye'));
}

function connectNet() {
  net = createNet({ url: NET_URL, key: NET_KEY, room: channelName(), local: LOCAL_NET, onMessage: onNet, onStatus: onNetStatus });
}

// 방 비밀번호가 바뀌면 모두 새 채널로 옮긴다
function switchChannel(h) {
  if (h === roomPwHash) return;
  if (net) net.close();
  roomPwHash = h;
  connectNet();
  heartbeat();
}

function onNetStatus(st) {
  if (st === 'SUBSCRIBED') {
    if (!netOk) logSystem(`${ROOM} 방에 들어왔어요. 초대 링크로 친구를 불러 보세요`);
    netOk = true;
    heartbeat();
  } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
    toast(netOk ? '연결이 끊겼어요. 다시 연결하는 중이에요...' : '친구들과 연결이 안 돼요. 잠시 뒤 새로고침해 주세요');
    netOk = false;
  }
}

function heartbeat() {
  send('hi', { n: myName, j: joinedAt, x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2), s: seatKey(me.seat), dr: me.drinks, lk: encodeLook(myLookIdx), st: packStats(stats) });
  // 방장은 6초마다 사장님 기분을 맞춰 준다
  if (++hbCount % 3 === 0 && isHost()) send('boss', { m: Math.round(boss.mood), s: boss.sulky });
  // 테니스 복식 방장은 방 상태를 계속 알린다
  tlBroadcast();
}

function ensurePeer(id, d) {
  let r = peers.get(id);
  if (!r) {
    const lk = decodeLook(d.lk) ? d.lk : encodeLook(defaultLookIdx(id));
    const p = addPerson({ ...lookFromIdx(decodeLook(lk)), name: (d.n || '손님').slice(0, 8) });
    p.lk = lk;
    p.stats = unpackStats(d.st);
    p.remote = true;
    p.netId = id;
    p.onOneshot = onOneshot;
    p.onChew = (q) => me.seat && q.seat && q.seat.table === me.seat.table && sound.crunch();
    addTag(p, p.name, 'peerTag');
    // 처음 보면 알려 준 자리에 바로 둔다
    const seat = seatFromKey(d.s);
    if (seat && !seat.occupant) p.sitAt(seat);
    else p.root.position.set(d.x ?? 0, 0, d.z ?? 6.2);
    r = { id, p, joinedAt: d.j || Date.now() };
    peers.set(id, r);
    logSystem(`${p.name}님이 들어왔어요`);
    updateCount();
    if (isHost()) sendSnapshot(id);
  }
  r.last = performance.now();
  return r;
}

function removePeer(id) {
  const r = peers.get(id);
  if (!r) return;
  const p = r.p;
  if (p.seat) {
    p.seat.occupant = null;
    p.seat = null;
  }
  scene.remove(p.root);
  people.splice(people.indexOf(p), 1);
  W.pickables.splice(W.pickables.indexOf(p.pick), 1);
  if (p.bubbleEl) p.bubbleEl.remove();
  if (p.tagEl) p.tagEl.remove();
  peers.delete(id);
  tnPeerGone(id);
  logSystem(`${p.name}님이 나갔어요`);
  updateCount();
}

// 접속 신호가 끊긴 사람은 내보낸다
function dropSilentPeers() {
  const now = performance.now();
  for (const [id, r] of peers) if (now - r.last > PEER_TIMEOUT) removePeer(id);
}

function walkPeer(p, target, seat) {
  const from = p.seat ? seatFront(p.seat) : p.pos;
  const path = planPath(from, target, W.obstacles);
  if (seat && (!seat.occupant || seat.occupant === p)) path[path.length - 1].seat = seat;
  p.walkTo(path);
}

// 2초마다 오는 상태로 자리와 위치를 맞춘다. 이동 메시지를 놓쳤을 때를 위한 보정
function applyHi(r, d) {
  const p = r.p;
  if (typeof d.dr === 'number') p.drinks = d.dr;
  if (d.st) p.stats = unpackStats(d.st);
  if (d.lk && d.lk !== p.lk && decodeLook(d.lk)) {
    p.lk = d.lk;
    p.setLook(lookFromIdx(decodeLook(d.lk)));
  }
  if (p.state === 'hop' || p.kickedOut || p.wc || p.tennis || (brawl && brawl.p === p)) return;
  const seat = seatFromKey(d.s);
  if (seat) {
    if (p.seat === seat) return;
    const last = p.path[p.path.length - 1];
    if (p.state === 'walk' && last && last.seat === seat) return;
    if (seat.occupant && seat.occupant !== p) return;
    if (p.pos.distanceTo(new THREE.Vector3(seat.x, 0, seat.z)) > 6) {
      if (p.seat) p.standUp();
      p.sitAt(seat);
    } else walkPeer(p, { x: seat.x, z: seat.z }, seat);
    return;
  }
  if (p.state === 'walk') return;
  const dist = Math.hypot(p.pos.x - d.x, p.pos.z - d.z);
  if (!p.seat && dist < 0.8) return;
  if (dist > 8) {
    if (p.seat) {
      p.seat.occupant = null;
      p.seat = null;
      p.state = 'stand';
    }
    p.root.position.set(d.x, 0, d.z);
  } else walkPeer(p, { x: d.x, z: d.z });
}

function remoteAct(p, a) {
  if (a === 'cheers') {
    if (p.seat && seated(p.seat.table).length > 1) return tableCheers(p.seat.table, p);
    p.do('cheers');
    say(p, '짠!', 1.4);
    later(0.62, () => {
      sound.clink(1);
      W.sparkle(p.headWorld(new THREE.Vector3()));
    });
  } else if (['oneshot', 'anju', 'talk', 'wave', 'laugh'].includes(a)) {
    p.do(a);
    if (a === 'oneshot' && me.seat && p.seat && p.seat.table === me.seat.table) later(0.55, () => sound.gulp());
  }
}

function sendSnapshot(to) {
  send('snap', { to, dishes: W.tables.map((T) => T.dishes.map((x) => x.kind)), bills: W.tables.map((T) => T.bill), m: Math.round(boss.mood), s: boss.sulky });
}

function syncBoss(m, s) {
  if (s && !boss.sulky) {
    boss.mood = m;
    startSulk();
  } else if (!s && boss.sulky) {
    boss.mood = m;
    endSulk();
  } else {
    boss.mood = m;
    updateBossUI();
  }
}

function onNet(m) {
  if (!m || m.f === MY_ID) return;
  const d = m.d || {};
  if (m.t === 'bye') return removePeer(m.f);
  if (bannedIds.has(m.f)) return;
  if (m.t === 'hi') return applyHi(ensurePeer(m.f, d), d);
  if (m.t === 'tl') return onLobbyNet(d, m.f);
  if (m.t === 'td') return onDoublesNet(d, m.f);
  // 방장만 할 수 있는 것
  if (m.t === 'pw' || m.t === 'ban' || m.t === 'bossReset') {
    if (m.f !== hostId()) return;
    if (m.t === 'pw') {
      toast('방장이 방 비밀번호를 바꿨어요');
      return switchChannel(String(d.h || ''));
    }
    if (m.t === 'ban') return applyBan(d.id);
    return bossResetNow();
  }
  if (m.t === 'game') return applyGame(d);
  if (m.t === 'gameIn') return games.input(m.f, d.gid, d.v);
  // 직원 신호와 늦게 온 사람용 상태는 보낸 사람을 몰라도 받는다
  if (m.t === 'snap') {
    if (d.to !== MY_ID || snapDone) return;
    snapDone = true;
    (d.dishes || []).forEach((kinds, ti) => {
      const T = W.tables[ti];
      if (T && !T.dishes.length) kinds.forEach((k) => placeDish(W, scene, T, k));
    });
    (d.bills || []).forEach((b, ti) => {
      const T = W.tables[ti];
      if (T && b && typeof b.shots === 'number') T.bill = { items: { ...b.items }, shots: b.shots };
    });
    return syncBoss(d.m, d.s);
  }
  if (m.t === 'staff') return staffDo(d.w === 's' ? server : bartender, d.a, d.l, d.d, d.h, true);
  if (m.t === 'roamGo') return !decides() && W.tables[d.tid] && roamTo(W.tables[d.tid]);
  if (m.t === 'roamFlirt') return !decides() && roam && (roam.pending = { act: d.act, line: d.line });
  if (m.t === 'roamHome') return !decides() && roamHome();
  if (m.t === 'boss') return !isHost() && syncBoss(d.m, d.s);
  if (m.t === 'poke') return pokeBoss(true);
  if (m.t === 'order') return W.tables[d.tid] && acceptOrder(W.tables[d.tid], d.kind, peers.get(m.f) && peers.get(m.f).p);
  if (m.t === 'pay') return W.tables[d.tid] && peers.get(m.f) && applyPay(peers.get(m.f).p, W.tables[d.tid], d.mode, d.total | 0);
  // 나머지는 그 사람 캐릭터가 하는 일
  const r = peers.get(m.f);
  if (!r) return;
  const p = r.p;
  if (m.t === 'go') {
    // 화장실에서 나오는 중이면 다 나온 뒤에 간다
    if (p.wc) p.pendingGo = d;
    else if (!p.kickedOut) walkPeer(p, { x: d.x, z: d.z }, seatFromKey(d.s));
  } else if (m.t === 'look') {
    if (decodeLook(d.lk) && d.lk !== p.lk) {
      p.lk = d.lk;
      p.setLook(lookFromIdx(decodeLook(d.lk)));
    }
  } else if (m.t === 'slapGo') {
    pungsunHold(p);
  } else if (m.t === 'slap') {
    if (!p.action) p.do('slap');
    slapEffects(p, Math.min(3, Math.max(1, d.lv | 0 || 1)), d.wi | 0);
  } else if (m.t === 'beat') {
    if (!brawl) beatBoss(p);
  } else if (m.t === 'date') {
    if (!decides() && ['love', 'soothe', 'comfort'].includes(d.k)) {
      comfortDue = false;
      startDate(d.k, d.i | 0);
    }
  } else if (m.t === 'hd') {
    // 친구가 부른 것도 받는다. 방장은 자동 등장 시간을 다시 잡는다
    if (!hd) {
      if (d.call) logSystem(`${p.name}님이 희동이를 불렀어요`);
      startHd(d.ti | 0);
      if (decides()) hdT = rnd(240, 420);
    }
  } else if (m.t === 'tease') {
    teaseEffects(p, Math.min(3, Math.max(1, d.lv | 0 || 1)), d.i | 0);
  } else if (m.t === 'psorry') {
    sorryPungsun(true);
  } else if (m.t === 'woo') {
    if (!decides()) startWoo(d.i | 0);
  } else if (m.t === 'eomuk') {
    if (!p.wc && !p.kickedOut) runEomuk(p);
  } else if (m.t === 'tennis') {
    setPeerTennis(p, !!d.on);
  } else if (m.t === 'puke') {
    if (!p.kickedOut && !p.wc) runPuke(p);
  } else if (m.t === 'wc') {
    if (WC[d.k] && !p.wc && !p.kickedOut) runToilet(p, d.k);
  } else if (m.t === 'say') say(p, String(d.t).slice(0, 40), 3, !!d.b);
  else if (m.t === 'act') remoteAct(p, d.a);
  else if (m.t === 'fight') {
    if (kick && kick.target === p && kick.phase === 'stop' && !kick.retorted) runFight(p);
    else p.pendingFight = true;
  } else if (m.t === 'hold') {
    const j = Math.min(EXIT_SHOUT.length - 1, Math.max(0, d.j | 0));
    const i = Math.max(0, d.i | 0);
    if (kick && kick.target === p && kick.phase === 'stop' && !kick.retorted) runHold(p, !!d.ok, j, i);
    else p.pendingHold = { ok: !!d.ok, j };
  } else if (m.t === 'retort') {
    const i = Math.min(RETORT.length - 1, Math.max(0, d.i | 0));
    const j = Math.min(EXIT_SHOUT.length - 1, Math.max(0, d.j | 0));
    if (kick && kick.target === p && kick.phase === 'stop' && !kick.retorted) runRetort(p, i, j);
    else p.pendingRetort = { i, j };
  } else if (m.t === 'jinsang') {
    p.path = [];
    if (p.state === 'walk') p.state = 'stand';
    p.do('tantrum');
    jinsangEffects(p, Math.min(3, Math.max(1, d.lv | 0 || 3)), d.wi | 0);
  }
}

// 입장 화면. 같이 놀 때는 이름과 방 코드, 초대 링크 복사를 보여 준다
if (MULTI) {
  $('#multiBox').hidden = false;
  $('#roomCode').textContent = ROOM;
  $('#pwInput').value = ROOM_HASH.pw;
  try {
    $('#nameInput').value = localStorage.getItem('pungsok-name') || '';
  } catch (e) {}
  $('#nameInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#enter').click());
  // 방 코드가 바뀌면 그 방으로 다시 들어간다
  window.addEventListener('hashchange', () => location.reload());
}
// 초대 링크. 비밀번호를 아는 사람(방에 비밀번호를 넣고 들어온 사람, 바꾼 방장)은 비밀번호까지 넣어 준다
let myPw = '';
function inviteLink() {
  const base = location.origin + location.pathname + location.search;
  const pw = myPw || $('#pwInput').value.trim();
  return base + '#' + ROOM + (pw && (!roomPwHash || hashText(pw) === roomPwHash) ? '~' + encodeURIComponent(pw) : '');
}
async function copyInvite() {
  const link = inviteLink();
  try {
    await navigator.clipboard.writeText(link);
    toast('초대 링크를 복사했어요. 친구에게 보내 주세요');
  } catch (e) {
    showInfo('초대 링크', link);
  }
}
$('#copyLink').onclick = copyInvite;

// ---------- 속 안 좋음과 바닥에 토하기 ----------
// 8잔을 넘기면 속이 뒤집힌다. 12초 안에 화장실에 가지 않으면 바닥에 토하고, 사장님이 폭발해서 내보낸다
const NAUSEA_AT = 8;
const MAX_DRINKS = 10;
const NAUSEA_SEC = 12;
let nausea = null;

function startNausea() {
  nausea = { until: simT + NAUSEA_SEC };
  meSay('윽... 속이 안 좋아...', 2);
  $('#nausea').hidden = false;
  toast('속이 안 좋아요! 화장실 버튼을 눌러 빨리 가세요');
}

function endNausea() {
  nausea = null;
  $('#nausea').hidden = true;
}

function nauseaUpdate() {
  if (!nausea) return;
  const left = Math.max(0, nausea.until - simT);
  $('#nauseaSec').textContent = Math.ceil(left);
  if (left > 0) return;
  endNausea();
  if (me.wc || me.locked) return;
  send('puke', {});
  runPuke(me);
}

// 바닥 토사물. 한동안 남아 있다가 풍순이가 치운다
const pukeTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(${170 + Math.random() * 40},${170 + Math.random() * 30},${60 + Math.random() * 30},0.9)`;
    g.beginPath();
    g.ellipse(64 + rnd(-28, 28), 64 + rnd(-22, 22), rnd(14, 30), rnd(10, 22), Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function addPuddle(p) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: pukeTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(p.pos.x + Math.sin(p.yaw) * 0.45, 0.012, p.pos.z + Math.cos(p.yaw) * 0.45);
  scene.add(m);
  W.stink(new THREE.Vector3(m.position.x, 0.3, m.position.z), 10);
  later(30, () => say(server, '어머머~ 이거 풍순이가 치우는 거예요? 흥!', 2));
  later(32, () => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
}

function runPuke(p) {
  if (p.seat) p.standUp();
  p.path = [];
  p.state = 'stand';
  p.onPuke = (q) => {
    addPuddle(q);
    sound.gag();
    later(0.8, () => sound.gag());
  };
  p.do('puke');
  say(p, '우웨에에엑!!', 2.2, true);
  p.drinks = 3;
  if (p.isMe) {
    stats.puke++;
    me.locked = true;
    me.lockedAt = simT;
    updateMeter();
  }
  npcs
    .filter((q) => q.pos.distanceTo(p.pos) < 5)
    .slice(0, 4)
    .forEach((q, i) => later(0.6 + i * 0.35, () => say(q, pick(['으악!!', '아 진짜 더러워!', '헐 토했어...', '윽 냄새...']), 1.8)));
  later(1.0, () => say(bartender, '...저기요?!', 1.2));
  later(1.6, () => bossRage(p));
  later(2.2, () => say(server, '꺄악~ 내 구두!!', 1.8));
  later(2.4, () => setBossMood(boss.mood - 35));
  later(3.0, () => requestKick(p));
}

// ---------- 계산 ----------
function billLines(T) {
  const rows = [];
  for (const m of MENU) {
    const q = T.bill.items[m.kind] || 0;
    if (q) rows.push({ name: m.name, qty: q, price: q * PRICE[m.kind] });
  }
  const rf = T.bill.items.refill || 0;
  if (rf) rows.push({ name: '오뎅 리필 (서비스)', qty: rf, price: 0 });
  const bottles = Math.ceil(T.bill.shots / SOJU_SHOTS);
  if (bottles) rows.push({ name: `소주 (${T.bill.shots}잔)`, qty: bottles, price: bottles * SOJU_PRICE, unit: '병' });
  return { rows, total: rows.reduce((a, r) => a + r.price, 0) };
}

const won = (n) => n.toLocaleString('ko-KR') + '원';

function openBill() {
  if (needSeat()) return;
  const T = me.seat.table;
  const { rows, total } = billLines(T);
  const n = seated(T).length;
  const list = $('#billRows');
  list.replaceChildren(
    ...rows.map((r) => {
      const li = document.createElement('div');
      li.className = 'billRow';
      li.innerHTML = '<span></span><span></span>';
      li.children[0].textContent = `${r.name} × ${r.qty}${r.unit || ''}`;
      li.children[1].textContent = won(r.price);
      return li;
    })
  );
  if (!rows.length) list.textContent = '아직 계산할 게 없어요';
  $('#billTotal').textContent = won(total);
  $('#billEach').textContent = `${n}명이면 1인 ${won(Math.ceil(total / n / 100) * 100)}`;
  $('#billDutch').disabled = $('#billFlex').disabled = !total;
  $('#billTitle').textContent = `${T.id + 1}번 테이블 계산서`;
  $('#bill').classList.add('show');
}

function payBill(mode) {
  $('#bill').classList.remove('show');
  if (!me.seat || me.locked) return;
  const T = me.seat.table;
  const { total } = billLines(T);
  if (!total) return;
  send('pay', { tid: T.id, mode, total });
  applyPay(me, T, mode, total);
}

function applyPay(p, T, mode, total) {
  T.bill = { items: {}, shots: 0 };
  const mates = seated(T).filter((q) => q !== p && autoOk(q));
  if (mode === 'flex') {
    if (p.isMe) stats.flex += total;
    if (!p.action) p.do('cheers');
    say(p, `오늘은 내가 쏜다!! (${won(total)})`, 2.6, true);
    sound.clink(4);
    W.sparkle(new THREE.Vector3(T.x, TABLE_H + 0.8, T.z));
    W.confetti(new THREE.Vector3(T.x, TABLE_H + 1.4, T.z));
    mates.forEach((q, i) =>
      later(0.6 + i * 0.3, () => {
        if (!q.action) q.do('wave');
        say(q, pick([`와아~ ${p.isMe ? '최고' : p.name + ' 최고'}!`, '잘 먹었습니다~!', '사랑해요~']), 1.8);
      })
    );
    later(1.2, () => {
      say(bartender, '감사합니다~!! 또 오세요~', 2.2);
      if (!bossBusy() && bartender.state === 'stand') bartender.do('wave');
      setBossMood(boss.mood + 25);
    });
    later(2.0, () => {
      say(server, '어머~ 멋있다~ 풍순이도 한 잔 사 줘요~', 2);
      hearts(server);
    });
  } else {
    say(p, `1/N 해요~ (1인 ${won(Math.ceil(total / Math.max(1, seated(T).length) / 100) * 100)})`, 2.4);
    mates.forEach((q, i) => later(0.6 + i * 0.3, () => say(q, pick(['오케이~', '계좌 보내~', '콜!']), 1.6)));
    later(1.2, () => {
      say(bartender, '감사합니다~', 2);
      setBossMood(boss.mood + 8);
    });
  }
}

// ---------- 술게임 ----------
const npcId = (p) => 'n' + npcs.indexOf(p);
function idOf(p) {
  if (p === me) return MY_ID;
  if (p.remote) return p.netId;
  if (p.fung != null) return 'f' + p.fung;
  return npcId(p);
}
function personById(id) {
  if (id === MY_ID) return me;
  if (id === 'mc') return server;
  if (/^n\d+$/.test(id)) return npcs[+id.slice(1)] || null;
  if (/^f\d$/.test(id)) return FUNG[+id.slice(1)] || null;
  const r = peers.get(id);
  return r ? r.p : null;
}
function nameOf(id) {
  if (id === MY_ID) return MULTI ? myName : '나';
  const p = personById(id);
  return p ? p.name || '손님' : '손님';
}

const games = createGames({
  now: () => simT,
  emit: (ev) => {
    send('game', ev);
    applyGame(ev);
  },
  name: nameOf,
  isNpc: (id) => /^(n\d+|f\d)$/.test(id),
  skill: (id) => {
    const p = personById(id);
    return THREE.MathUtils.clamp(0.93 - (p ? p.drinks : 0) * 0.05, 0.55, 0.95);
  },
  rnd,
});

// 테이블마다 지금 하는 게임
const tableGames = new Map();
let myTurn = null;
const roulRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd29a).multiplyScalar(2.2), transparent: true, depthWrite: false }));
roulRing.rotation.x = -Math.PI / 2;
roulRing.visible = false;
scene.add(roulRing);

function startGame(kind) {
  $('#gameSheet').classList.remove('show');
  if (needSeat() || blocked()) return;
  const T = me.seat.table;
  if (tableGames.has(T.id)) return toast('이 테이블은 벌써 게임 중이에요');
  const players = seated(T).map(idOf);
  if (players.length < 2) return toast('같은 테이블에 2명 이상 있어야 해요');
  meSay(`${GAMES[kind].name} 하자!`, 2);
  games.start(kind, T.id, players, MY_ID);
}

function applyGame(ev) {
  if (!ev || !ev.gid) return;
  if (ev.e === 'start') {
    tableGames.set(ev.tid, { gid: ev.gid, players: ev.players, last: simT, kind: ev.kind });
    if (ev.players.includes(MY_ID)) toast(`${GAMES[ev.kind].name} 시작!`);
    return;
  }
  const entry = [...tableGames.entries()].find(([, v]) => v.gid === ev.gid);
  if (!entry) return;
  const [tid, game] = entry;
  game.last = simT;
  if (ev.e === 'say') {
    const p = ev.who === 'mc' ? server : personById(ev.who);
    if (!p) return;
    if (ev.who === 'mc') server.chatTable = W.tables[tid];
    say(p, ev.text, 2, !!ev.big);
    if (ev.act && !p.action) p.do(ev.act);
    if (ev.act === 'clap') sound.pop();
  } else if (ev.e === 'turn') {
    if (ev.pid === MY_ID) showTurn(ev);
    else hideTurn();
  } else if (ev.e === 'roul') {
    spinRoulette(ev.order, ev.loser, ev.dur);
  } else if (ev.e === 'lose') {
    hideTurn();
    const p = personById(ev.pid);
    if (!p) return;
    if (p === me) stats.lost++;
    later(0.8, () => {
      // 모든 화면이 lose 를 받아 각자 마시게 하므로 따로 알리지 않는다
      p.do('oneshot');
      later(0.55, () => sound.gulp());
    });
    game.players
      .map(personById)
      .filter((q) => q && q !== p && autoOk(q))
      .forEach((q, i) => later(0.3 + i * 0.25, () => say(q, pick(['마셔라~ 마셔라~', 'ㅋㅋㅋㅋ 원샷!', '쭉쭉~']), 1.6)));
    sound.clink(2);
  } else if (ev.e === 'end') {
    tableGames.delete(tid);
    if (!roam && !server.job) server.chatTable = null;
    hideTurn();
    roulRing.visible = false;
  }
}

// 진행하던 사람이 나가서 소식이 끊긴 게임은 정리한다
function gameWatchdog() {
  for (const [tid, g] of tableGames) {
    if (simT - g.last > 25) {
      tableGames.delete(tid);
      hideTurn();
    }
  }
}

function spinRoulette(order, loser, dur) {
  const ps = order.map(personById).filter(Boolean);
  if (!ps.length) return;
  roulRing.visible = true;
  const end = ps.indexOf(personById(loser));
  const steps = ps.length * 3 + Math.max(0, end);
  let k = 0;
  const hop = () => {
    const p = ps[k % ps.length];
    roulRing.position.set(p.pos.x, 0.03, p.pos.z);
    sound.pop();
    if (k++ < steps) later((dur / steps) * (0.4 + (k / steps) * 1.2), hop);
    else later(2.5, () => (roulRing.visible = false));
  };
  hop();
}

// 내 차례 패널
function showTurn(ev) {
  myTurn = ev;
  const box = $('#turn');
  $('#turnTitle').textContent = ev.kind === 'updown' ? `내 차례! ${ev.lo}~${ev.hi} 중에 하나` : `내 차례! ${ev.n}`;
  $('#turnUpdown').hidden = ev.kind !== 'updown';
  $('#turn369').hidden = ev.kind !== 'g369';
  $('#turnNum').textContent = String(ev.n);
  $('#turnInput').value = '';
  box.hidden = false;
  const bar = $('#turnBar');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  requestAnimationFrame(() => {
    bar.style.transition = `width ${ev.dur}s linear`;
    bar.style.width = '0%';
  });
  if (ev.kind === 'updown') setTimeout(() => $('#turnInput').focus(), 50);
}
function hideTurn() {
  myTurn = null;
  $('#turn').hidden = true;
}
function submitTurn(v) {
  if (!myTurn) return;
  const ev = myTurn;
  hideTurn();
  if (games.gid === ev.gid) games.input(MY_ID, ev.gid, v);
  else send('gameIn', { gid: ev.gid, v });
}
$('#turnForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitTurn($('#turnInput').value.trim());
});
$('#turnSay').onclick = () => submitTurn('num');
$('#turnClap').onclick = () => submitTurn('clap');

$('#bGame').onclick = () => {
  if (blocked() || needSeat()) return;
  $('#gameSheet').classList.add('show');
};
$('#gameClose').onclick = () => $('#gameSheet').classList.remove('show');
document.querySelectorAll('[data-game]').forEach((b) => (b.onclick = () => startGame(b.dataset.game)));

// ---------- 꾸미기 ----------
function buildLookSheet() {
  const box = $('#lookRows');
  box.replaceChildren();
  const rows = [
    ['style', '머리 모양'],
    ['hair', '머리 색'],
    ['shirt', '상의'],
    ['pants', '하의'],
    ['acc', '소품'],
  ];
  for (const [key, label] of rows) {
    const row = document.createElement('div');
    row.className = 'lookRow';
    const h = document.createElement('div');
    h.className = 'lookLabel';
    h.textContent = label;
    const opts = document.createElement('div');
    opts.className = 'lookOpts';
    LOOK_OPTS[key].forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (Array.isArray(v)) {
        b.className = 'chip';
        b.textContent = v[1];
      } else {
        b.className = 'swatch';
        b.style.background = '#' + v.toString(16).padStart(6, '0');
        b.setAttribute('aria-label', label + ' ' + (i + 1));
      }
      b.classList.toggle('on', myLookIdx[key] === i);
      b.onclick = () => {
        myLookIdx = { ...myLookIdx, [key]: i };
        applyMyLook();
        buildLookSheet();
      };
      opts.appendChild(b);
    });
    row.append(h, opts);
    box.appendChild(row);
  }
}
function applyMyLook() {
  me.setLook(lookFromIdx(myLookIdx));
  try {
    localStorage.setItem('pungsok-look', encodeLook(myLookIdx));
  } catch (e) {}
  send('look', { lk: encodeLook(myLookIdx) });
}
$('#lookClose').onclick = () => $('#lookSheet').classList.remove('show');

// ---------- 오늘의 기록 ----------
function openStats() {
  const t = soloTitle(stats);
  let title = t.name;
  let desc = t.desc;
  const friends = $('#statFriends');
  friends.replaceChildren();
  if (MULTI && peers.size) {
    const list = [{ id: MY_ID, name: myName + ' (나)', stats }, ...[...peers.values()].map((r) => ({ id: r.id, name: r.p.name, stats: r.p.stats || emptyStats() }))];
    const titled = roomTitles(list);
    const mine = titled.find((x) => x.id === MY_ID);
    if (mine.title !== title) {
      title = mine.title;
      desc = '오늘 이 방에서 제일!';
    }
    for (const x of titled) {
      const li = document.createElement('div');
      li.className = 'billRow';
      li.innerHTML = '<span></span><b></b>';
      li.children[0].textContent = x.name;
      li.children[1].textContent = x.title;
      friends.appendChild(li);
    }
  }
  $('#statTitle').textContent = title;
  $('#statDesc').textContent = desc;
  $('#statName').textContent = MULTI ? myName : '오늘의 나';
  const grid = $('#statGrid');
  grid.replaceChildren(
    ...STAT_LABELS.map(([k, label, unit]) => {
      const c = document.createElement('div');
      c.className = 'statCell';
      c.innerHTML = '<b></b><span></span>';
      c.children[0].textContent = k === 'flex' ? won(stats[k]) : `${stats[k]}${unit}`;
      c.children[1].textContent = label;
      return c;
    })
  );
  $('#statDate').textContent = new Date().toLocaleDateString('ko-KR') + ' · 풍속의 밤';
  $('#statSheet').classList.add('show');
}
$('#statClose').onclick = () => $('#statSheet').classList.remove('show');

// ---------- 방 관리 ----------
const bannedIds = new Set();

function openRoom() {
  const host = isHost();
  $('#roomInfoCode').textContent = ROOM + (roomPwHash ? ' (비밀번호 있음)' : '');
  $('#roomHostName').textContent = host ? '나' : peers.get(hostId()) ? peers.get(hostId()).p.name : '';
  $('#roomHostOnly').hidden = !host;
  $('#roomGuest').hidden = host;
  const list = $('#roomPeople');
  list.replaceChildren();
  for (const r of peers.values()) {
    const li = document.createElement('div');
    li.className = 'billRow';
    li.innerHTML = '<span></span>';
    li.children[0].textContent = r.p.name;
    if (host) {
      const b = document.createElement('button');
      b.className = 'mini danger';
      b.textContent = '내보내기';
      b.onclick = () => {
        $('#roomSheet').classList.remove('show');
        send('ban', { id: r.id });
        applyBan(r.id);
      };
      li.appendChild(b);
    }
    list.appendChild(li);
  }
  if (!peers.size) list.textContent = '아직 들어온 친구가 없어요';
  $('#roomSheet').classList.add('show');
}

function applyBan(id) {
  if (id === MY_ID) {
    me.banned = true;
    me.locked = true;
    me.lockedAt = simT;
    endNausea();
    toast('방장이 나가라고 했어요...');
    bossRage(me);
    later(1.4, () => requestKick(me));
    return;
  }
  const r = peers.get(id);
  if (!r) return bannedIds.add(id);
  r.p.banned = true;
  bossRage(r.p);
  later(1.4, () => requestKick(r.p));
  logSystem(`방장이 ${r.p.name}님을 내보냈어요`);
}

function showBanned() {
  if (net) net.close();
  net = null;
  $('#banned').hidden = false;
}

function bossResetNow() {
  boss.mood = boss.sulky ? boss.mood : 100;
  setBossMood(100);
  bartender.faceMood = null;
  say(bartender, '...자, 다시 시작해 봅시다. 어서오세요~', 2.4);
}

$('#roomPwSet').onclick = () => {
  if (!isHost()) return;
  const pw = $('#roomPwNew').value.trim();
  const h = pw ? hashText(pw) : '';
  myPw = pw;
  send('pw', { h });
  // 알림이 다 나간 뒤에 옮긴다
  setTimeout(() => switchChannel(h), 700);
  toast(pw ? '비밀번호를 바꿨어요. 새 초대 링크를 보내 주세요' : '비밀번호를 없앴어요');
  $('#roomSheet').classList.remove('show');
};
$('#roomBossReset').onclick = () => {
  if (!isHost()) return;
  send('bossReset');
  bossResetNow();
  $('#roomSheet').classList.remove('show');
};
$('#roomClose').onclick = () => $('#roomSheet').classList.remove('show');

// ---------- 메뉴 ----------
$('#bMenu').onclick = () => {
  $('#menuRoom').hidden = !MULTI;
  $('#menuInvite').hidden = !MULTI;
  $('#menuSheet').classList.add('show');
};
$('#mainMenuClose').onclick = () => $('#menuSheet').classList.remove('show');
$('#menuLook').onclick = () => {
  $('#menuSheet').classList.remove('show');
  buildLookSheet();
  $('#lookSheet').classList.add('show');
};
$('#menuStats').onclick = () => {
  $('#menuSheet').classList.remove('show');
  openStats();
};
$('#menuRoom').onclick = () => {
  $('#menuSheet').classList.remove('show');
  openRoom();
};
$('#menuInvite').onclick = () => {
  $('#menuSheet').classList.remove('show');
  copyInvite();
};
$('#bBill').onclick = () => {
  menuBox.classList.remove('show');
  openBill();
};
$('#billDutch').onclick = () => payBill('dutch');
$('#billFlex').onclick = () => payBill('flex');
$('#billClose').onclick = () => $('#bill').classList.remove('show');

// 클립보드를 못 쓸 때 링크를 보여 주는 창
function showInfo(title, text) {
  $('#infoTitle').textContent = title;
  $('#infoText').value = text;
  $('#info').classList.add('show');
  setTimeout(() => $('#infoText').select(), 50);
}
$('#infoClose').onclick = () => $('#info').classList.remove('show');

// ---------- 알바생 때리기 ----------
// 풍순이에게 걸어가 손바닥으로 철썩. 난동과 같은 진상 단계가 오른다
const WARN_SLAP = [
  ['손님... 우리 풍순이한테 왜 그러세요?', '손님, 직원한테 손대시면 안 됩니다.'],
  ['지금 내 여자한테 뭐 하는 거예요!!', '감히 우리 풍순이를...! 한 번만 더 해 봐요.'],
];
const SLAP_CRY = ['아야!! 자기야~!!', '어머머 이 손님 미쳤나 봐!! 자기야!!', '꺄악! 내 화장 번져!! 자기야~!!'];

// 풍순이를 그 자리에 세운다
// by: 때리러 오는 사람. 다른 사람이 끼어들지 않게 기억해 둔다
function pungsunHold(by) {
  server.hitBy = by;
  server.hitUntil = simT + 9;
  if (roam) roamHome();
  roam = null;
  date = null;
  if (!server.job && server.state === 'walk') {
    server.path = [];
    server.state = 'stand';
  }
  server.frozenUntil = simT + 9;
}

function startSlap() {
  if (server.job || server.jobs.length) return toast('풍순이가 서빙 중이에요. 조금 이따가...');
  if (me.wc || me.locked) return;
  // 이미 누가 때리고 있으면 끼어들지 않는다
  if (me.attack) return toast('이미 풍순이한테 가는 중이에요');
  const by = server.hitBy;
  if (server.hitUntil > simT && by && by !== me) return toast(`풍순이가 지금 ${by.name || '누군가'}님한테 맞고 있어요`);
  if (server.hitUntil > simT && by === me) return toast('풍순이가 아직 아파하고 있어요. 조금 이따가...');
  if (server.frozenUntil > simT || woo || knockout) return toast('풍순이가 지금 바빠요. 조금 이따가...');
  send('slapGo');
  pungsunHold(me);
  me.attack = { until: simT + 10, next: 0 };
}

// 풍순이 옆까지 따라가서 닿으면 때린다
function attackUpdate() {
  const A = me.attack;
  if (!A) return;
  if (me.locked || me.wc || simT > A.until) {
    me.attack = null;
    return;
  }
  const d = Math.hypot(me.pos.x - server.pos.x, me.pos.z - server.pos.z);
  if (d < 1.0 && me.state !== 'walk') {
    me.attack = null;
    me.targetYaw = Math.atan2(server.pos.x - me.pos.x, server.pos.z - me.pos.z);
    me.onSlap = () => {
      // 사장님 애인이라 한 번에 두 단계
      const lv = nextAngerLevel(2);
      const wi = (Math.random() * 3) | 0;
      send('slap', { lv, wi });
      slapEffects(me, lv, wi);
    };
    me.do('slap');
    return;
  }
  if (simT >= A.next) {
    A.next = simT + 0.7;
    const dx = me.pos.x - server.pos.x;
    const dz = me.pos.z - server.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const spot = { x: server.pos.x + (dx / len) * 0.75, z: server.pos.z + (dz / len) * 0.75 };
    pushOut(spot, W.obstacles);
    goTo(spot);
  }
}

function slapEffects(p, lv, wi) {
  server.hitBy = p;
  server.hitUntil = simT + 3.5;
  // 같이 때리러 가던 중이었으면 먼저 닿은 사람만 때린다
  if (p !== me && me.attack) {
    me.attack = null;
    me.path = [];
    if (me.state === 'walk') me.state = 'stand';
    toast(`${p.name}님이 먼저 때렸어요`);
  }
  sound.slap();
  W.sparkle(server.headWorld(new THREE.Vector3()));
  server.frozenUntil = simT + 3;
  server.action = null;
  server.targetYaw = Math.atan2(p.pos.x - server.pos.x, p.pos.z - server.pos.z);
  server.do('hurt');
  server.faceMood = 'sad';
  later(4, () => (server.faceMood = null));
  say(p, '에잇!', 1.2, true);
  later(0.4, () => say(server, SLAP_CRY[wi % SLAP_CRY.length], 2.2, true));
  npcs
    .filter((q) => q.pos.distanceTo(p.pos) < 5)
    .slice(0, 3)
    .forEach((q, i) => later(0.8 + i * 0.3, () => say(q, pick(['헐!!', '때렸어...?', '와 미쳤다']), 1.6)));
  if (lv < 3) {
    later(1.4, () => bossWarn(p, lv, wi % 2, WARN_SLAP));
    later(1.8, () => setBossMood(boss.mood - (lv === 1 ? 15 : 30)));
    return;
  }
  later(1.2, () => bossRage(p, '감히 우리 풍순이를!!!'));
  later(1.8, () => setBossMood(boss.mood - 40));
  later(2.4, () => requestKick(p));
}

// ---------- 사장님 패기 ----------
// 풍순이가 울면서 바 앞으로 달려와 말린다. 서빙 중이면 소리만 지른다
function pungsunRunsOver() {
  later(0.5, () => say(server, '자기야!!!', 1.6, true));
  if (server.job || server.jobs.length) return;
  roam = null;
  date = null;
  server.action = null;
  server.chatTable = null;
  server.frozenUntil = simT + 14;
  server.faceMood = 'sad';
  server.speed = 3.6;
  server.walkTo(planPath(server.pos, DATE_SPOT, W.obstacles));
  // 도착할 즈음 운다
  const arrive = Math.min(4, Math.hypot(server.pos.x - DATE_SPOT.x, server.pos.z - DATE_SPOT.z) / 3.0 + 0.4);
  later(arrive, () => {
    server.speed = 2.2;
    server.targetYaw = Math.atan2(bartender.pos.x - server.pos.x, bartender.pos.z - server.pos.z);
    if (!server.action && server.state === 'stand') server.do('hurt');
    say(server, '흐엉 그만해요!! 우리 자기 때리지 마!!', 2.2, true);
  });
  later(6, () => server.faceMood === 'sad' && (server.faceMood = null));
}
// 바를 넘어 들어가 사장님과 뒤엉켜 싸운다. 사장님에게 내던져진 뒤 쫓겨난다
let brawl = null;
const cloud = new THREE.Group();
for (let i = 0; i < 12; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.25, 0.45), 12, 10), new THREE.MeshBasicMaterial({ color: 0xf2ece2, transparent: true, opacity: 0.88, depthWrite: false }));
  m.userData.ph = Math.random() * 10;
  cloud.add(m);
}
cloud.visible = false;
scene.add(cloud);
const BAR_IN = { x: BAR_HOME.x + 0.75, z: BAR_HOME.z };
const BAR_OUT = { x: BAR_HOME.x + 0.75, z: BAR_FRONT_Z + 0.15 };

function startBeat() {
  // 이미 누가 패거나 밟고 있으면 끼어들지 않는다
  if (brawl) return toast(`풍뎅이 사장님이 지금 ${brawl.p === me ? '나' : (brawl.p.name || '누군가') + '님'}한테 맞고 있어요`);
  if (knockout) return toast('풍뎅이 사장님이 지금 밟히고 있어요');
  if (woo) return toast('풍뎅이 사장님이 지금 작업 거는 중이에요');
  if (bossBusy() || bartender.state !== 'stand') return toast('풍뎅이 사장님이 바빠 보여요. 조금 이따가...');
  stats.jin++;
  me.jinLv = 0;
  me.locked = true;
  me.lockedAt = simT;
  send('beat');
  beatBoss(me);
}

function beatBoss(p) {
  brawl = { p, phase: 'go', until: simT + 12 };
  if (p === me) goTo(BAR_OUT);
  else walkPeer(p, BAR_OUT);
  say(p, pick(['사장 나와!! 한판 붙자!!', '오늘 끝장 보자!!']), 2, true);
}

function brawlUpdate(dt) {
  const B = brawl;
  if (!B) return;
  const p = B.p;
  const b = bartender;
  if (!people.includes(p)) {
    brawl = null;
    cloud.visible = false;
    return;
  }
  if (B.phase === 'go') {
    const near = Math.hypot(p.pos.x - BAR_OUT.x, p.pos.z - BAR_OUT.z) < 0.5;
    if ((near && p.state === 'stand') || simT > B.until) {
      if (!near) p.root.position.set(BAR_OUT.x, 0, BAR_OUT.z);
      if (p.seat) p.standUp();
      p.path = [];
      p.hopTo(BAR_OUT.x, COUNTER.y, COUNTER.z, 0.45, 0.8);
      B.phase = 'up';
      say(b, '어? 어어?!', 1.2);
      b.targetYaw = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
    }
  } else if (B.phase === 'up' && p.state === 'stand') {
    p.hopTo(BAR_IN.x, BAR_HOME.y, BAR_IN.z, 0.45, 0.6);
    B.phase = 'down';
  } else if (B.phase === 'down' && p.state === 'stand') {
    p.targetYaw = Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    b.targetYaw = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
    b.action = null;
    p.do('brawl');
    b.do('brawl');
    b.faceMood = 'angry';
    cloud.visible = true;
    sound.brawl(2.4);
    say(p, '퍽! 퍽! 퍽!!', 2.4, true);
    pungsunRunsOver();
    npcs.slice(0, 4).forEach((q, i) => later(0.6 + i * 0.3, () => say(q, pick(['헐 싸운다!!', '말려 말려!!', '대박...']), 1.6)));
    B.phase = 'fight';
    B.until = simT + 2.6;
    B.spark = 0;
  } else if (B.phase === 'fight') {
    // 뿌연 싸움 구름이 들썩인다
    const mx = (p.pos.x + b.pos.x) / 2;
    const mz = (p.pos.z + b.pos.z) / 2;
    cloud.position.set(mx, 0.75, mz);
    cloud.children.forEach((m, i) => {
      const a = simT * 9 + m.userData.ph;
      m.position.set(Math.cos(a + i) * 0.45, Math.sin(a * 1.3 + i) * 0.35 + 0.1, Math.sin(a + i * 2) * 0.35);
      m.scale.setScalar(0.85 + Math.sin(a * 2) * 0.2);
    });
    B.spark -= dt;
    if (B.spark <= 0) {
      B.spark = 0.3;
      W.sparkle(new THREE.Vector3(mx + rnd(-0.4, 0.4), 1.4, mz));
    }
    if (simT >= B.until) {
      cloud.visible = false;
      b.setPlaster(true);
      later(90, () => b.setPlaster(false));
      b.faceMood = 'fury';
      b.do('rage');
      say(b, '...이 손님이!!!', 1.8, true);
      // 바 너머로 내던져진다
      p.faceMood = 'sad';
      p.hopTo(BAR_IN.x, COUNTER.y, COUNTER.z, 0.4, 1.0, false);
      B.phase = 'toss1';
    }
  } else if (B.phase === 'toss1' && p.state === 'stand') {
    p.hopTo(BAR_OUT.x, 0, BAR_OUT.z + 0.4, 0.45, 0.6, false);
    B.phase = 'toss2';
  } else if (B.phase === 'toss2' && p.state === 'stand') {
    brawl = null;
    p.baseY = 0;
    say(p, '아이고...', 1.4);
    comfortDue = true;
    setBossMood(boss.mood - 50);
    requestKick(p);
  }
}

// ---------- 어묵탕 ----------
// 테이블 가운데 통에서 자리에 앉은 채로 떠 먹는다. 2분 안에 세 번 넘게 먹으면 사장님이 와서 손바닥을 내밀며 "그만 드시죠."
const EOMUK_LINES = ['후루룩~ 캬 국물 좋다', '어묵 최고!', '하나만 더 먹어야지~'];
const EOMUK_REPLY = ['아... 국물이 너무 맛있어서요...', '한 그릇만 더...', '네... 죄송합니다...'];
const EOMUK_LIMIT = 3;
const EOMUK_WINDOW = 120;

function goEomuk() {
  if (blocked() || needSeat()) return;
  if (me.eomuk || me.action) return;
  send('eomuk');
  runEomuk(me);
}

function runEomuk(p) {
  p.eomuk = { phase: 'ladle', t: simT + 1.6, until: simT + 8 };
  p.action = null;
  p.do('ladle');
}

// 손님(NPC)도 가끔 떠 먹는다. 횟수는 세지 않는다
function npcEomuk(p) {
  p.do('ladle');
  later(1.6, () => {
    if (!p.seat || p.action) return;
    p.do('sip');
    if (Math.random() < 0.4) say(p, pick(EOMUK_LINES), 1.8);
  });
}

function eomukUpdate() {
  for (const p of people) {
    const E = p.eomuk;
    if (!E) continue;
    if (simT > E.until || p.kickedOut || p.wc) {
      p.eomuk = null;
      continue;
    }
    if (E.phase === 'ladle' && simT >= E.t) {
      p.do('sip');
      sound.slurp();
      p.eomukTotal = (p.eomukTotal || 0) + 1;
      say(p, EOMUK_LINES[(p.eomukTotal - 1) % EOMUK_LINES.length], 2);
      E.phase = 'sip';
      E.t = simT + 1.8;
    } else if (E.phase === 'sip' && simT >= E.t) {
      p.eomuk = null;
      if (p === me) stats.eomuk++;
      p.eomukTimes = (p.eomukTimes || []).filter((t) => simT - t < EOMUK_WINDOW);
      p.eomukTimes.push(simT);
      if (p.eomukTimes.length >= EOMUK_LIMIT) {
        p.eomukTimes = [];
        stopEating(p);
      }
    }
  }
}

function stopEating(p) {
  setBossMood(boss.mood - 15);
  if (bossBusy() || bartender.state !== 'stand') {
    bossGrumble(p, '손님, 어묵탕 그만 드시죠.', 'serious', 'warn', true);
    return;
  }
  kick = { target: p, phase: 'wait', mode: 'eomuk' };
}

// ---------- 테니스장 ----------
let tennisOn = false;
let tennisWin = null;
const tennis = createTennis({
  scene,
  court: W.court,
  sound,
  playerOpts: { ...lookFromIdx(myLookIdx) },
  cpuOpts: { ...PUNGSUN_OPTS },
  ui: {
    score: (t) => ($('#tnScore').textContent = t),
    msg: (t) => ($('#tnMsg').textContent = t),
    hint: (t) => ($('#tnHint').textContent = t),
    over: (win) => {
      tennisWin = win;
      $('#tnOver').hidden = false;
      $('#tnOverTitle').textContent = win ? '승리! 풍순이를 이겼어요' : '패배... 벌칙은 원샷!';
      $('#tnSwing').hidden = true;
      $('#tnAgain').hidden = false;
      if (win) stats.tennis++;
    },
  },
});

function fade(fn) {
  const f = $('#fade');
  f.classList.add('on');
  setTimeout(() => {
    fn();
    f.classList.remove('on');
  }, 450);
}

// 가게에서 테니스장으로. 혼자 치기, 복식, 구경 모두 같다
function courtEnter() {
  if (me.seat) me.standUp();
  me.path = [];
  me.state = 'stand';
  me.root.position.set(EXIT.x, 0, EXIT.z);
  me.root.visible = false;
  me.locked = true;
  me.lockedAt = simT;
  endNausea();
  send('tennis', { on: true });
  document.body.classList.add('tennis');
  controls.enabled = false;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  viewOffY = -1;
}

function enterTennis() {
  if (blocked() || tennisOn) return;
  $('#menuSheet').classList.remove('show');
  fade(() => {
    tennisOn = true;
    tennisMode = 'solo';
    tennisWin = null;
    courtEnter();
    tennis.setLook(lookFromIdx(myLookIdx));
    $('#tnOver').hidden = true;
    $('#tnSwing').hidden = false;
    $('#tnCheer').hidden = true;
    tennis.start();
  });
}

function leaveTennis() {
  if (!tennisOn) return;
  if (tennisMode !== 'solo') doublesLeaving();
  fade(() => {
    tennisOn = false;
    if (tennisMode === 'solo') tennis.stop();
    else {
      doubles.stop();
      doubles.clearWatchers();
    }
    tennisMode = null;
    document.body.classList.remove('tennis');
    controls.enabled = true;
    me.root.visible = true;
    me.locked = false;
    me.targetYaw = Math.PI;
    send('tennis', { on: false });
    controls.target.set(me.pos.x, 0.5, me.pos.z);
    lastTarget.copy(controls.target);
    camera.position.copy(controls.target).add(CAM_OFFSET);
    updateViewOffset();
    if (tennisWin === false) {
      later(0.8, () => {
        meSay('벌칙주 원샷!', 2);
        me.do('oneshot');
        send('act', { a: 'oneshot' });
        later(0.55, () => sound.gulp());
      });
    } else if (tennisWin) later(0.8, () => meSay('테니스 이기고 왔다~!', 2));
  });
}

function setPeerTennis(p, on) {
  p.tennis = on;
  p.root.visible = !on;
  if (p.tagEl) p.tagEl.style.display = on ? 'none' : '';
  if (on) {
    if (p.seat) {
      p.seat.occupant = null;
      p.seat = null;
    }
    p.path = [];
    p.state = 'stand';
    p.root.position.set(EXIT.x, 0, EXIT.z);
    logSystem(`${p.name}님이 테니스 치러 갔어요`);
  } else logSystem(`${p.name}님이 테니스장에서 돌아왔어요`);
}

// 테니스 중 카메라. 내 뒤 위쪽에서 코트를 내려다본다. 복식 B팀이면 반대편에서
function tennisCamera() {
  const C = W.court.c;
  const M = doubles.state;
  const s = tennisMode === 'play' && M && M.mine >= 2 ? -1 : 1;
  camera.position.set(C.x, 8.6, C.z + 12.8 * s);
  camera.lookAt(C.x, 0, C.z - 0.6 * s);
}

const courtSwing = () => (tennisMode === 'solo' ? tennis.swing() : doubles.swing());
$('#tnSwing').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  courtSwing();
});
$('#tnLeave').onclick = leaveTennis;
$('#tnBack').onclick = leaveTennis;
$('#tnAgain').onclick = () => {
  if (tennisMode !== 'solo') return hostStart();
  tennisWin = null;
  $('#tnOver').hidden = true;
  $('#tnSwing').hidden = false;
  tennis.start();
};

$('#menuHd').onclick = () => {
  $('#menuSheet').classList.remove('show');
  if (blocked()) return;
  callHd();
};
$('#menuEomuk').onclick = () => {
  $('#menuSheet').classList.remove('show');
  goEomuk();
};
window.addEventListener('keydown', (e) => {
  if (!tennisOn || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    courtSwing();
  }
});

// ---------- 테니스 복식 ----------
// 복식 방(TL). 연 사람이 방장(호스트). slots 는 들어온 친구 id, 빈자리는 null(시작하면 CPU)
// 신호: tl 은 방 모집, td 는 경기
let TL = null;
let tennisMode = null;
const CPU_SLOTS = [
  { name: '풍순', look: PUNGSUN_OPTS },
  { name: '풍뎅이', look: BOSS_OPTS },
  { name: '단골손님', look: LOOKS[3] },
];
const CHEERS = ['나이스~!', '화이팅!!', '잘한다 잘한다~', '와아아~', '하나 더!'];
const tnName = (id) => (id === MY_ID ? myName || '나' : (peers.get(id) && peers.get(id).p.name) || '손님');
function tnLook(id) {
  if (id === MY_ID) return lookFromIdx(myLookIdx);
  const r = peers.get(id);
  const ix = r && decodeLook(r.p.lk);
  return ix ? lookFromIdx(ix) : lookFromIdx(defaultLookIdx(id));
}
function slotsFor(spec) {
  return spec.map((s) => (s.id ? { id: s.id, name: tnName(s.id), look: tnLook(s.id), cpu: false } : { name: CPU_SLOTS[s.ci % 3].name, look: CPU_SLOTS[s.ci % 3].look, cpu: true }));
}
function specTeam(t) {
  if (!TL || !TL.spec) return '';
  return slotsFor(TL.spec)
    .filter((_, i) => doubles.teamOf(i) === t)
    .map((s) => s.name)
    .join('·');
}

const doubles = createDoubles({
  scene,
  court: W.court,
  sound,
  send: (d) => send('td', d),
  ui: {
    score: (t) => ($('#tnScore').textContent = t),
    msg: (t) => ($('#tnMsg').textContent = t),
    hint: (t) => ($('#tnHint').textContent = t),
    over: (win) => doublesOver(win),
  },
});

// 방장이 방 상태를 모두에게 알린다. 새로 들어온 친구도 알 수 있게 접속 신호마다 다시 보낸다
function tlBroadcast() {
  if (!TL || TL.host !== MY_ID) return;
  send('tl', { k: 'state', mid: TL.mid, host: TL.host, slots: TL.slots, phase: TL.phase, spec: TL.spec, watchers: [...TL.watchers] });
}

function openLobby() {
  if (TL) return;
  TL = { mid: MY_ID + Date.now().toString(36), host: MY_ID, slots: [MY_ID, null, null, null], phase: 'lobby', spec: null, watchers: new Set() };
  tlBroadcast();
  renderLobby();
  if (MULTI) logSystem('테니스 복식 방을 열었어요. 친구들이 ☰ → 테니스장에서 들어올 수 있어요');
}

function closeLobby() {
  if (!TL || TL.host !== MY_ID) return;
  send('tl', { k: 'close', mid: TL.mid });
  TL = null;
  renderLobby();
}

// 자리 누르기. 빈자리면 들어가고, 내 자리면 빠진다(방장은 자리만 옮김)
function joinSlot(i) {
  if (!TL || TL.phase !== 'lobby') return;
  if (TL.host === MY_ID) hostJoin(MY_ID, i);
  else send('tl', { k: 'join', mid: TL.mid, slot: i });
}
function hostJoin(id, i) {
  const cur = TL.slots[i];
  if (cur && cur !== id) return;
  if (cur === id) {
    if (id !== TL.host) TL.slots[i] = null;
  } else {
    TL.slots = TL.slots.map((x) => (x === id ? null : x));
    TL.slots[i] = id;
  }
  tlBroadcast();
  renderLobby();
}

// 방장이 시작. 빈자리는 CPU 로 채운다. 끝난 뒤 한 판 더 할 때도 쓴다
function hostStart() {
  if (!TL || TL.host !== MY_ID) return;
  if (!tennisOn && blocked()) return;
  let ci = 0;
  TL.spec = TL.slots.map((id) => (id ? { id } : { ci: ci++ }));
  TL.phase = 'play';
  tlBroadcast();
  send('td', { k: 'start', mid: TL.mid, spec: TL.spec });
  startLocal(TL.spec);
}

function startLocal(spec) {
  TL.spec = spec;
  TL.phase = 'play';
  renderLobby();
  const mine = spec.findIndex((s) => s.id === MY_ID);
  if (mine >= 0) {
    if (!tennisOn && (me.wc || me.locked)) {
      toast('지금은 테니스장에 갈 수 없어요. CPU 가 대신 쳐요');
      send('td', { k: 'quit', mid: TL.mid });
      return;
    }
    enterDoubles('play', mine);
  } else if (tennisMode === 'watch') enterDoubles('watch', -1);
  else if (!tennisOn) {
    logSystem(`테니스 복식 시작! ${specTeam(0)} vs ${specTeam(1)} (☰ → 테니스장에서 구경)`);
    toast('테니스 복식이 시작됐어요. ☰ → 테니스장에서 구경할 수 있어요');
  }
}

function enterDoubles(role, mine) {
  if (!TL || !TL.spec) return;
  $('#tnSheet').classList.remove('show');
  $('#menuSheet').classList.remove('show');
  const go = () => {
    tennisMode = role;
    tennisWin = null;
    $('#tnOver').hidden = true;
    $('#tnSwing').hidden = role !== 'play';
    $('#tnCheer').hidden = role !== 'watch';
    $('#tnMsg').textContent = '';
    $('#tnHint').textContent = '';
    const host = TL.host === MY_ID;
    doubles.setup({ mid: TL.mid, slots: slotsFor(TL.spec), mine, host });
    doubles.clearWatchers();
    for (const id of TL.watchers) if (id !== MY_ID) doubles.addWatcher(id, tnName(id), tnLook(id), false);
    if (role === 'watch') {
      TL.watchers.add(MY_ID);
      doubles.addWatcher(MY_ID, tnName(MY_ID), tnLook(MY_ID), true);
      send('td', { k: 'watch', mid: TL.mid, on: true });
    }
    // 다른 화면이 준비될 시간을 주고 첫 서브
    if (host) later(1.2, () => doubles.begin());
    else if (role === 'play') send('td', { k: 'hello', mid: TL.mid });
  };
  if (tennisOn) return go();
  if (blocked()) return;
  fade(() => {
    tennisOn = true;
    courtEnter();
    go();
  });
}

function doublesOver(win) {
  const M = doubles.state;
  $('#tnOver').hidden = false;
  $('#tnSwing').hidden = true;
  $('#tnAgain').hidden = !(TL && TL.host === MY_ID) || win < 0;
  if (win < 0) {
    $('#tnOverTitle').textContent = '경기가 끝났어요';
    tennisWin = null;
    return;
  }
  if (tennisMode === 'play' && M && M.mine >= 0) {
    const ok = doubles.teamOf(M.mine) === win;
    tennisWin = ok;
    $('#tnOverTitle').textContent = ok ? '승리! 우리 팀이 이겼어요' : '패배... 벌칙은 원샷!';
    if (ok) stats.tennis++;
  } else {
    tennisWin = null;
    $('#tnOverTitle').textContent = `${specTeam(win)} 팀 승리!`;
  }
}

// 테니스장에서 나갈 때 알린다
function doublesLeaving() {
  if (!TL) return;
  if (tennisMode === 'watch') {
    TL.watchers.delete(MY_ID);
    send('td', { k: 'watch', mid: TL.mid, on: false });
    return;
  }
  if (TL.host === MY_ID) {
    const M = doubles.state;
    if (M && M.phase !== 'done') doubles.end();
    closeLobby();
    return;
  }
  send('td', { k: 'quit', mid: TL.mid });
}

function onLobbyNet(d, from) {
  if (!d || typeof d !== 'object') return;
  if (d.k === 'state') {
    if (!Array.isArray(d.slots) || d.slots.length !== 4 || typeof d.mid !== 'string') return;
    // 내가 연 방이 있으면 그쪽이 우선
    if (TL && TL.host === MY_ID && TL.mid !== d.mid) return;
    const fresh = !TL || TL.mid !== d.mid;
    const spec = Array.isArray(d.spec) && d.spec.length === 4 ? d.spec : fresh ? null : TL.spec;
    TL = {
      mid: d.mid,
      host: from,
      slots: d.slots.map((x) => (typeof x === 'string' ? x : null)),
      phase: d.phase === 'play' ? 'play' : 'lobby',
      spec,
      watchers: new Set(Array.isArray(d.watchers) ? d.watchers.filter((x) => typeof x === 'string') : []),
    };
    if (tennisMode === 'watch') TL.watchers.add(MY_ID);
    if (fresh) logSystem(`${tnName(from)}님이 테니스 복식 방을 열었어요. ☰ → 테니스장`);
    renderLobby();
    return;
  }
  if (!TL || d.mid !== TL.mid) return;
  if (d.k === 'close') {
    if (TL.host === from) {
      TL = null;
      renderLobby();
    }
    return;
  }
  if (d.k === 'join' && TL.host === MY_ID && TL.phase === 'lobby') {
    const i = d.slot | 0;
    if (i >= 0 && i < 4) hostJoin(from, i);
  }
}

function onDoublesNet(d, from) {
  if (!d || typeof d !== 'object' || !TL || d.mid !== TL.mid) return;
  const inCourt = tennisMode === 'play' || tennisMode === 'watch';
  if (d.k === 'start') {
    if (from === TL.host && Array.isArray(d.spec) && d.spec.length === 4) startLocal(d.spec);
    return;
  }
  if (d.k === 'watch') {
    if (d.on) TL.watchers.add(from);
    else TL.watchers.delete(from);
    if (inCourt) {
      if (d.on) doubles.addWatcher(from, tnName(from), tnLook(from), false);
      else doubles.removeWatcher(from);
    }
    if (d.on && TL.host === MY_ID && doubles.state) send('td', { ...doubles.snapshot(), mid: TL.mid, to: from });
    return;
  }
  if (d.k === 'hello') {
    if (TL.host === MY_ID && doubles.state) send('td', { ...doubles.snapshot(), mid: TL.mid, to: from });
    return;
  }
  if (d.k === 'sync') {
    if (d.to === MY_ID && TL.host !== MY_ID && inCourt) doubles.applySync(d);
    return;
  }
  if (d.k === 'cheer') {
    if (inCourt) {
      doubles.cheer(from);
      $('#tnMsg').textContent = `${tnName(from)}: ${String(d.text || '').slice(0, 30)}`;
    }
    return;
  }
  if (d.k === 'quit') {
    if (TL.host !== MY_ID) return;
    const i = TL.slots.indexOf(from);
    if (i >= 0) {
      TL.slots[i] = null;
      if (TL.phase === 'play') doubles.toCpu(i);
      tlBroadcast();
    }
    return;
  }
  // 경기 신호. 테니스장에 있으면 그리고, 가게에 있으면 점수만 수다방에
  if (inCourt) doubles.onMsg(d);
  else if ((d.k === 'point' || d.k === 'over') && Array.isArray(d.score)) {
    const P = ['0', '15', '30', '40'];
    const [a, b] = d.score;
    if (d.k === 'over') logSystem(`테니스 복식 끝! ${specTeam(d.win)} 팀 승리`);
    else logSystem(`테니스 복식 ${specTeam(0)} ${a >= 3 && b >= 3 ? (a === b ? '듀스' : a > b ? '어드밴티지' : '40') : P[Math.min(3, a)]} : ${a >= 3 && b >= 3 && a !== b ? (b > a ? '어드밴티지' : '40') : P[Math.min(3, b)]} ${specTeam(1)}`);
  }
}

// 친구가 나가면 방과 경기를 정리한다
function tnPeerGone(id) {
  if (!TL) return;
  TL.watchers.delete(id);
  doubles.removeWatcher(id);
  if (TL.host === id) {
    if (tennisMode === 'play' || tennisMode === 'watch') doubles.apply({ k: 'end' });
    TL = null;
    renderLobby();
    return;
  }
  if (TL.host === MY_ID) {
    const i = TL.slots.indexOf(id);
    if (i >= 0) {
      TL.slots[i] = null;
      if (TL.phase === 'play') doubles.toCpu(i);
      tlBroadcast();
      renderLobby();
    }
  }
}

function renderLobby() {
  const has = !!TL;
  $('#tnOpen').hidden = has;
  $('#tnLobby').hidden = !has;
  if (!has) {
    $('#tnStart').hidden = $('#tnWatch').hidden = $('#tnClose').hidden = true;
    $('#tnLobbyHint').textContent = MULTI ? '복식 방을 열면 친구들이 빈자리를 눌러 들어와요' : '혼자면 빈자리는 CPU 가 채워요';
    return;
  }
  const host = TL.host === MY_ID;
  document.querySelectorAll('#tnLobby [data-slot]').forEach((b) => {
    const i = +b.dataset.slot;
    const id = TL.slots[i];
    const sp = TL.phase === 'play' && TL.spec ? TL.spec[i] : null;
    b.textContent = id ? tnName(id) + (id === TL.host ? ' (방장)' : '') : sp && sp.ci != null ? CPU_SLOTS[sp.ci % 3].name + ' (CPU)' : '빈자리';
    b.classList.toggle('mine', id === MY_ID);
    b.classList.toggle('empty', !id);
    b.disabled = TL.phase !== 'lobby';
  });
  $('#tnStart').hidden = !host || TL.phase !== 'lobby';
  $('#tnClose').hidden = !host || TL.phase !== 'lobby';
  $('#tnWatch').hidden = TL.phase !== 'play' || TL.slots.includes(MY_ID);
  $('#tnLobbyHint').textContent =
    TL.phase === 'play' ? '경기 중이에요. 테니스장 옆에서 구경할 수 있어요' : host ? '빈자리는 시작할 때 풍순이, 사장님, 단골손님이 채워요' : TL.slots.includes(MY_ID) ? '방장이 시작하면 테니스장으로 가요. 내 자리를 누르면 빠져요' : '빈자리를 눌러 들어가요';
}

$('#menuTennis').onclick = () => {
  $('#menuSheet').classList.remove('show');
  renderLobby();
  $('#tnSheet').classList.add('show');
};
$('#tnSheetClose').onclick = () => $('#tnSheet').classList.remove('show');
$('#tnSolo').onclick = () => {
  if (TL && TL.slots.includes(MY_ID)) return toast('복식 방에 들어가 있어요. 먼저 자리에서 빠져 주세요');
  $('#tnSheet').classList.remove('show');
  enterTennis();
};
$('#tnOpen').onclick = openLobby;
$('#tnStart').onclick = () => {
  $('#tnSheet').classList.remove('show');
  hostStart();
};
$('#tnClose').onclick = closeLobby;
$('#tnWatch').onclick = () => enterDoubles('watch', -1);
document.querySelectorAll('#tnLobby [data-slot]').forEach((b) => (b.onclick = () => joinSlot(+b.dataset.slot)));
$('#tnCheer').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (!TL || tennisMode !== 'watch') return;
  const text = pick(CHEERS);
  send('td', { k: 'cheer', mid: TL.mid, text });
  doubles.cheer(MY_ID);
  sound.clink && sound.clink(1);
  $('#tnMsg').textContent = `${tnName(MY_ID)}: ${text}`;
});

// 사장님 기분은 조금씩 회복된다
let regenAcc = 0;
let regenTick = 0;
function bossRegen(dt) {
  regenAcc += dt;
  if (regenAcc < 1) return;
  regenAcc = 0;
  // 짜증은 천천히 가라앉는다(2초에 1). 삐졌을 때는 풀리라고 1초에 1
  regenTick = (regenTick + 1) % 2;
  if (boss.mood < 100 && (boss.sulky || regenTick === 0)) setBossMood(boss.mood + 1);
}

let simT = 0;
let camFollow = true;
let viewTick = 0;
let offscreenFor = 0;
const NARROW = () => app.clientWidth < 700 || app.clientWidth < app.clientHeight;
const projV = new THREE.Vector3();

// 내 캐릭터가 가려지지 않은 화면 안에 있는지
function meOffscreen() {
  if (!camFollow || $('#intro') && !$('#intro').classList.contains('hide')) return false;
  projV.set(me.pos.x, me.pos.y + 0.8, me.pos.z).project(camera);
  if (projV.z > 1) return true;
  const y = (-projV.y * 0.5 + 0.5) * app.clientHeight;
  return Math.abs(projV.x) > 0.95 || y < visTop - 30 || y > visBottom - 10;
}

// 나를 가운데 두고 따라가는 중인지. 화면 밖으로 나가면 켜지고, 반만 따라가도 넉넉히 보일 때 꺼진다
// 바로 끄면 두 방식이 번갈아 바뀌며 화면이 떨린다
let fullFollow = false;
const halfGoal = new THREE.Vector3();
const testCam = camera.clone();
function fitsHalfFollow() {
  halfGoal.set(me.pos.x * 0.5, 0.5, me.pos.z * 0.4 - 1.4);
  testCam.copy(camera);
  testCam.position.copy(camera.position).sub(controls.target).add(halfGoal);
  testCam.updateMatrixWorld();
  projV.set(me.pos.x, me.pos.y + 0.8, me.pos.z).project(testCam);
  if (projV.z > 1) return false;
  const y = (-projV.y * 0.5 + 0.5) * app.clientHeight;
  return Math.abs(projV.x) < 0.8 && y > visTop + 40 && y < visBottom - 60;
}

// 기본 시점에서 많이 벗어났는지
function camOffDefault() {
  const off = camera.position.clone().sub(controls.target);
  return off.angleTo(CAM_OFFSET) > 0.12 || Math.abs(off.length() - CAM_OFFSET.length()) > 1.5;
}
function tick(dt) {
  simT += dt;
  const t = simT;

  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].at <= t) {
      const j = jobs[i];
      jobs.splice(i, 1);
      j.fn();
    }
  }

  for (const p of npcs) npcThink(p, dt);
  // 풍녀는 혼자 노는 데모에서만 수다를 떤다(같이 놀 때는 화면마다 달라지므로)
  if (!MULTI && !woo) for (const f of FUNG) npcThink(f, dt);
  serverUpdate();
  pungsunIdle(dt);
  partyUpdate();
  kickUpdate();
  meUpdate();
  if (MULTI) dropSilentPeers();
  syncChatRoom();
  bossRegen(dt);
  bartenderUpdate(dt);
  wcUpdate();
  games.update();
  gameWatchdog();
  nauseaUpdate();
  attackUpdate();
  brawlUpdate(dt);
  eomukUpdate();
  kickChoiceUpdate();
  knockoutUpdate(dt);
  wooUpdate();
  pSulkUpdate();
  hdUpdate();
  if (tennisOn) (tennisMode === 'solo' ? tennis : doubles).update(dt);
  for (const p of people) p.update(dt, p === bartender || p.noClip ? null : W.obstacles, p === bartender ? null : p === me || p.remote || p.wide ? ME_BOUNDS : W.bounds);
  W.update(dt, t);

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    r.m.scale.setScalar(1 + r.t * 3);
    r.m.material.opacity = 1 - r.t / 0.6;
    if (r.t > 0.6) {
      scene.remove(r.m);
      r.m.material.dispose();
      rings.splice(i, 1);
    }
  }

  if (tennisOn) return tennisCamera();
  // 카메라가 나를 천천히 따라온다. 좁은 화면이나 내가 화면 밖으로 나가면 나를 가운데에 둔다
  if (++viewTick % 20 === 0) updateViewOffset();
  const offscreen = meOffscreen();
  offscreenFor = offscreen ? offscreenFor + dt : 0;
  if (offscreenFor > 1.2 && !camTouching) camReset = true;
  if (offscreen) fullFollow = true;
  else if (fullFollow && fitsHalfFollow()) fullFollow = false;
  if (NARROW() || fullFollow) camGoal.set(me.pos.x, 0.5, me.pos.z);
  else camGoal.set(me.pos.x * 0.5, 0.5, me.pos.z * 0.4 - 1.4);
  if (TOUCH_UI && !camTouching && !camReset && camTouchedAt && performance.now() - camTouchedAt > 8000 && camOffDefault()) {
    camTouchedAt = 0;
    camReset = true;
  }
  if (camReset) {
    const off = camera.position.clone().sub(controls.target);
    const want = CAM_OFFSET.clone();
    off.lerp(want, 1 - Math.exp(-dt * 4));
    camera.position.copy(controls.target).add(off);
    if (off.distanceTo(want) < 0.05) camReset = false;
  }
  if (camFollow) controls.target.lerp(camGoal, 1 - Math.exp(-dt * 1.8));
  camera.position.add(v3.copy(controls.target).sub(lastTarget));
  lastTarget.copy(controls.target);
  controls.update();
  // 많이 마시면 화면이 살짝 흔들린다
  const sway = [0, 0, 0.006, 0.014][me.blush];
  if (sway) camera.rotateZ(Math.sin(t * 0.9) * sway + (nausea ? Math.sin(t * 2.3) * 0.01 : 0));
}

function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  composer.render();
  placeLabels(simT);
  requestAnimationFrame(frame);
}

function placeLabels(t) {
  const w = app.clientWidth;
  const h = app.clientHeight;
  for (const p of people) {
    const el = p.bubbleEl;
    const show = el && t < p.bubbleUntil;
    if (el) el.classList.toggle('show', !!show);
    if (!show && !p.tagEl) continue;
    p.headWorld(v3).project(camera);
    const x = (v3.x * 0.5 + 0.5) * w;
    const y = (-v3.y * 0.5 + 0.5) * h;
    const behind = v3.z > 1;
    if (show) {
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      el.style.visibility = behind ? 'hidden' : 'visible';
    }
    if (p.tagEl) {
      p.tagEl.style.transform = `translate(${x}px, ${y - (show ? 34 : 0)}px) translate(-50%, -100%)`;
      p.tagEl.style.visibility = behind ? 'hidden' : 'visible';
    }
  }
}

updateCount();
updateMeter();
updateBossUI();
frame();

// 글꼴을 받은 뒤 간판을 다시 그린다
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('150px "Nanum Pen Script"'), document.fonts.load('34px "Gowun Dodum"')])
    .then(() => W.redrawSign())
    .catch(() => {});
}

// 확인용. 주소에 ?debug 를 붙였을 때만 연다
if (QS.has('debug')) window.__pungsok = { me, people, W, tableCheers, server, camera, controls, npcs, seated, noBloom: () => (bloom.enabled = false), renderer, goTo, orderFor: (kind) => server.jobs.push({ table: me.seat.table, kind }), startParty, getParty: () => party, boss, setBossMood, pokeBoss, startJinsang, getKick: () => kick, bartender, startSlap, startBeat, goEomuk, beginDate, getDate: () => date, pickKick, getKickChoice: () => kickChoice, getKnockout: () => knockout, beginWoo, getWoo: () => woo, FUNG, startTease, sorryPungsun, getPSulk: () => pSulk, hdBegin, getHd: () => hd, heedong, isComfortDue: () => comfortDue, enterTennis, leaveTennis, tennis, doubles, getTL: () => TL, openLobby, hostStart, joinSlot, enterDoubles, getTennisMode: () => tennisMode, getBrawl: () => brawl, isTennis: () => tennisOn, stats, tableGames, games, applyBan, runPuke, getNausea: () => nausea, myLookIdx: () => myLookIdx, peers, isHost, getRoom: () => ROOM, getRoam: () => roam, freezeCam: () => (camFollow = false), setCam: (tx, ty, tz, cx, cy, cz) => { camFollow = false; controls.minDistance = 0.5; controls.target.set(tx, ty, tz); lastTarget.copy(controls.target); camera.position.set(cx, cy, cz); }, sound, SERVER_HOME, step: (n) => { for (let i = 0; i < n; i++) tick(1 / 30); } };
