// 탐정단 기록관(Vercel 서버 함수). POST /api/detective
// 사건의 진상은 서버에만 두고, 질문 판정과 추리 채점은 Gemini 에 맡긴다
// 환경 변수: GEMINI_API_KEY(필수), GEMINI_MODEL(선택, 없으면 아래 후보를 차례로 써 본다)
const CASES = require('./_cases.js');
const { gemini, parseJson, readBody, send } = require('./_gemini.js');

// 같은 질문은 같은 답(같은 서버가 살아 있는 동안)
const cache = new Map();

const ANSWERS = ['yes', 'no', 'irrelevant', 'invalid'];

function caseText(c) {
  return `[사건 제목] ${c.title}\n[공개된 상황] ${c.setup}\n[진상] ${c.truth}\n[확실한 사실]\n${c.facts.map((f) => '- ' + f).join('\n')}`;
}

function askPrompt(c, q) {
  return `너는 추리 게임의 기록관이다. 탐정이 예/아니오 질문을 하면 아래 진상과 사실만 근거로 판정한다.
${caseText(c)}

규칙
- 진상과 사실에 비추어 맞으면 "yes", 틀리면 "no".
- 진상을 푸는 데 아무 상관이 없거나, 진상·사실로 정할 수 없는 내용이면 "irrelevant".
- 예/아니오로 답할 수 없는 질문(누구야? 왜? 뭐야? 같은 열린 질문, 여러 개를 한꺼번에 묻는 질문, 질문이 아닌 말)이면 "invalid".
- 진상을 설명하거나 힌트를 주지 않는다.
- 반드시 JSON 한 줄로만 답한다: {"a":"yes"} 처럼. a 는 yes, no, irrelevant, invalid 중 하나.

탐정의 질문: ${q}`;
}

function solvePrompt(c, g) {
  return `너는 추리 게임의 채점관이다. 탐정이 적어 낸 추리가 아래 핵심 요소를 각각 맞혔는지 판정한다.
${caseText(c)}
[핵심 요소]
${c.keys.map((k, i) => `${i + 1}. ${k}`).join('\n')}

규칙
- 핵심 요소마다, 탐정의 추리에 그 내용이 뜻으로 들어 있으면 true, 없거나 틀리면 false. 표현이 달라도 뜻이 같으면 true.
- comment 는 탐정에게 하는 짧은 한마디(30자 이내). 맞히지 못한 요소의 답이나 진상을 절대 알려 주지 않는다.
- 반드시 JSON 한 줄로만 답한다: {"hits":[true,false,true],"comment":"..."} (hits 는 핵심 요소 수만큼)

탐정의 추리: ${g}`;
}

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const b = await readBody(req);
  const op = b.op;
  if (op === 'list') return send(res, 200, { cases: CASES.map((c) => ({ id: c.id, title: c.title, level: c.level, setup: c.setup })), ready: !!process.env.GEMINI_API_KEY });
  const c = CASES.find((x) => x.id === b.caseId);
  if (!c) return send(res, 404, { error: 'no-case' });
  try {
    if (op === 'ask') {
      const q = norm(b.q).slice(0, 100);
      if (q.length < 2) return send(res, 400, { error: 'short' });
      const ck = c.id + '|' + q;
      if (cache.has(ck)) return send(res, 200, { a: cache.get(ck) });
      const j = parseJson(await gemini(askPrompt(c, q)));
      const a = j && ANSWERS.includes(j.a) ? j.a : 'invalid';
      if (a !== 'invalid') cache.set(ck, a);
      return send(res, 200, { a });
    }
    if (op === 'solve') {
      const g = norm(b.g).slice(0, 300);
      if (g.length < 4) return send(res, 400, { error: 'short' });
      const j = parseJson(await gemini(solvePrompt(c, g)));
      const hits = c.keys.map((_, i) => !!(j && Array.isArray(j.hits) && j.hits[i] === true));
      const ok = hits.every(Boolean);
      const comment = j && typeof j.comment === 'string' ? j.comment.slice(0, 60) : '';
      return send(res, 200, { ok, hits: hits.filter(Boolean).length, total: hits.length, comment, truth: ok ? c.truth : undefined });
    }
    if (op === 'reveal') return send(res, 200, { truth: c.truth });
    return send(res, 400, { error: 'op' });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

module.exports = handler;
