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

// 테이블별 손님 수. 3번 테이블은 비워 둔다. 같이 놀기에서는 실제로 들어온 사람만 있다
const FILL = MULTI ? [0, 0, 0, 0, 0, 0] : [3, 2, 4, 0, 2, 2];
let li = 0;
W.tables.forEach((T, ti) => {
  const seats = T.seats.slice().sort(() => Math.random() - 0.5);
  for (let k = 0; k < FILL[ti]; k++) {
    const p = addPerson({ ...LOOKS[li % LOOKS.length], name: NAMES[li % NAMES.length] });
    li++;
    p.sitAt(seats[k]);
    p.drinks = (Math.random() * 5) | 0;
    p.timer = rnd(1, 7);
    npcs.push(p);
  }
  if (FILL[ti]) {
    const kinds = MENU.map((m) => m.kind).sort(() => Math.random() - 0.5);
    for (let k = 0; k < 2 + (Math.random() < 0.5 ? 1 : 0); k++) placeDish(W, scene, T, kinds[k]);
    placeBottles(scene, T, 1 + ((Math.random() * 3) | 0));
  }
});

// 같이 놀 때는 아이디로 생김새를 정해서 모두에게 같게 보인다
function lookFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LOOKS[h % LOOKS.length];
}

// 나
const me = addPerson(MULTI ? { ...lookFor(MY_ID) } : { hair: 0x3a2418, style: 'bob', shirt: 0xf3d36b, pants: 0x34465a });
me.isMe = true;
me.root.position.set(0, 0, 6.2);
me.yaw = me.targetYaw = Math.PI;

// 점원 둘. 바 안의 사장님, 서빙하는 직원
const bartender = addPerson({ hair: 0x1c1512, style: 'short', shirt: 0xf1ede4, pants: 0x2a2a2a, staff: true });
const BAR_HOME = { x: 0.6, y: 0.32, z: -6.4 };
bartender.root.position.set(BAR_HOME.x, BAR_HOME.y, BAR_HOME.z);
bartender.baseY = BAR_HOME.y;
bartender.timer = 6;
// 알바생 조풍순(29). 올드한 술집 마담 차림에 화장이 아주 진하다
const server = addPerson({
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
});
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
    who: p.isMe ? '나' : p === bartender ? '사장님' : p.name || '손님',
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

