// 주점 소리. 파일 없이 브라우저에서 합성한다
// 웅성거림, 잔잔한 음악, 잔 부딪히는 소리, 원샷, 안주 씹는 소리, 주문 벨
export function createSound() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let fxBus = null;
  let on = true;
  let started = false;
  let noiseBuf = null;

  function start() {
    if (started) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    started = true;
    master = ctx.createGain();
    master.gain.value = on ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.22;
    musicBus.connect(master);
    fxBus = ctx.createGain();
    fxBus.gain.value = 0.8;
    fxBus.connect(master);

    // 분홍 잡음
    const len = ctx.sampleRate * 4;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }

    startMurmur();
    startMusic();
    ambientClinks();
  }

  function startMurmur() {
    const out = ctx.createGain();
    out.gain.value = 0.32;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    out.connect(lp).connect(master);
    for (const f of [320, 620, 1050, 1500]) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      src.connect(bp).connect(g).connect(out);
      src.start(ctx.currentTime + Math.random());
      // 말소리처럼 세기와 높이가 오르내린다
      const wander = () => {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(0.08 + Math.random() * 0.5, t, 0.08);
        bp.frequency.setTargetAtTime(f * (0.8 + Math.random() * 0.4), t, 0.1);
        setTimeout(wander, 120 + Math.random() * 260);
      };
      wander();
    }
  }

  // 느린 로파이 코드 진행
  const CH = [
    [174.61, 220.0, 261.63, 329.63],
    [164.81, 196.0, 246.94, 293.66],
    [146.83, 174.61, 220.0, 261.63],
    [130.81, 164.81, 196.0, 246.94],
  ];
  const BAR = 4.2;
  function startMusic() {
    let next = ctx.currentTime + 0.3;
    let bar = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.connect(musicBus);
    const tick = () => {
      while (next < ctx.currentTime + 1.2) {
        const chord = CH[bar % CH.length];
        for (const f of chord) pad(f, next, BAR, lp);
        bass(chord[0] / 2, next, BAR);
        for (let k = 0; k < 8; k++) {
          if (Math.random() < 0.55) {
            const f = chord[(Math.random() * 4) | 0] * 2;
            pluck(f, next + k * (BAR / 8) + Math.random() * 0.03);
          }
        }
        next += BAR;
        bar++;
      }
      setTimeout(tick, 300);
    };
    tick();
  }

  function pad(f, t, dur, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.8);
    g.gain.setValueAtTime(0.05, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    g.connect(dest);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.7);
    }
  }

  function bass(f, t, dur) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function pluck(f, t) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.2);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(musicBus);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.3);
    o2.stop(t + 1.3);
  }

  function noiseBurst(t, dur, type, freq, q, vol, dest = fxBus) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.05);
  }

  function clinkAt(t, vol = 1) {
    const base = 2400 + Math.random() * 500;
    [1, 1.52, 2.17, 2.9].forEach((r, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = base * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime((0.12 / (i + 1)) * vol, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0003, t + 0.5 + Math.random() * 0.4);
      o.connect(g).connect(fxBus);
      o.start(t);
      o.stop(t + 1);
    });
    noiseBurst(t, 0.03, 'highpass', 4000, 0.7, 0.25 * vol);
  }

  function ambientClinks() {
    const go = () => {
      if (ctx && on) clinkAt(ctx.currentTime, 0.18);
      setTimeout(go, 5000 + Math.random() * 9000);
    };
    setTimeout(go, 4000);
  }

  const ready = () => started && on && ctx.state === 'running';

  return {
    start,
    get on() {
      return on;
    },
    setOn(v) {
      on = v;
      if (!started) return;
      master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.1);
    },
    clink(n = 3) {
      if (!ready()) return;
      const t = ctx.currentTime;
      for (let i = 0; i < n; i++) clinkAt(t + i * 0.035 + Math.random() * 0.02, 1 - i * 0.15);
    },
    gulp() {
      if (!ready()) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.2;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(220, s);
        o.frequency.exponentialRampToValueAtTime(90, s + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.35, s + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.12);
        o.connect(g).connect(fxBus);
        o.start(s);
        o.stop(s + 0.15);
      }
    },
    ahh() {
      if (!ready()) return;
      noiseBurst(ctx.currentTime, 0.45, 'bandpass', 1300, 1.2, 0.5);
    },
    crunch() {
      if (!ready()) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) noiseBurst(t + i * 0.13, 0.06, 'highpass', 2500, 0.8, 0.35);
    },
    pop() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(600, t);
      o.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g).connect(fxBus);
      o.start(t);
      o.stop(t + 0.12);
    },
    // 사장님 환호. 길게 끄는 '예에에에~' 목소리 흉내, 박수 같은 함성, 짧은 팡파르
    yeah() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const dur = 1.9;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(190, t);
      o.frequency.linearRampToValueAtTime(330, t + 0.25);
      o.frequency.linearRampToValueAtTime(300, t + dur * 0.7);
      o.frequency.linearRampToValueAtTime(240, t + dur);
      const vib = ctx.createOscillator();
      vib.frequency.value = 6;
      const vibG = ctx.createGain();
      vibG.gain.setValueAtTime(0, t);
      vibG.gain.linearRampToValueAtTime(14, t + 0.6);
      vib.connect(vibG).connect(o.frequency);
      const voice = ctx.createGain();
      voice.gain.setValueAtTime(0, t);
      voice.gain.linearRampToValueAtTime(0.5, t + 0.06);
      voice.gain.setValueAtTime(0.5, t + dur - 0.4);
      voice.gain.linearRampToValueAtTime(0, t + dur);
      // 모음 울림. '이'에서 '애'로 넘어간다
      for (const [f0, f1, q, g] of [[320, 650, 6, 1], [2300, 1750, 9, 0.6], [2900, 2600, 10, 0.3]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = q;
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f1, t + 0.3);
        const gg = ctx.createGain();
        gg.gain.value = g;
        o.connect(bp).connect(gg).connect(voice);
      }
      voice.connect(fxBus);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.05);
      vib.stop(t + dur + 0.05);

      // 함성
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.6;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t + 0.2);
      cg.gain.linearRampToValueAtTime(0.55, t + 0.6);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
      src.connect(bp).connect(cg).connect(fxBus);
      src.start(t + 0.2, Math.random() * 2);
      src.stop(t + 3.3);

      // 팡파르
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const s = t + 0.05 + i * 0.11;
        const n = ctx.createOscillator();
        n.type = 'triangle';
        n.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.12, s + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, s + (i === 3 ? 0.9 : 0.25));
        n.connect(g).connect(fxBus);
        n.start(s);
        n.stop(s + 1);
      });
    },
    // 진상. 테이블 쾅쾅
    bang() {
      if (!ready()) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 5; i++) {
        const s = t + i * 0.2;
        noiseBurst(s, 0.12, 'lowpass', 500, 0.8, 0.9);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(140, s);
        o.frequency.exponentialRampToValueAtTime(60, s + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, s);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.16);
        o.connect(g).connect(fxBus);
        o.start(s);
        o.stop(s + 0.2);
      }
    },
    // 흥. 콧소리처럼 짧게 내려간다
    humph() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(170, t + 0.28);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(bp).connect(g).connect(fxBus);
      o.start(t);
      o.stop(t + 0.35);
    },
    // 쪽. 짧게 올라가는 소리
    smooch() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(700, t);
      o.frequency.exponentialRampToValueAtTime(1900, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(fxBus);
      o.start(t);
      o.stop(t + 0.14);
      noiseBurst(t, 0.04, 'highpass', 3000, 0.7, 0.15);
    },
    bell() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [[1318.5, 0], [1046.5, 0.22]].forEach(([f, d]) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + d);
        g.gain.linearRampToValueAtTime(0.15, t + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.9);
        o.connect(g).connect(fxBus);
        o.start(t + d);
        o.stop(t + d + 1);
      });
    },
  };
}
