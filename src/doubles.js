// 테니스 복식(2대2). 같이 노는 친구들과 치고, 빈자리는 CPU 가 채운다
// 경기를 연 사람(호스트) 화면이 공 방향, CPU, 점수를 정해 신호로 보내고 나머지는 받은 대로 그린다
// 스윙 타이밍은 친 사람 화면에서 재서 보낸다. 통신이 늦어도 억울하지 않게
// 자리 번호: 0, 1 은 A팀(카메라 쪽), 2, 3 은 B팀. 짝수가 왼쪽, 홀수가 오른쪽
import * as THREE from 'three';
import { Person } from './person.js';

const POINTS = ['0', '15', '30', '40'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

const HIT_U = 0.98;
const WINDOW = 0.14;
const PERFECT = 0.045;
// 친구가 친 신호가 늦게 와도 이만큼(초)은 기다려 준다
const GRACE = 0.35;
// 서브 순서. A팀, B팀이 번갈아
const SERVE_ORDER = [0, 2, 1, 3];
const team = (i) => (i < 2 ? 0 : 1);

export function createDoubles({ scene, court, sound, ui, send }) {
  const C = court.c;
  const HW = court.hw;
  const ZA = C.z + 5.4;
  const ZB = C.z - 5.4;
  const HOME = [
    { x: C.x - 1.4, z: ZA },
    { x: C.x + 1.4, z: ZA },
    { x: C.x - 1.4, z: ZB },
    { x: C.x + 1.4, z: ZB },
  ];

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8f24a, roughness: 0.6, emissive: 0x334400 }));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  ball.visible = shadow.visible = false;
  scene.add(ball, shadow);

  let M = null;
  // 구경꾼. id → { p, tag }
  const watchers = new Map();

  // 머리 위 이름표
  function nameTag(text, mine) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 30px sans-serif';
    const w = Math.min(248, g.measureText(text).width + 28);
    g.fillStyle = mine ? 'rgba(255, 196, 120, 0.95)' : 'rgba(20, 14, 10, 0.75)';
    g.beginPath();
    g.roundRect((256 - w) / 2, 10, w, 44, 22);
    g.fill();
    g.fillStyle = mine ? '#3a2414' : '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(1.5, 0.375, 1);
    s.position.y = 1.5;
    s.renderOrder = 5;
    return s;
  }

  function addPerson(opts, name, mine) {
    const p = new Person({ ...opts });
    const tag = nameTag(name, mine);
    p.root.add(tag);
    scene.add(p.root);
    return { p, tag };
  }

  function removePerson(o) {
    scene.remove(o.p.root);
    o.tag.material.map.dispose();
    o.tag.material.dispose();
  }

  // 경기 준비. slots: [{ id, name, look, cpu }] 네 개, mine: 내 자리(-1 이면 구경), host: 내가 호스트인지
  function setup({ mid, slots, mine, host }) {
    stop();
    M = {
      mid,
      host,
      mine,
      slots: slots.map((s) => ({ ...s })),
      people: [],
      score: [0, 0],
      srvAt: 0,
      srv: 0,
      srvIdx: 0,
      phase: 'wait',
      shot: null,
      rally: 0,
      t: 0,
      until: 0,
      sid: 0,
      swingCd: 0,
      timers: [],
    };
    M.slots.forEach((s, i) => {
      const o = addPerson(s.look, s.name, i === mine);
      o.p.holdRacket();
      o.p.speed = 5;
      o.p.root.position.set(HOME[i].x, 0, HOME[i].z);
      o.p.yaw = o.p.targetYaw = team(i) === 0 ? Math.PI : 0;
      M.people.push(o);
    });
    ball.visible = shadow.visible = true;
    ball.position.set(C.x, 1, C.z);
    ui.score(scoreText());
  }

  function teamName(t) {
    return M.slots
      .filter((_, i) => team(i) === t)
      .map((s) => s.name)
      .join('·');
  }

  function scoreText() {
    const [a, b] = M.score;
    const A = teamName(0);
    const B = teamName(1);
    if (a >= 3 && b >= 3) {
      if (a === b) return `${A} 듀스 ${B}`;
      if (Math.abs(a - b) === 1) return `어드밴티지 ${a > b ? A : B}`;
    }
    return `${A} ${POINTS[Math.min(3, a)]} : ${POINTS[Math.min(3, b)]} ${B}`;
  }

  // 호스트가 정한 일을 모두에게 보내고 나도 똑같이 한다
  function emit(ev) {
    send({ ...ev, mid: M.mid });
    apply(ev);
  }

  function later(sec, fn) {
    M.timers.push({ at: M.t + sec, fn });
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

  // ---------- 모두에게 똑같이 일어나는 일 ----------
  function apply(ev) {
    if (!M) return;
    const P = (i) => M.people[i] && M.people[i].p;
    if (ev.k === 'serve') {
      M.phase = 'serve';
      M.srv = ev.slot;
      M.shot = null;
      M.rally = 0;
      M.people.forEach((o, i) => {
        o.p.root.position.set(HOME[i].x, 0, HOME[i].z);
        o.p.path = [];
        o.p.state = 'stand';
      });
      const s = P(ev.slot);
      if (s) ball.position.set(s.pos.x + 0.25, 1.1, s.pos.z + (team(ev.slot) === 0 ? -0.3 : 0.3));
      ui.hint(ev.slot === M.mine ? '서브! 스윙 버튼을 눌러요' : `${M.slots[ev.slot].name} 서브`);
      ui.score(scoreText());
      if (M.host) {
        // CPU 는 바로, 사람은 6초 안에 안 치면 대신 넣는다
        const at = M.slots[ev.slot].cpu ? 1.2 : 6;
        const n = ++M.srvAt;
        later(at, () => M.phase === 'serve' && M.srvAt === n && hostServe(ev.slot));
      }
    } else if (ev.k === 'shot') {
      M.phase = 'rally';
      M.rally = ev.rally;
      M.shot = { sid: ev.sid, by: ev.by, recv: ev.recv, fx: ev.fx, fz: ev.fz, tx: ev.tx, tz: ev.tz, dur: ev.dur, peak: ev.peak, strong: ev.strong, u: 0, bounced: false, decided: false, hit: false, hold: false };
      const b = P(ev.by);
      if (b && ev.by !== M.mine) b.do('swing');
      if (ev.by !== M.mine) sound.thwack(!!ev.strong);
      if (ev.strong) ui.msg(`${M.slots[ev.by].name} 나이스 샷!`);
      ui.hint(ev.recv === M.mine ? '공이 와요! 스윙!' : '');
    } else if (ev.k === 'net') {
      const b = P(ev.by);
      if (b && ev.by !== M.mine) b.do('swing');
      M.shot = { sid: -1, recv: -1, fx: ev.fx, fz: ev.fz, tx: ev.fx, tz: C.z + (team(ev.by) === 0 ? 0.05 : -0.05), dur: 0.5, peak: 0.2, u: 0, bounced: true, decided: true, hit: true, hold: false, net: true };
      M.phase = 'dead';
    } else if (ev.k === 'point' || ev.k === 'over') {
      M.score = ev.score.slice();
      if (M.shot && !M.shot.net) M.shot.decided = true;
      M.phase = ev.k === 'over' ? 'over' : 'point';
      ui.msg(ev.text);
      ui.hint('');
      ui.score(ev.k === 'over' ? `게임! ${teamName(ev.win)} 승리` : scoreText());
      if (ev.k === 'over') {
        M.until = M.t + 1.8;
        M.win = ev.win;
        M.people.forEach((o, i) => o.p.do(team(i) === ev.win ? 'wave' : 'humph'));
      }
    } else if (ev.k === 'cpu') {
      // 나간 사람 자리는 CPU 가 이어서 친다
      const s = M.slots[ev.slot];
      if (s && !s.cpu) {
        s.cpu = true;
        s.name += '(CPU)';
        if (ev.slot === M.mine) M.mine = -1;
        ui.score(scoreText());
      }
    } else if (ev.k === 'end') {
      M.phase = 'done';
      ui.hint('');
      ui.over(-1);
    }
  }

  // ---------- 호스트만 하는 일 ----------
  function hostServe(slot) {
    if (!M || M.phase !== 'serve' || M.srv !== slot) return;
    const p = M.people[slot].p;
    const t = team(slot);
    const fz = p.pos.z + (t === 0 ? -0.3 : 0.3);
    shoot(slot, p.pos.x, fz, C.x + rnd(-2.2, 2.2), 1.3, false);
  }

  function shoot(by, fx, fz, tx, dur, strong) {
    const to = 1 - team(by);
    tx = THREE.MathUtils.clamp(tx, C.x - HW + 0.2, C.x + HW - 0.2);
    // 공이 떨어지는 쪽에 선 사람이 받는다
    const recv = to * 2 + (tx < C.x ? 0 : 1);
    emit({ k: 'shot', sid: ++M.sid, by, recv, fx, fz, tx, tz: to === 0 ? ZA : ZB, dur, peak: +rnd(0.9, 1.3).toFixed(2), strong, rally: M.rally + 1 });
  }

  function hostReturn(slot, sid, e) {
    const sh = M.shot;
    if (!sh || M.phase !== 'rally' || sh.sid !== sid || sh.recv !== slot || sh.decided) return;
    sh.decided = true;
    const perfect = Math.abs(e) < PERFECT;
    const p = shotPos(sh, HIT_U + e);
    const aim = C.x + THREE.MathUtils.clamp(e * 16 + rnd(-1.1, 1.1), -2.7, 2.7);
    const dur = Math.max(0.72, 1.25 - M.rally * 0.03) * (perfect ? 0.8 : 1);
    shoot(slot, p.x, p.z, aim, dur, perfect);
  }

  function hostCpu(sh) {
    sh.decided = true;
    const p = shotPos(sh, HIT_U);
    const chance = THREE.MathUtils.clamp(0.88 - M.rally * 0.035 - (sh.strong ? 0.3 : 0), 0.3, 0.88);
    if (Math.random() < chance) {
      const wide = Math.random() < 0.25;
      const aim = C.x + (wide ? Math.sign(Math.random() - 0.5) * rnd(2.3, 2.8) : rnd(-2, 2));
      shoot(sh.recv, p.x, p.z, aim, Math.max(0.72, 1.3 - M.rally * 0.03) * (wide ? 0.9 : 1), false);
    } else if (Math.random() < 0.5) {
      emit({ k: 'net', by: sh.recv, fx: p.x, fz: p.z });
      later(0.5, () => hostPoint(1 - team(sh.recv), `${M.slots[sh.recv].name} 네트에 걸렸어요!`));
    } else {
      M.people[sh.recv].p.do('swing');
      later(0.3, () => hostPoint(1 - team(sh.recv), `${M.slots[sh.recv].name} 헛스윙!`));
    }
  }

  function hostPoint(win, text) {
    if (!M || M.phase === 'point' || M.phase === 'over' || M.phase === 'done') return;
    const score = M.score.slice();
    score[win]++;
    const done = (score[0] >= 4 || score[1] >= 4) && Math.abs(score[0] - score[1]) >= 2;
    if (done) {
      emit({ k: 'over', win, text, score });
      return;
    }
    emit({ k: 'point', win, text, score });
    later(1.6, () => {
      M.srvIdx = (M.srvIdx + 1) % 4;
      emit({ k: 'serve', slot: SERVE_ORDER[M.srvIdx] });
    });
  }

  // 경기 시작(호스트)
  function begin() {
    if (!M || !M.host) return;
    M.srvIdx = 0;
    emit({ k: 'serve', slot: SERVE_ORDER[0] });
  }

  // ---------- 다른 사람이 보낸 신호 ----------
  function onMsg(ev) {
    if (!M || ev.mid !== M.mid) return;
    if (ev.k === 'hit' || ev.k === 'serveGo') {
      if (!M.host) return;
      const slot = ev.slot | 0;
      if (M.slots[slot] && M.slots[slot].cpu) return;
      if (ev.k === 'serveGo') hostServe(slot);
      else hostReturn(slot, ev.sid, +ev.e || 0);
      return;
    }
    if (M.host) return;
    apply(ev);
  }

  // 지금 상황을 처음 보는 사람에게 맞춰 준다(호스트)
  function snapshot() {
    if (!M) return null;
    return { k: 'sync', score: M.score, srv: M.srv, phase: M.phase, shot: M.shot && !M.shot.net ? { ...M.shot } : null, cpu: M.slots.map((s) => !!s.cpu) };
  }
  function applySync(s) {
    if (!M) return;
    M.score = s.score.slice();
    s.cpu.forEach((c, i) => c && apply({ k: 'cpu', slot: i }));
    if (s.shot) {
      M.phase = 'rally';
      M.shot = { ...s.shot, hold: false };
    } else M.phase = s.phase === 'rally' ? 'wait' : s.phase;
    ui.score(scoreText());
  }

  // ---------- 내 스윙 ----------
  function swing() {
    if (!M || M.mine < 0 || M.swingCd > 0) return;
    M.swingCd = 0.35;
    const me = M.people[M.mine].p;
    me.do('swing');
    if (M.phase === 'serve' && M.srv === M.mine) {
      sound.thwack(false);
      ui.hint('');
      if (M.host) hostServe(M.mine);
      else send({ k: 'serveGo', mid: M.mid, slot: M.mine });
      return;
    }
    const sh = M.shot;
    if (M.phase !== 'rally' || !sh || sh.recv !== M.mine || sh.hit) return;
    const e = sh.u - HIT_U;
    if (Math.abs(e) > WINDOW) {
      ui.msg(e < 0 ? '너무 빨라요!' : '너무 늦어요!');
      return;
    }
    sh.hit = true;
    // 다음 공 신호가 올 때까지 공을 그 자리에 둔다
    sh.hold = true;
    sound.thwack(Math.abs(e) < PERFECT);
    if (M.host) hostReturn(M.mine, sh.sid, e);
    else send({ k: 'hit', mid: M.mid, sid: sh.sid, slot: M.mine, e: +e.toFixed(3) });
  }

  // ---------- 매 프레임 ----------
  function update(dt) {
    for (const w of watchers.values()) w.p.update(dt, null, null);
    if (!M) return;
    M.t += dt;
    M.swingCd = Math.max(0, M.swingCd - dt);
    for (let i = M.timers.length - 1; i >= 0; i--) {
      if (M.timers[i].at <= M.t) M.timers.splice(i, 1)[0].fn();
    }

    const sh = M.shot;
    if (sh && !sh.hold) {
      sh.u += dt / sh.dur;
      if (sh.net && sh.u > 1) sh.u = 1;
      const p = shotPos(sh, sh.u);
      ball.position.set(p.x, p.h + 0.075, p.z);
      if (!sh.bounced && sh.u >= 0.62) {
        sh.bounced = true;
        sound.bounce();
      }
    }

    // 호스트가 받기, 놓치기를 판정한다
    if (M.host && M.phase === 'rally' && sh && !sh.decided && !sh.net) {
      const s = M.slots[sh.recv];
      if (s.cpu && sh.u >= HIT_U) hostCpu(sh);
      else if (!s.cpu) {
        const wait = sh.recv === M.mine ? 0 : GRACE / sh.dur;
        if (sh.u > HIT_U + WINDOW + 0.06 + wait) {
          sh.decided = true;
          hostPoint(1 - team(sh.recv), `${s.name} 놓쳤어요!`);
        }
      }
    }

    if (M.phase === 'over' && M.t >= M.until) {
      M.phase = 'done';
      ui.over(M.win);
    }

    // 받을 사람은 공 쪽으로, 짝은 제자리로
    M.people.forEach((o, i) => {
      const p = o.p;
      let x = HOME[i].x;
      if (M.phase === 'rally' && sh && sh.recv === i && !sh.hit && !sh.net) x = shotPos(sh, HIT_U).x - (team(i) === 0 ? 0.25 : -0.25);
      if (Math.abs(p.pos.x - x) > 0.05) {
        p.path = [{ x, z: HOME[i].z }];
        p.state = 'walk';
        p.ease = false;
      }
      p.update(dt, null, null);
      const face = team(i) === 0 ? Math.PI : 0;
      p.yaw = p.targetYaw = face;
      p.root.rotation.y = face;
    });

    ball.visible = M.phase !== 'done' && M.phase !== 'wait';
    shadow.visible = ball.visible;
    shadow.position.set(ball.position.x, C.y + 0.01, ball.position.z);
  }

  // ---------- 구경꾼 ----------
  function watcherSpot(n) {
    const side = n % 2 ? 1 : -1;
    const row = (n / 2) | 0;
    return { x: C.x + side * (HW + 1.6 + ((row / 6) | 0) * 0.9), z: C.z - 4.5 + (row % 6) * 1.8 };
  }
  function addWatcher(id, name, look, mine) {
    if (watchers.has(id)) return;
    const o = addPerson(look, name, mine);
    const s = watcherSpot(watchers.size);
    o.p.root.position.set(s.x, 0, s.z);
    o.p.yaw = o.p.targetYaw = s.x < C.x ? Math.PI / 2 : -Math.PI / 2;
    watchers.set(id, o);
  }
  function removeWatcher(id) {
    const o = watchers.get(id);
    if (!o) return;
    removePerson(o);
    watchers.delete(id);
    // 남은 사람 자리 다시 잡기
    [...watchers.values()].forEach((w, n) => {
      const s = watcherSpot(n);
      w.p.root.position.set(s.x, 0, s.z);
      w.p.yaw = w.p.targetYaw = s.x < C.x ? Math.PI / 2 : -Math.PI / 2;
    });
  }
  function cheer(id, text) {
    const o = watchers.get(id);
    if (o && !o.p.action) o.p.do(pick(['wave', 'laugh', 'clap']), 1.2);
  }

  function stop() {
    if (M) M.people.forEach(removePerson);
    M = null;
    ball.visible = shadow.visible = false;
  }
  function clearWatchers() {
    for (const o of watchers.values()) removePerson(o);
    watchers.clear();
  }

  return {
    setup,
    begin,
    apply,
    onMsg,
    swing,
    update,
    snapshot,
    applySync,
    addWatcher,
    removeWatcher,
    clearWatchers,
    cheer,
    stop,
    // 호스트가 자리를 CPU 로 바꾼다
    toCpu(slot) {
      if (M && M.host) emit({ k: 'cpu', slot });
    },
    end() {
      if (M && M.host) emit({ k: 'end' });
    },
    get state() {
      return M;
    },
    get watchers() {
      return watchers;
    },
    teamOf: team,
  };
}