const PUNGSUN_TAP = ['어머~ 풍순이 불렀어요? 호호', '오빠 오늘 멋지다~ 찡긋', '주문은 아래 버튼으로 해요~ 호호', '어머 손님, 풍순이한테 반했죠?'];
const PUNGSUN_IDLE = ['어머~ 오늘 손님 많네', '호호호', '풍순이 오늘 화장 좀 됐죠?', '언니 오빠들 천천히 드세요~'];
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
  if (p.isMe) updateMeter();
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
    say(p, pick(CHAT));
    const mates = seated(p.seat.table).filter((q) => q !== p && !q.isMe && !q.remote);
    if (mates.length && Math.random() < 0.6) later(1.6, () => {
      const q = pick(mates);
      if (!q.action) {
        q.do('laugh');
        say(q, pick(REPLY), 1.8);
      }
    });
  } else if (r < 0.52) {
    p.do('anju');
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
const FLIRT = ['오빠~ 한 잔 더 하실래요? 호호', '어머~ 오늘 왜 이렇게 멋있어요~', '풍순이 보러 또 와야 돼요~ 알았죠?', '언니 피부 진짜 좋다~ 호호', '이 안주 풍순이 추천이에요~ 찡긋', '나 오늘 예뻐요? 호호호'];
const FLIRT_BACK = ['ㅎㅎ...네', '어, 어...', '풍순씨 오늘 왜 이래요ㅋㅋ', '한 잔 더 주세요!', '아 부끄럽네...'];
let roam = null;

// 같이 놀 때는 직원 행동을 방장 한 명만 정하고 신호로 나머지에게 알린다
const decides = () => !MULTI || isHost();

function pungsunIdle(dt) {
  if (roam) return roamUpdate();
  if (!decides()) return;
  if (server.job || server.jobs.length || server.state !== 'stand' || server.action) return;
  server.idleT = (server.idleT ?? rnd(4, 8)) - dt;
  if (server.idleT > 0) return;
  server.idleT = rnd(8, 14);
  if (Math.random() < 0.75 && goFlirt()) return;
  staffDo(server, 'hairflip', pick(PUNGSUN_IDLE), 2.2);
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
    const f = R.pending || { act: pick(['wink', 'aegyo', 'hairflip']), line: pick(FLIRT) };
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
    if (R.visits < 3 && Math.random() < 0.6 && goFlirt(R.T)) return;
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
  if (roam && server.jobs.length) {
    roam = null;
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
      placeDish(W, scene, job.table, job.kind);
      sound.pop();
      const name = MENU.find((m) => m.kind === job.kind).name;
      say(server, `${name} 나왔어요~ 호호`, 2.2);
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
  if (party || kick || !decides()) return;
  bartender.timer -= dt;
  if (bartender.timer < 0 && !bartender.action) {
    bartender.timer = rnd(8, 16);
    if (boss.sulky) {
      bartender.timer = rnd(5, 9);
      staffDo(bartender, 'humph', pick(SASS), 2, Math.random() < 0.5);
    } else if (Math.random() < 0.5) {
      staffDo(bartender, 'wave', pick(['어서오세요~', '편하게 계세요', '오늘 밤도 좋네요']), 2);
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

// 주문이 들어오면 사장님이 자기 바 위로 올라가 팔을 ㄴ 자로 흔들며 환호한다
const COUNTER = { y: 1.13, z: -5.75 };
let party = null;
const CHEER_BACK = ['사장님 최고!', '와아아~', 'ㅋㅋㅋㅋ 뭐야', '앵콜!', '예에에~'];

function startParty(T) {
  // 진상 손님을 내보내는 중이면 환호는 건너뛴다
  if (party || kick) return;
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
    later(1.4, () => say(server, '어머 사장님 또 시작이시네~ 호호', 2.2));
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
const bossBusy = () => party || kick;

function setBossMood(v) {
  boss.mood = THREE.MathUtils.clamp(v, 0, 100);
  updateBossUI();
  if (!boss.sulky && boss.mood <= 0) startSulk();
  else if (boss.sulky && boss.mood >= 50) endSulk();
}

function updateBossUI() {
  const fill = $('#bossFill');
  fill.style.width = boss.mood + '%';
  fill.classList.toggle('low', boss.mood < 35);
  $('#bossState').textContent = boss.sulky ? '삐짐' : boss.mood > 70 ? '좋음' : boss.mood > 35 ? '보통' : '언짢음';
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

function startJinsang() {
  const lv = simT - (me.jinAt ?? -1e9) < ANGER_KEEP ? Math.min(3, (me.jinLv || 0) + 1) : 1;
  me.jinAt = simT;
  // 쫓겨나면 다음 진상은 다시 1단계부터
  me.jinLv = lv === 3 ? 0 : lv;
  me.path = [];
  if (me.state === 'walk') me.state = 'stand';
  me.do('tantrum');
  meSay(pick(JINSANG), 2.4, true);
  send('jinsang', { lv });
  if (lv === 3) {
    me.locked = true;
    me.lockedAt = simT;
  } else later(1.2, () => toast(lv === 1 ? '사장님이 눈치를 줘요 (화남 1/3)' : '사장님 표정이 굳었어요 (화남 2/3) 한 번 더 하면 쫓겨나요'));
  jinsangEffects(me, lv);
}

// 진상 부린 사람이 누구든 가게 쪽 반응은 같다
function jinsangEffects(p, lv = 3) {
  sound.bang();
  // 가까운 손님들이 놀란다
  npcs
    .filter((q) => q.pos.distanceTo(p.pos) < 4)
    .slice(0, 4)
    .forEach((q, i) => later(0.7 + i * 0.3, () => say(q, pick(SHOCK), 1.8)));
  if (lv < 3) {
    later(0.9, () => bossWarn(p, lv));
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
function bossWarn(p, lv) {
  const b = bartender;
  // 경고하는 동안에는 평소 혼잣말을 하지 않는다
  b.timer = Math.max(b.timer, 6);
  // 그 손님 테이블 수다방에도 남긴다
  b.chatTable = p.seat ? p.seat.table : null;
  b.faceMood = lv === 1 ? 'annoyed' : 'serious';
  say(b, pick(WARN[lv - 1]), 2.6, lv === 2);
  if (!bossBusy() && b.state === 'stand') {
    faceBossTo(p);
    if (lv === 2) b.do('warn');
  }
  if (lv === 2) sound.humph();
  later(3.2, restoreBossFace);
}

// 3단계. 핏대 세우고 부들부들 떤 뒤 뛰어나간다
function bossRage(p) {
  const b = bartender;
  b.timer = Math.max(b.timer, 6);
  b.chatTable = p.seat ? p.seat.table : null;
  b.faceMood = 'fury';
  say(b, '...하.', 1.2);
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
  kick = K.again && !kickGone(K) ? { target: K.target, phase: 'wait' } : kickQueue.length ? { target: kickQueue.shift(), phase: 'wait' } : null;
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
  if (K.phase === 'wait') {
    // 바 위에서 춤추던 중이면 바로 멈추고 거기서 앞으로 뛰어내린다
    if (party) {
      if (party.phase === 'dance') {
        party = null;
        b.action = null;
        b.faceMood = 'fury';
        say(b, '손님!!', 1.6, true);
        K.phase = 'overUp';
      }
      return;
    }
    if (b.state !== 'stand' || (b.action && b.action.type === 'rage')) return;
    if (kickGone(K)) return finishKick(K);
    b.action = null;
    b.faceMood = 'fury';
    b.hopTo(BAR_HOME.x, COUNTER.y, COUNTER.z, 0.45, 0.8);
    say(b, '손님!!', 1.6, true);
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
    b.faceMood = 'fury';
    b.do('stop');
    say(b, '나가주세요!', 2.6, true);
    later(1.5, () => kickOut(t));
    K.phase = 'stop';
  } else if (K.phase === 'stop' && !b.action) {
    walkBossHome(K);
  } else if (K.phase === 'back' && K.again && !kickGone(K)) {
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

function kickOut(t) {
  if (t === me) return kickOutMe();
  if (!people.includes(t)) return;
  // 다른 사람은 그 사람 화면에서도 똑같이 나가고, 위치는 접속 신호로 맞춰진다
  t.action = null;
  t.faceMood = 'sad';
  t.walkTo(planPath(t.seat ? seatFront(t.seat) : t.pos, EXIT, W.obstacles));
  t.kickedOut = true;
}

function kickOutMe() {
  me.action = null;
  me.faceMood = 'sad';
  meSay('...네.', 1.8);
  me.walkTo(planPath(me.seat ? seatFront(me.seat) : me.pos, EXIT, W.obstacles));
  me.kickedOut = true;
  npcs
    .filter((q) => q.pos.distanceTo(me.pos) < 5)
    .slice(0, 3)
    .forEach((q, i) => later(1.0 + i * 0.4, () => {
      say(q, pick(BYE), 1.8);
      if (!q.action) q.do('laugh');
    }));
}

// 의자에서 일어난 자리. walkTo 가 일으켜 세우기 전에 길을 계산하려고 쓴다
function seatFront(s) {
  return { x: s.x - Math.sin(s.yaw) * 0.35, z: s.z - Math.cos(s.yaw) * 0.35 };
}

function meUpdate() {
  // 안전장치. 진상 뒤에 사장님 일이 하나도 없으면 다시 부른다
  if (me.locked && !me.kickedOut && !kickPendingFor(me) && simT - (me.lockedAt || 0) > 3) requestKick(me);
  if (me.kickedOut && me.state === 'stand') {
    me.kickedOut = false;
    me.locked = false;
    me.faceMood = null;
    me.targetYaw = Math.PI;
    toast('쫓겨났어요... 빈 의자를 누르면 다시 들어갈 수 있어요');
  }
  // 다른 사람이 쫓겨나 밖에 도착하면 표정을 되돌린다
  for (const r of peers.values()) {
    if (r.p.kickedOut && r.p.state === 'stand') {
      r.p.kickedOut = false;
      r.p.faceMood = null;
    }
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
  if (me.drinks >= 8) {
    meSay('오늘은 물만 마실래...', 2);
    toast('취기가 가득 찼어요. 잠깐 쉬면 줄어들어요');
    return;
  }
  me.do('oneshot');
  send('act', { a: 'oneshot' });
  later(0.55, () => sound.gulp());
};
$('#bAnju').onclick = () => {
  if (blocked() || me.action || needSeat()) return;
  if (!me.seat.table.dishes.length) {
    toast('테이블에 안주가 없어요. 주문해 보세요');
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
  $('#chatFold').textContent = fold ? '+' : '−';
}
$('#chatFold').onclick = () => setFold(!chatBox.classList.contains('fold'));
function sendChat(e) {
  e && e.preventDefault();
  const text = chatInput.value.trim().slice(0, 40);
  chatInput.value = '';
  if (!text) return;
  if (blocked()) return;
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
    toast(`${b.dataset.name} 주문했어요`);
    send('order', { tid: me.seat.table.id, kind: b.dataset.kind });
    acceptOrder(me.seat.table, b.dataset.kind);
  };
});

// 주문 받기. 내 주문이든 친구 주문이든 똑같이 서빙하고 환호한다
function acceptOrder(T, kind) {
  server.jobs.push({ table: T, kind });
  sound.bell();
  if (!bossBusy()) {
    say(bartender, '네~ 주문 받았습니다!', 2);
    bartender.do('wave');
    later(1.2, () => startParty(T));
  }
}

const soundBtn = $('#bSound');
soundBtn.onclick = () => {
  sound.start();
  sound.setOn(!sound.on);
  soundBtn.classList.toggle('off', !sound.on);
};
$('#bJinsang').onclick = () => {
  if (blocked() || me.action) return;
  startJinsang();
};
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
    startNet();
  }
  sound.start();
  $('#intro').classList.add('hide');
  $('#chat').hidden = false;
  setTimeout(() => toast('빈 의자를 누르면 앉고, 바닥을 누르면 걸어가요'), 600);
};

// 누르기. 끌어서 돌린 것은 무시한다
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 500;
  down = null;
  if (moved > 8 || !quick) return;
  sound.start();
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
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  // 세로 화면은 조금 멀리서 본다
  camera.fov = w < h ? 52 : 40;
  camera.updateProjectionMatrix();
  W.setPixelScale(((h * DPR) / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 0.01);
}
window.addEventListener('resize', resize);
resize();

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
const ROOM = MULTI ? roomFromHash() : '';

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

// 방 코드는 주소 # 뒤에 둔다. 없으면 새로 만든다
function roomFromHash() {
  let c = location.hash.slice(1).toLowerCase();
  if (!/^[a-z0-9-]{3,24}$/.test(c)) {
    c = Math.random().toString(36).slice(2, 8);
    history.replaceState(null, '', location.pathname + location.search + '#' + c);
  }
  return c;
}

// 방장. 가장 먼저 들어온 사람(같으면 아이디 순)
function isHost() {
  if (!MULTI) return true;
  for (const r of peers.values()) {
    if (r.joinedAt < joinedAt || (r.joinedAt === joinedAt && r.id < MY_ID)) return false;
  }
  return true;
}

function updateCount() {
  $('#count').textContent = `손님 ${(MULTI ? peers.size : npcs.length) + 1}명`;
}

function logSystem(text) {
  pushRoom(rooms.all, { who: '', role: ' sys', text }, viewRoom === 'all');
}

function startNet() {
  joinedAt = Date.now();
  net = createNet({ url: NET_URL, key: NET_KEY, room: ROOM, local: LOCAL_NET, onMessage: onNet, onStatus: onNetStatus });
  setInterval(heartbeat, HEARTBEAT_MS);
  window.addEventListener('pagehide', () => send('bye'));
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
  send('hi', { n: myName, j: joinedAt, x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2), s: seatKey(me.seat), dr: me.drinks });
  // 방장은 6초마다 사장님 기분을 맞춰 준다
  if (++hbCount % 3 === 0 && isHost()) send('boss', { m: Math.round(boss.mood), s: boss.sulky });
}

function ensurePeer(id, d) {
  let r = peers.get(id);
  if (!r) {
    const p = addPerson({ ...lookFor(id), name: (d.n || '손님').slice(0, 8) });
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
  if (p.state === 'hop' || p.kickedOut) return;
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
  send('snap', { to, dishes: W.tables.map((T) => T.dishes.map((x) => x.kind)), m: Math.round(boss.mood), s: boss.sulky });
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
  if (m.t === 'hi') return applyHi(ensurePeer(m.f, d), d);
  // 직원 신호와 늦게 온 사람용 상태는 보낸 사람을 몰라도 받는다
  if (m.t === 'snap') {
    if (d.to !== MY_ID || snapDone) return;
    snapDone = true;
    (d.dishes || []).forEach((kinds, ti) => {
      const T = W.tables[ti];
      if (T && !T.dishes.length) kinds.forEach((k) => placeDish(W, scene, T, k));
    });
    return syncBoss(d.m, d.s);
  }
  if (m.t === 'staff') return staffDo(d.w === 's' ? server : bartender, d.a, d.l, d.d, d.h, true);
  if (m.t === 'roamGo') return !decides() && W.tables[d.tid] && roamTo(W.tables[d.tid]);
  if (m.t === 'roamFlirt') return !decides() && roam && (roam.pending = { act: d.act, line: d.line });
  if (m.t === 'roamHome') return !decides() && roamHome();
  if (m.t === 'boss') return !isHost() && syncBoss(d.m, d.s);
  if (m.t === 'poke') return pokeBoss(true);
  if (m.t === 'order') return W.tables[d.tid] && acceptOrder(W.tables[d.tid], d.kind);
  // 나머지는 그 사람 캐릭터가 하는 일
  const r = peers.get(m.f);
  if (!r) return;
  const p = r.p;
  if (m.t === 'go') {
    if (!p.kickedOut) walkPeer(p, { x: d.x, z: d.z }, seatFromKey(d.s));
  } else if (m.t === 'say') say(p, String(d.t).slice(0, 40), 3, !!d.b);
  else if (m.t === 'act') remoteAct(p, d.a);
  else if (m.t === 'jinsang') {
    p.path = [];
    if (p.state === 'walk') p.state = 'stand';
    p.do('tantrum');
    jinsangEffects(p, Math.min(3, Math.max(1, d.lv | 0 || 3)));
  }
}

// 입장 화면. 같이 놀 때는 이름과 방 코드, 초대 링크 복사를 보여 준다
if (MULTI) {
  $('#multiBox').hidden = false;
  $('#bInvite').hidden = false;
  $('#roomCode').textContent = ROOM;
  try {
    $('#nameInput').value = localStorage.getItem('pungsok-name') || '';
  } catch (e) {}
  $('#nameInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#enter').click());
  // 방 코드가 바뀌면 그 방으로 다시 들어간다
  window.addEventListener('hashchange', () => location.reload());
}
async function copyInvite() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('초대 링크를 복사했어요. 친구에게 보내 주세요');
  } catch (e) {
    toast('주소창의 링크를 복사해서 친구에게 보내 주세요');
  }
}
$('#copyLink').onclick = copyInvite;
$('#bInvite').onclick = copyInvite;

// 사장님 기분은 조금씩 회복된다. 삐졌을 때는 더 천천히
let regenAcc = 0;
function bossRegen(dt) {
  regenAcc += dt;
  if (regenAcc < 1) return;
  regenAcc = 0;
  if (boss.mood < 100) setBossMood(boss.mood + (boss.sulky ? 1 : 2));
}

let simT = 0;
let camFollow = true;
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
  serverUpdate();
  pungsunIdle(dt);
  partyUpdate();
  kickUpdate();
  meUpdate();
  if (MULTI) dropSilentPeers();
  syncChatRoom();
  bossRegen(dt);
  bartenderUpdate(dt);
  for (const p of people) p.update(dt, p === bartender ? null : W.obstacles, p === bartender ? null : p === me || p.remote ? ME_BOUNDS : W.bounds);
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

  // 카메라가 나를 천천히 따라온다
  camGoal.set(me.pos.x * 0.5, 0.5, me.pos.z * 0.4 - 1.4);
  if (camReset) {
    const off = camera.position.clone().sub(controls.target);
    const want = CAM_OFFSET.clone().normalize().multiplyScalar(CAM_OFFSET.length());
    off.lerp(want, 1 - Math.exp(-dt * 4));
    camera.position.copy(controls.target).add(off);
    if (off.distanceTo(want) < 0.05) camReset = false;
  }
  if (camFollow) controls.target.lerp(camGoal, 1 - Math.exp(-dt * 1.8));
  camera.position.add(v3.copy(controls.target).sub(lastTarget));
  lastTarget.copy(controls.target);
  controls.update();
  // 많이 마시면 화면이 살짝 흔들린다
  if (me.blush >= 3) camera.rotateZ(Math.sin(t * 0.9) * 0.012);
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
if (QS.has('debug')) window.__pungsok = { me, people, W, tableCheers, server, camera, controls, npcs, seated, noBloom: () => (bloom.enabled = false), renderer, goTo, orderFor: (kind) => server.jobs.push({ table: me.seat.table, kind }), startParty, getParty: () => party, boss, setBossMood, pokeBoss, startJinsang, getKick: () => kick, bartender, peers, isHost, getRoom: () => ROOM, getRoam: () => roam, freezeCam: () => (camFollow = false), setCam: (tx, ty, tz, cx, cy, cz) => { camFollow = false; controls.minDistance = 0.5; controls.target.set(tx, ty, tz); lastTarget.copy(controls.target); camera.position.set(cx, cy, cz); }, sound, SERVER_HOME, step: (n) => { for (let i = 0; i < n; i++) tick(1 / 30); } };
