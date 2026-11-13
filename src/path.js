// 테이블을 돌아가는 간단한 길 찾기. 막히면 사각형 모서리를 거쳐 간다
const PAD = 0.12;

// 선분이 사각형 안을 지나는지 (Liang-Barsky)
function hits(a, b, r) {
  const x0 = r.x0 + 0.01, x1 = r.x1 - 0.01, z0 = r.z0 + 0.01, z1 = r.z1 - 0.01;
  const dx = b.x - a.x, dz = b.z - a.z;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dz, dz];
  const q = [a.x - x0, x1 - a.x, a.z - z0, z1 - a.z];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return t1 - t0 > 1e-4;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function corners(r) {
  return [
    { x: r.x0 - PAD, z: r.z0 - PAD },
    { x: r.x1 + PAD, z: r.z0 - PAD },
    { x: r.x1 + PAD, z: r.z1 + PAD },
    { x: r.x0 - PAD, z: r.z1 + PAD },
  ];
}

function route(a, b, rects, depth) {
  const r = rects.find((q) => hits(a, b, q));
  if (!r || depth > 4) return [{ x: b.x, z: b.z }];
  const c = corners(r);
  let best = null;
  let bestLen = Infinity;
  const tryWay = (ways) => {
    const pts = [a, ...ways, b];
    for (let i = 0; i < pts.length - 1; i++) if (hits(pts[i], pts[i + 1], r)) return;
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) len += dist(pts[i], pts[i + 1]);
    if (len < bestLen) {
      bestLen = len;
      best = ways;
    }
  };
  for (let i = 0; i < 4; i++) {
    tryWay([c[i]]);
    tryWay([c[i], c[(i + 1) % 4]]);
    tryWay([c[i], c[(i + 3) % 4]]);
  }
  if (!best) return [{ x: b.x, z: b.z }];
  const out = [];
  let from = a;
  for (const w of [...best, b]) {
    out.push(...route(from, w, rects, depth + 1));
    from = w;
  }
  return out;
}

export function planPath(from, to, rects) {
  return route({ x: from.x, z: from.z }, { x: to.x, z: to.z }, rects, 0);
}
