// 술게임 진행. 게임을 시작한 사람의 화면에서만 돌고, 일어난 일(ev)은 모두에게 보낸다
// ctx: now() 지금 시각(초), emit(ev) 모두에게 알림, name(id) 이름, isNpc(id), skill(id) 0~1 실수 확률, rnd(a, b)
// ev.e: start, say(진행자나 참가자 말), turn(차례), roul(룰렛), lose(걸린 사람), end
export const GAMES = {
  roulette: { name: '복불복 룰렛', desc: '돌려서 걸린 사람이 원샷' },
  updown: { name: '업다운', desc: '1~50 숫자 맞히면 당첨, 원샷' },
  g369: { name: '369', desc: '3, 6, 9 가 들어가면 짝!' },
};

const has369 = (n) => /[369]/.test(String(n));
const HUMAN_UPDOWN_SEC = 12;
const HUMAN_369_SEC = 4.5;

export function createGames(ctx) {
  let run = null;
  let seq = 0;

  const at = (sec, fn) => {
    run.queue.push({ t: ctx.now() + sec, fn });
  };
  const mc = (text, big = false) => ctx.emit({ e: 'say', gid: run.gid, who: 'mc', text, big });
  const finish = (sec) =>
    at(sec, () => {
      ctx.emit({ e: 'end', gid: run.gid });
      run = null;
    });
  const lose = (pid, line) => {
    mc(line, true);
    ctx.emit({ e: 'lose', gid: run.gid, pid });
    finish(3.2);
  };

  function start(kind, tid, players, myId) {
    if (run || players.length < 2) return false;
    run = { gid: myId + '-' + ++seq + '-' + Math.floor(ctx.now()), kind, tid, players, queue: [], turn: 0, wait: null };
    ctx.emit({ e: 'start', gid: run.gid, kind, tid, players, host: myId });
    if (kind === 'roulette') {
      mc('복불복 룰렛~ 두구두구두구!');
      at(1.2, () => {
        const loser = players[(Math.random() * players.length) | 0];
        ctx.emit({ e: 'roul', gid: run.gid, order: players, loser, dur: 3 });
        at(3.4, () => lose(loser, `${ctx.name(loser)} 당첨~! 원샷!`));
      });
    } else if (kind === 'updown') {
      run.n = 1 + ((Math.random() * 50) | 0);
      run.lo = 1;
      run.hi = 50;
      mc('업다운~! 1부터 50 사이 숫자 하나 정했어요~ 맞히는 사람이 원샷!');
      at(2, ask);
    } else if (kind === 'g369') {
      run.c = 1;
      mc('369~ 369~ 369~ 369!');
      at(1.8, ask);
    }
    return true;
  }

  // 차례를 넘긴다. 사람은 입력을 기다리고, 가짜 손님은 잠깐 생각한 뒤 답한다
  function ask() {
    const pid = run.players[run.turn % run.players.length];
    const npc = ctx.isNpc(pid);
    const dur = npc ? 0 : run.kind === 'updown' ? HUMAN_UPDOWN_SEC : HUMAN_369_SEC;
    ctx.emit({ e: 'turn', gid: run.gid, pid, kind: run.kind, lo: run.lo, hi: run.hi, n: run.c, dur });
    run.wait = { pid, until: ctx.now() + (npc ? 99 : dur) };
    if (npc) {
      at(ctx.rnd(0.9, 1.7), () => {
        if (!run || !run.wait || run.wait.pid !== pid) return;
        if (run.kind === 'updown') answer(pid, Math.round(run.lo + (run.hi - run.lo) * ctx.rnd(0.3, 0.7)));
        else answer(pid, Math.random() < ctx.skill(pid) ? (has369(run.c) ? 'clap' : 'num') : has369(run.c) ? 'num' : 'clap');
      });
    }
  }

  function answer(pid, v, timeout = false) {
    if (!run || !run.wait || run.wait.pid !== pid) return;
    run.wait = null;
    if (run.kind === 'updown') {
      let g = parseInt(v, 10);
      if (!(g >= 1 && g <= 50)) g = Math.round(run.lo + (run.hi - run.lo) * Math.random());
      ctx.emit({ e: 'say', gid: run.gid, who: pid, text: timeout ? `어... ${g}!` : String(g) });
      at(0.9, () => {
        if (g === run.n) return lose(pid, `딩동댕~ ${ctx.name(pid)} 당첨! 원샷~!`);
        if (g < run.n) {
          run.lo = Math.max(run.lo, g + 1);
          mc('업!', true);
        } else {
          run.hi = Math.min(run.hi, g - 1);
          mc('다운!', true);
        }
        run.turn++;
        at(1.1, ask);
      });
    } else {
      const clap = v === 'clap';
      if (!timeout) ctx.emit({ e: 'say', gid: run.gid, who: pid, text: clap ? '짝!' : String(run.c), act: clap ? 'clap' : null });
      const ok = !timeout && clap === has369(run.c);
      at(0.6, () => {
        if (!ok) return lose(pid, timeout ? `시간 초과~! ${ctx.name(pid)} 원샷!` : `땡~! ${ctx.name(pid)} 걸렸어요~ 원샷!`);
        run.c++;
        run.turn++;
        if (run.c > 40) {
          mc('다들 너무 잘하네~ 무승부! 건배~');
          return finish(2);
        }
        at(0.35, ask);
      });
    }
  }

  return {
    start,
    get active() {
      return !!run;
    },
    get gid() {
      return run && run.gid;
    },
    // 사람이 낸 답. 내가 진행 중인 게임이고 그 사람 차례일 때만 받는다
    input(pid, gid, v) {
      if (run && run.gid === gid) answer(pid, v);
    },
    // 참가자가 나가면 그 사람 차례는 시간 초과로 넘긴다
    update() {
      if (!run) return;
      const now = ctx.now();
      if (run.wait && now >= run.wait.until) answer(run.wait.pid, null, true);
      for (let i = 0; run && i < run.queue.length; i++) {
        if (run.queue[i].t <= now) {
          const job = run.queue.splice(i--, 1)[0];
          job.fn();
        }
      }
    },
    stop() {
      run = null;
    },
  };
}
