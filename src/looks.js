// 캐릭터 꾸미기 선택지. 같이 놀 때는 번호 다섯 개를 이어 붙인 짧은 글자로 주고받는다
export const LOOK_OPTS = {
  style: [
    ['bob', '단발'],
    ['short', '짧은 머리'],
    ['pony', '포니테일'],
    ['bun', '똥머리'],
    ['twin', '양갈래'],
  ],
  hair: [0x1c1512, 0x3a2418, 0x6a4028, 0xa8743a, 0xd9c08a, 0x8a2a3a, 0x3a4a7a],
  shirt: [0xf3d36b, 0xe6a3a0, 0x8fb39a, 0x37557a, 0xf1ede4, 0x6b4a7a, 0xc8743a, 0x2b2b30],
  pants: [0x34465a, 0x2a2a2a, 0x4a3a2e, 0x6a7a8a, 0x3a4a3a],
  acc: [
    ['none', '없음'],
    ['glasses', '안경'],
    ['shades', '선글라스'],
    ['hat', '중절모'],
    ['band', '리본 머리띠'],
  ],
};

const KEYS = ['style', 'hair', 'shirt', 'pants', 'acc'];

// 번호 묶음 { style: 0, hair: 2, ... } → 실제 값
export function lookFromIdx(ix) {
  const pickOpt = (k) => {
    const list = LOOK_OPTS[k];
    const v = list[Math.min(list.length - 1, Math.max(0, ix[k] | 0))];
    return Array.isArray(v) ? v[0] : v;
  };
  return { style: pickOpt('style'), hair: pickOpt('hair'), shirt: pickOpt('shirt'), pants: pickOpt('pants'), acc: pickOpt('acc') };
}

export function encodeLook(ix) {
  return KEYS.map((k) => ix[k] | 0).join('.');
}

export function decodeLook(str) {
  if (typeof str !== 'string' || !/^\d+(\.\d+){4}$/.test(str)) return null;
  const n = str.split('.').map(Number);
  return Object.fromEntries(KEYS.map((k, i) => [k, n[i]]));
}

// 처음 들어온 사람은 아이디로 정한 기본 생김새
export function defaultLookIdx(seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const at = (k, shift) => (h >>> shift) % LOOK_OPTS[k].length;
  return { style: at('style', 0), hair: at('hair', 3), shirt: at('shirt', 7), pants: at('pants', 11), acc: 0 };
}
