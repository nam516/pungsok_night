// Gemini 부르기(탐정단, 회의 대답이 같이 씀). 환경 변수 GEMINI_API_KEY(필수), GEMINI_MODEL(선택)
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
// 한 번 된 모델은 기억해 두고 먼저 쓴다(같은 서버가 살아 있는 동안)
let goodModel = '';

// temp: 답의 다양함(0 이면 같은 질문에 늘 같은 답)
async function gemini(prompt, temp = 0) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const e = new Error('no-key');
    e.status = 503;
    throw e;
  }
  const list = [...new Set([process.env.GEMINI_MODEL, goodModel, ...MODELS].filter(Boolean))];
  let last = null;
  for (const m of list) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: temp, responseMimeType: 'application/json', maxOutputTokens: 2048 },
      }),
    });
    // 한도 초과는 다른 모델로 넘기지 않고 바로 알린다
    if (r.status === 429) {
      const e = new Error('busy');
      e.status = 429;
      throw e;
    }
    if (!r.ok) {
      // 없는 모델이거나 무료로 못 쓰는 모델이면 다음 후보로
      last = new Error('model ' + m + ' ' + r.status);
      continue;
    }
    const j = await r.json();
    const text = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const out = text.map((p) => p.text || '').join('');
    goodModel = m;
    return out;
  }
  const e = last || new Error('no-model');
  e.status = 502;
  throw e;
}

function parseJson(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    const m = String(s).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e2) {}
    }
  }
  return null;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return parseJson(req.body) || {};
  let raw = '';
  for await (const ch of req) raw += ch;
  return parseJson(raw) || {};
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = { gemini, parseJson, readBody, send };
