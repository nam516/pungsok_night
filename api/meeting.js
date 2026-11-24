// 회의 때 팀장 풍뎅이의 대답(Vercel 서버 함수). POST /api/meeting {said, who, history:[{who,t}]}
// 방금 나온 말에 맞춰 비꼬는 한마디를 만든다(meek 면 주눅 든 말투). 실패하면 화면 쪽이 미리 써 둔 대사로 대신한다
const { gemini, parseJson, readBody, send } = require('./_gemini.js');

const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function prompt(said, who, history, meek) {
  const log = history.map((h) => `${h.who}: ${h.t}`).join('\n');
  return `너는 회사 '스튜디오 풍논' 재무팀 팀장 풍뎅이다. 지금 회의실에서 팀원들과 회의 중이다.
성격: 늘 귀찮아하고 거만하며 비꼬는 말투. 눈을 게슴츠레 뜨고 말끝을 늘인다. 존댓말이지만 재수 없게 말한다.
말투 예: "그게....무스흐흔....말이지...?", "그렇게 하는 이유 있어요?", "아~ 네네... 근거는요?"
규칙
- 방금 팀원이 한 말의 내용을 꼭 짚어서 대답한다. 엉뚱한 소리나 아무 말에나 붙는 대답은 하지 않는다.
- 질문을 받았는데 답을 모르거나 귀찮으면 "...블로그 찾아서 보시죠." 라고 넘긴다. 이때 hard 는 true.
- 인사나 잡담에도 시큰둥하게, 그래도 그 말에 맞게 대답한다.
- 욕설, 비하, 차별하는 말은 하지 않는다. 장난스러운 비꼼까지만.
- 45자 이내 한 문장.${meek ? '\n- 지금은 방금 팀원에게 머리를 쥐어박혀 잔뜩 주눅 든 상태다. 속으로는 불만이지만 말 잘 듣는 척, 비꼬지 않고 소심하고 공손하게 말끝을 흐리며 대답한다. 예: "네... 좋은 의견이신 것 같습니다...", "...바로 알아보겠습니다..." 블로그 얘기는 하지 않고 hard 는 false.' : ''}
- 반드시 JSON 한 줄로만 답한다: {"r":"대답","hard":false}
${log ? `\n앞서 나온 말\n${log}\n` : ''}
방금 ${who}의 말: ${said}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const b = await readBody(req);
  const said = cut(b.said, 60);
  if (said.length < 1) return send(res, 400, { error: 'short' });
  const who = cut(b.who, 12) || '팀원';
  const history = (Array.isArray(b.history) ? b.history : []).slice(-4).map((h) => ({ who: cut(h && h.who, 12) || '누군가', t: cut(h && h.t, 60) }));
  try {
    const meek = !!b.meek;
    const j = parseJson(await gemini(prompt(said, who, history, meek), 0.9));
    const r = j && typeof j.r === 'string' ? cut(j.r, 60) : '';
    if (!r) return send(res, 502, { error: 'empty' });
    return send(res, 200, { r, hard: !meek && (!!(j && j.hard) || r.includes('블로그')) });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
};
