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

// 방과 문이 있는 곳(학동로 빌딩)에서 쓰는 격자 길 찾기
// 장애물 둘레를 pad 만큼 넓혀 칸을 막고, A* 로 찾은 뒤 곧게 이을 수 있는 점은 건너뛴다
const gridCache = new WeakMap();

function makeGrid(rects, b, cell, pad) {
  const nx = Math.max(1, Math.ceil((b.x1 - b.x0) / cell));
  const nz = Math.max(1, Math.ceil((b.z1 - b.z0) / cell));
  const block = new Uint8Array(nx * nz);
  for (const r of rects) {
    const i0 = Math.max(0, Math.floor((r.x0 - pad - b.x0) / cell));
    const i1 = Math.min(nx - 1, Math.floor((r.x1 + pad - b.x0) / cell));
    const k0 = Math.max(0, Math.floor((r.z0 - pad - b.z0) / cell));
    const k1 = Math.min(nz - 1, Math.floor((r.z1 + pad - b.z0) / cell));
    for (let k = k0; k <= k1; k++) {
      for (let i = i0; i <= i1; i++) {
        const x = b.x0 + (i + 0.5) * cell;
        const z = b.z0 + (k + 0.5) * cell;
        if (x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) block[k * nx + i] = 1;
      }
    }
  }
  return { nx, nz, block, b, cell };
}

function nearestFree(G, i, k) {
  const { nx, nz, block } = G;
  i = Math.min(nx - 1, Math.max(0, i));
  k = Math.min(nz - 1, Math.max(0, k));
  if (!block[k * nx + i]) return [i, k];
  for (let r = 1; r < Math.max(nx, nz); r++) {
    let best = null;
    let bestD = Infinity;
    for (let dk = -r; dk <= r; dk++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dk)) !== r) continue;
        const a = i + di;
        const c = k + dk;
        if (a < 0 || c < 0 || a >= nx || c >= nz || block[c * nx + a]) continue;
        const d = di * di + dk * dk;
        if (d < bestD) {
          bestD = d;
          best = [a, c];
        }
      }
    }
    if (best) return best;
  }
  return [i, k];
}

// 두 칸 사이를 막힘 없이 곧게 갈 수 있는지
function clearLine(G, a, c) {
  const { nx, block } = G;
  const n = Math.ceil(Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])) * 2) + 1;
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const i = Math.round(a[0] + (c[0] - a[0]) * t);
    const k = Math.round(a[1] + (c[1] - a[1]) * t);
    if (block[k * nx + i]) return false;
  }
  return true;
}

export function gridPath(from, to, rects, bounds, cell = 0.2, pad = 0.14) {
  let G = gridCache.get(rects);
  if (!G) {
    G = makeGrid(rects, bounds, cell, pad);
    gridCache.set(rects, G);
  }
  const { nx, nz, block, b } = G;
  const toCell = (p) => [Math.floor((p.x - b.x0) / cell), Math.floor((p.z - b.z0) / cell)];
  const center = ([i, k]) => ({ x: b.x0 + (i + 0.5) * cell, z: b.z0 + (k + 0.5) * cell });
  const s = nearestFree(G, ...toCell(from));
  const gl = toCell(to);
  const g = nearestFree(G, ...gl);
  const goalFree = g[0] === Math.min(nx - 1, Math.max(0, gl[0])) && g[1] === Math.min(nz - 1, Math.max(0, gl[1]));
  const end = goalFree ? { x: to.x, z: to.z } : center(g);
  if (clearLine(G, s, g)) return [end];
  // A*
  const N = nx * nz;
  const cost = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const si = s[1] * nx + s[0];
  const gi = g[1] * nx + g[0];
  cost[si] = 0;
  // 작은 이진 힙
  const heap = [[0, si]];
  const push = (f, i) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const h = (i) => Math.hypot((i % nx) - g[0], ((i / nx) | 0) - g[1]);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === gi) break;
    const ci = cur % nx;
    const ck = (cur / nx) | 0;
    for (const [di, dk, w] of dirs) {
      const a = ci + di;
      const c = ck + dk;
      if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
      const ni = c * nx + a;
      if (block[ni] || closed[ni]) continue;
      // 대각선은 양옆이 다 비어 있을 때만
      if (di && dk && (block[ck * nx + a] || block[c * nx + ci])) continue;
      const nc = cost[cur] + w;
      if (nc < cost[ni]) {
        cost[ni] = nc;
        prev[ni] = cur;
        push(nc + h(ni), ni);
      }
    }
  }
  if (prev[gi] < 0) return [end];
  const cells = [];
  for (let i = gi; i >= 0; i = prev[i]) cells.push([i % nx, (i / nx) | 0]);
  cells.reverse();
  // 곧게 이을 수 있는 점은 건너뛴다
  const out = [];
  let a = cells[0];
  let k = 1;
  while (k < cells.length) {
    let far = k;
    while (far + 1 < cells.length && clearLine(G, a, cells[far + 1])) far++;
    if (far === cells.length - 1) break;
    out.push(center(cells[far]));
    a = cells[far];
    k = far + 1;
  }
  out.push(end);
  return roundCorners(from, out, (p, q) => clearLine(G, toCell(p), toCell(q)));
}

// 꺾이는 점을 짧은 곡선으로 바꿔 부드럽게 돈다. 곡선이 장애물에 걸리면 반경을 줄이고, 그래도 걸리면 그대로 꺾는다
function roundCorners(from, pts, clear) {
  const all = [from, ...pts];
  const out = [];
  for (let i = 1; i < all.length; i++) {
    const p = all[i];
    if (i === all.length - 1) {
      out.push(p);
      break;
    }
    const a = all[i - 1];
    const c = all[i + 1];
    const l1 = Math.hypot(p.x - a.x, p.z - a.z);
    const l2 = Math.hypot(c.x - p.x, c.z - p.z);
    if (l1 < 0.05 || l2 < 0.05) {
      out.push(p);
      continue;
    }
    const u1 = { x: (p.x - a.x) / l1, z: (p.z - a.z) / l1 };
    const u2 = { x: (c.x - p.x) / l2, z: (c.z - p.z) / l2 };
    if (u1.x * u2.x + u1.z * u2.z > 0.97) {
      out.push(p);
      continue;
    }
    let r = Math.min(0.55, l1 * 0.45, l2 * 0.45);
    let arc = null;
    for (let k = 0; k < 2 && !arc; k++, r *= 0.5) {
      const s0 = { x: p.x - u1.x * r, z: p.z - u1.z * r };
      const e0 = { x: p.x + u2.x * r, z: p.z + u2.z * r };
      const pts2 = [];
      for (let n = 0; n <= 4; n++) {
        const t = n / 4;
        const m = (1 - t) * (1 - t);
        const q = 2 * (1 - t) * t;
        pts2.push({ x: m * s0.x + q * p.x + t * t * e0.x, z: m * s0.z + q * p.z + t * t * e0.z });
      }
      let ok = true;
      for (let n = 0; n < 4 && ok; n++) ok = clear(pts2[n], pts2[n + 1]);
      if (ok) arc = pts2;
    }
    if (arc) out.push(...arc);
    else out.push(p);
  }
  return out;
}
