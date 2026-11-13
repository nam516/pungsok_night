import { build } from 'esbuild';
import fs from 'fs';

// 온라인 연결 설정. Vercel 환경 변수나 .env 파일의 SUPABASE_URL, SUPABASE_ANON_KEY 를 읽는다
// 없으면 혼자 노는 데모로 빌드된다
const env = { ...readDotEnv('.env'), ...process.env };
const NET_URL = env.SUPABASE_URL || '';
const NET_KEY = env.SUPABASE_ANON_KEY || '';

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
