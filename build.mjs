import { build } from 'esbuild';
import fs from 'fs';

// 온라인 연결 설정. Vercel 환경 변수나 .env 파일의 SUPABASE_URL, SUPABASE_ANON_KEY 를 읽는다
// 없으면 혼자 노는 데모로 빌드된다
// Vercel 의 Supabase 연동이 만드는 이름(NEXT_PUBLIC_ 등)도 받는다
const env = { ...readDotEnv('.env'), ...process.env };
const first = (names) => (names.map((n) => (env[n] || '').trim()).find(Boolean) || '');
const NET_URL = first(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL']);
const NET_KEY = first([
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);
// 설정이 안 들어올 때 원인을 찾기 쉽게, 보이는 SUPABASE 변수 이름만 찍는다(값은 찍지 않는다)
const seen = Object.keys(env).filter((k) => k.includes('SUPABASE'));
console.log('SUPABASE 변수:', seen.length ? seen.join(', ') : '없음');
if (NET_URL && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(NET_URL)) console.log('주의: SUPABASE_URL 형식이 https://xxxx.supabase.co 가 아니에요');
if (/^(sb_secret_|service_role)/.test(NET_KEY)) throw new Error('비밀 키(secret/service_role)는 넣으면 안 돼요. anon 또는 publishable 키를 쓰세요');

const r = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: 'es2020',
  legalComments: 'none',
  define: { __NET_URL__: JSON.stringify(NET_URL), __NET_KEY__: JSON.stringify(NET_KEY) },
});
let js = r.outputFiles[0].text;
if (js.includes('</script')) js = js.replace(/<\/script/g, '<\\/script');
const html = fs.readFileSync('template.html', 'utf8').replace('/*BUNDLE*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB', NET_URL ? '(온라인 멀티플레이)' : '(혼자 노는 데모)');

function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
