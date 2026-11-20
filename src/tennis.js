// 테니스 미니게임. 나 혼자 풍순이와 한 게임(15-30-40, 듀스 있음)
// 내 캐릭터는 공을 따라 저절로 움직이고, 공이 올 때 스윙을 누르는 타이밍 게임이다
// 타이밍이 이르면 왼쪽, 늦으면 오른쪽으로 가고, 딱 맞으면 강하게 나간다
import * as THREE from 'three';
import { Person } from './person.js';

const POINTS = ['0', '15', '30', '40'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

const HIT_U = 0.98; // 공이 치는 자리에 오는 시점
const WINDOW = 0.12; // 이만큼 앞뒤로는 칠 수 있다
const PERFECT = 0.04;

export function createTennis({ scene, court, sound, playerOpts, cpuOpts, ui, onEnd }) {
  const C = court.c;
  const HW = court.hw;
  const PZ = C.z + 5.4;
  const CZ = C.z - 5.4;

  const player = new Person({ ...playerOpts });
  const cpu = new Person({ ...cpuOpts });
  player.holdRacket();
  cpu.holdRacket();
  player.speed = 5;
  cpu.speed = 4.6;
  scene.add(player.root, cpu.root);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8f24a, roughness: 0.6, emissive: 0x334400 }));
  ball.castShadow = true;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(ball, shadow);

  let S = null;
  const timers = [];

  function reset() {
    player.root.position.set(C.x + 0.6, 0, PZ);
    cpu.root.position.set(C.x - 0.6, 0, CZ);
    player.path = [];
    cpu.path = [];
    player.state = cpu.state = 'stand';
    player.yaw = player.targetYaw = Math.PI;
    cpu.yaw = cpu.targetYaw = 0;
  }

  function setVisible(v) {
    player.root.visible = cpu.root.visible = ball.visible = shadow.visible = v;
  }
  setVisible(false);

  function start() {
    timers.length = 0;
    setVisible(true);
    reset();
    S = { p: 0, c: 0, server: 'p', phase: 'serve', shot: null, rally: 0, t: 0, swingCd: 0, until: 0, msgUntil: 0 };
    ui.score(scoreText());
    say('풍순', '어머~ 테니스 쳐요? 풍순이 봐주지 않아요~ 호호');
    serveReady();
  }

  function say(who, text) {
    ui.msg(who ? `${who}: ${text}` : text);
  }

  function serveReady() {
    S.phase = 'serve';
    S.shot = null;
    S.rally = 0;
    ball.visible = true;
    if (S.server === 'p') {
      ui.hint('스윙 버튼(또는 화면 누르기, 스페이스)으로 서브!');
      placeBallAt(player, 1.1);
    } else {
      ui.hint('풍순이 서브!');
      placeBallAt(cpu, 1.1);
      S.until = S.t + 1.3;
    }
  }

  function placeBallAt(p, h) {
    ball.position.set(p.pos.x + 0.25, h, p.pos.z + (p === player ? -0.3 : 0.3));
  }

  // 공 보내기. side 는 공이 가는 쪽(p 나, c 풍순이)
  function shoot(fromX, fromZ, toX, side, dur, strong = false) {
    const toZ = side === 'p' ? PZ : CZ;
    S.shot = { fx: fromX, fz: fromZ, tx: THREE.MathUtils.clamp(toX, C.x - HW + 0.2, C.x + HW - 0.2), tz: toZ, u: 0, dur, side, strong, peak: rnd(0.9, 1.3), bounced: false, decided: false };
    S.rally++;
    S.phase = 'rally';
  }

  function shotPos(sh, u) {
    const x = sh.fx + (sh.tx - sh.fx) * u;
    const z = sh.fz + (sh.tz - sh.fz) * u;
    const bu = 0.62;
    let h;
    if (u < bu) h = 1.0 * (1 - u / bu) + Math.sin((Math.PI * u) / bu) * sh.peak;
    else h = Math.max(0, Math.sin(Math.PI * Math.min(1, (u - bu) / (1.42 - bu)))) * 0.9;
    return { x, z, h };
  }

  function point(winner, text) {
    if (S.phase === 'point' || S.phase === 'over') return;
    if (winner === 'p') S.p++;
    else S.c++;
    S.phase = 'point';
    S.until = S.t + 1.6;
    say('', text);
    ui.score(scoreText());
    const done = (S.p >= 4 || S.c >= 4) && Math.abs(S.p - S.c) >= 2;
    if (done) {
      const win = S.p > S.c;
      S.phase = 'over';
      S.until = S.t + 1.8;
      S.win = win;
      ui.score(win ? '게임! 내가 이겼어요' : '게임! 풍순이 승리');
      say('풍순', win ? '어머~ 오빠 테니스 왜 이렇게 잘 쳐~ 반하겠다~' : '호호호~ 풍순이 승리! 벌칙으로 원샷이에요~');
      if (win) player.do('wave');
      else cpu.do('aegyo');
      return;
    }
    const cpuLine = winner === 'p' ? pick(['어머머! 잘 치네~', '에잇! 다시!', '풍순이 방심했다~']) : pick(['어머~ 그것도 못 받아요? 호호', '풍순이 테니스 좀 쳐요~', '아웃~ 아니 내 점수~']);
    later(0.7, () => say('풍순', cpuLine));
  }

  function later(sec, fn) {
    timers.push({ at: S.t + sec, fn });
  }

  function scoreText() {
    const { p, c } = S;
    if (p >= 3 && c >= 3) {
      if (p === c) return '듀스';
      if (Math.abs(p - c) === 1) return p > c ? '어드밴티지 나' : '어드밴티지 풍순';
    }
    return `나 ${POINTS[Math.min(3, p)]} : ${POINTS[Math.min(3, c)]} 풍순`;
  }

  // 스윙 버튼
  function swing() {
    if (!S || S.swingCd > 0) return;
    S.swingCd = 0.35;
    player.do('swing');
    if (S.phase === 'serve' && S.server === 'p') {
      sound.thwack(false);
      shoot(player.pos.x, player.pos.z - 0.3, C.x + rnd(-2.2, 2.2), 'c', 1.3);
      ui.hint('');
      return;
    }
    const sh = S.shot;
    if (S.phase !== 'rally' || !sh || sh.side !== 'p' || sh.hit) return;
    const e = sh.u - HIT_U;
    const reach = Math.abs(player.pos.x - shotPos(sh, HIT_U).x) < 0.95;
    if (Math.abs(e) > WINDOW || !reach) {
      say('', Math.abs(e) > WINDOW ? (e < 0 ? '너무 빨라요!' : '너무 늦어요!') : '안 닿아요!');
      return;
    }
    sh.hit = true;
    const perfect = Math.abs(e) < PERFECT;
    // 이르면 왼쪽, 늦으면 오른쪽
    const aim = C.x + THREE.MathUtils.clamp(e * 16 + rnd(-0.9, 0.9), -2.7, 2.7);
    const dur = Math.max(0.72, 1.25 - S.rally * 0.03) * (perfect ? 0.8 : 1);
    sound.thwack(perfect);
    if (perfect) say('', '나이스 샷!');
    const p = shotPos(sh, sh.u);
    shoot(p.x, p.z, aim, 'c', dur, perfect);
  }

  function update(dt) {
    if (!S) return;
    S.t += dt;
    S.swingCd = Math.max(0, S.swingCd - dt);
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= S.t) timers.splice(i, 1)[0].fn();
    }

    if (S.phase === 'serve' && S.server === 'c' && S.t >= S.until) {
      cpu.do('swing');
      sound.thwack(false);
      shoot(cpu.pos.x, cpu.pos.z + 0.3, C.x + rnd(-2.2, 2.2), 'p', 1.35);
      ui.hint('공이 오면 스윙!');
    }

    const sh = S.shot;
    if (S.phase === 'rally' && sh) {
      const prevU = sh.u;
      sh.u += dt / sh.dur;
      const p = shotPos(sh, sh.u);
      ball.position.set(p.x, p.h + 0.075, p.z);
      if (!sh.bounced && sh.u >= 0.62) {
        sh.bounced = true;
        sound.bounce();
      }
      // 풍순이가 받을지 정한다
      if (sh.side === 'c' && !sh.decided && sh.u >= HIT_U) {
        sh.decided = true;
        const reach = Math.abs(cpu.pos.x - p.x) < 0.85;
        const chance = reach ? THREE.MathUtils.clamp(0.9 - S.rally * 0.035 - (sh.strong ? 0.3 : 0), 0.3, 0.9) : 0;
        if (Math.random() < chance) {
          cpu.do('swing');
          sound.thwack(false);
          const wide = Math.random() < 0.25;
          const aim = C.x + (wide ? Math.sign(Math.random() - 0.5) * rnd(2.3, 2.8) : rnd(-2, 2));
          shoot(p.x, p.z, aim, 'p', Math.max(0.72, 1.3 - S.rally * 0.03) * (wide ? 0.9 : 1));
        } else if (reach && Math.random() < 0.5) {
          // 받긴 했는데 네트에 걸림
          cpu.do('swing');
          sound.thwack(false);
          S.shot = { fx: p.x, fz: p.z, tx: p.x, tz: C.z - 0.05, u: 0, dur: 0.5, side: 'net', peak: 0.2, bounced: true, decided: true };
          later(0.5, () => point('p', '풍순이 네트에 걸렸어요!'));
        } else {
          cpu.do('swing');
          later(0.3, () => point('p', '풍순이 헛스윙!'));
        }
      }
      if (sh.side === 'p' && !sh.hit && sh.u > HIT_U + WINDOW + 0.06) point('c', '놓쳤어요!');
      if (sh.side === 'net' && sh.u >= 1) sh.u = 1;
      if (prevU > 1.5) S.shot = null;
    }

    if ((S.phase === 'point' || S.phase === 'over') && S.shot && S.shot.side !== 'net') {
      const s2 = S.shot;
      s2.u += dt / s2.dur;
      const p = shotPos(s2, s2.u);
      ball.position.set(p.x, p.h + 0.075, p.z);
    }
    if (S.phase === 'point' && S.t >= S.until) {
      S.server = S.server === 'p' ? 'c' : 'p';
      reset();
      serveReady();
    }
    if (S.phase === 'over' && S.t >= S.until) {
      S.phase = 'done';
      ui.over(S.win);
    }

    // 공을 따라 움직인다
    const target = (who, side) => {
      const s = S.shot;
      if (S.phase === 'rally' && s && s.side === side) return shotPos(s, HIT_U).x - 0.25;
      return C.x + (who === player ? 0.4 : -0.4);
    };
    move(player, target(player, 'p'), PZ, Math.PI, dt);
    move(cpu, target(cpu, 'c'), CZ, 0, dt);

    ball.visible = S.phase !== 'done';
    shadow.visible = ball.visible;
    shadow.position.set(ball.position.x, C.y + 0.01, ball.position.z);
  }

  function move(p, x, z, face, dt) {
    if (Math.abs(p.pos.x - x) > 0.05) {
      p.path = [{ x, z }];
      p.state = 'walk';
      p.ease = false;
    }
    p.update(dt, null, null);
    p.yaw = p.targetYaw = face;
    p.root.rotation.y = face;
  }

  return {
    start,
    swing,
    update,
    setVisible,
    // 확인용
    get state() {
      return S;
    },
    get active() {
      return !!S && S.phase !== 'done';
    },
    setLook(look) {
      player.setLook(look);
    },
    stop() {
      S = null;
      setVisible(false);
    },
  };
}
