// 친구들과 같은 가게에 있게 해 주는 연결. 한 방(채널)으로 메시지를 주고받기만 한다
// 온라인은 Supabase Realtime broadcast, 테스트(?local)는 같은 브라우저 탭끼리 BroadcastChannel
// 누가 있는지, 누가 방장인지 같은 판단은 main.js 가 메시지로 한다
import { createClient } from '@supabase/supabase-js';

export function createNet({ url, key, room, local, onMessage, onStatus }) {
  const name = 'pungsok-' + room;
  const queue = [];
  let ready = false;
  let sendRaw = () => {};
  let close = () => {};

  if (local) {
    const bc = new BroadcastChannel(name);
    bc.onmessage = (e) => onMessage(e.data);
    sendRaw = (m) => bc.postMessage(m);
    close = () => bc.close();
    ready = true;
    setTimeout(() => onStatus('SUBSCRIBED'), 0);
  } else {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
    const ch = sb.channel(name, { config: { broadcast: { self: false, ack: false } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => onMessage(payload));
    ch.subscribe((status) => {
      ready = status === 'SUBSCRIBED';
      // 연결되면 그동안 못 보낸 것을 보낸다
      if (ready) while (queue.length) ch.send({ type: 'broadcast', event: 'm', payload: queue.shift() });
      onStatus(status);
    });
    sendRaw = (m) => ch.send({ type: 'broadcast', event: 'm', payload: m });
    close = () => sb.removeChannel(ch);
  }

  return {
    send(m) {
      if (ready) sendRaw(m);
      else if (queue.length < 50) queue.push(m);
    },
    close,
  };
}
