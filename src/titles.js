// 오늘의 칭호. 기록(stats)으로 칭호를 정한다
// stats: shots 원샷, jin 진상, kick 쫓겨남, wc 화장실, puke 바닥에 토함, lost 술게임 짐, chat 수다, flex 쏜 금액, order 주문,
//        eomuk 어묵탕, tennis 테니스 이김, hold 버티기, ko 사장님 쓰러뜨림

export const STAT_LABELS = [
  ['shots', '원샷', '잔'],
  ['order', '주문', '번'],
  ['chat', '수다', '마디'],
  ['jin', '진상', '번'],
  ['kick', '쫓겨남', '번'],
  ['wc', '화장실', '번'],
  ['puke', '바닥 테러', '번'],
  ['lost', '술게임 패배', '번'],
  ['flex', '쏜 금액', '원'],
  ['eomuk', '어묵탕', '그릇'],
  ['tennis', '테니스 승리', '번'],
  ['hold', '버티기', '번'],
  ['ko', '사장님 KO', '번'],
];

// 혼자 받는 칭호. 위에서부터 먼저 맞는 것
const SOLO = [
  [(s) => s.puke >= 1, '바닥 테러리스트', '가게 바닥에 흔적을 남겼어요'],
  [(s) => s.kick >= 2, '전설의 진상왕', '두 번 넘게 쫓겨났어요'],
  [(s) => s.ko >= 1, '풍속의 주먹', '사장님을 쓰러뜨렸어요'],
  [(s) => s.hold >= 1, '철면피', '나가라는데 안 나갔어요'],
  [(s) => s.jin >= 3 || s.kick >= 1, '오늘의 진상왕', '사장님 혈압 담당'],
  [(s) => s.flex >= 50000, '플렉스 장인', '오늘은 내가 쏜다!'],
  [(s) => s.shots >= 12, '원샷왕', '간이 튼튼해요'],
  [(s) => s.eomuk >= 4, '어묵탕 도둑', '국물이 너무 맛있었어요'],
  [(s) => s.tennis >= 1, '테니스 왕자', '풍순이를 이겼어요'],
  [(s) => s.wc >= 3, '화장실 VIP', '자리보다 화장실에 더 오래'],
  [(s) => s.lost >= 3, '술게임 호구', '걸리는 건 다 내 몫'],
  [(s) => s.chat >= 15, '수다왕', '입이 쉬질 않아요'],
  [(s) => s.order >= 4, '먹방 요정', '안주 쓸어 담기'],
  [(s) => s.shots >= 1, '분위기 메이커', '적당히 마시고 잘 놀았어요'],
];

export function soloTitle(s) {
  for (const [ok, name, desc] of SOLO) if (ok(s)) return { name, desc };
  return { name: '모범 손님', desc: '사장님이 제일 좋아하는 손님' };
}

// 여럿이면 항목마다 가장 높은 사람에게 칭호를 준다. 아무 항목에서도 1등이 아니면 혼자 칭호
const BEST = [
  ['puke', '바닥 테러리스트'],
  ['jin', '오늘의 진상왕'],
  ['flex', '플렉스 장인'],
  ['shots', '원샷왕'],
  ['wc', '화장실 VIP'],
  ['lost', '술게임 호구'],
  ['chat', '수다왕'],
  ['order', '먹방 요정'],
  ['eomuk', '어묵탕 도둑'],
  ['tennis', '테니스 왕자'],
  ['hold', '철면피'],
  ['ko', '풍속의 주먹'],
];

export function roomTitles(list) {
  // list: [{ id, name, stats }]
  const out = new Map();
  for (const [key, name] of BEST) {
    let top = null;
    for (const p of list) {
      const v = (p.stats[key] || 0) + (key === 'jin' ? (p.stats.kick || 0) * 2 : 0);
      if (v > 0 && (!top || v > top.v)) top = { id: p.id, v };
    }
    if (top && !out.has(top.id)) out.set(top.id, name);
  }
  return list.map((p) => ({ ...p, title: out.get(p.id) || soloTitle(p.stats).name }));
}

export function emptyStats() {
  return { shots: 0, order: 0, chat: 0, jin: 0, kick: 0, wc: 0, puke: 0, lost: 0, flex: 0, eomuk: 0, tennis: 0, hold: 0, ko: 0 };
}

// 같이 놀 때 짧게 주고받는 형태
export function packStats(s) {
  return STAT_LABELS.map(([k]) => s[k] | 0).join('.');
}
export function unpackStats(str) {
  const s = emptyStats();
  if (typeof str !== 'string') return s;
  str.split('.').forEach((v, i) => {
    const k = STAT_LABELS[i] && STAT_LABELS[i][0];
    if (k) s[k] = Math.max(0, parseInt(v, 10) || 0);
  });
  return s;
}
