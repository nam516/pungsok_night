import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
let js = r.outputFiles[0].text;
if (js.includes('</script')) js = js.replace(/<\/script/g, '<\\/script');
const html = fs.readFileSync('template.html', 'utf8').replace('/*BUNDLE*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB');
