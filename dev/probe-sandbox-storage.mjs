// 探測：Larch 的 miniGame／插件卡跑在 srcdoc + sandbox="allow-scripts" 的 iframe（opaque origin）。
// 那種環境存得住東西嗎？手機上的深淺切換要記住玩家的選擇，先確認能存哪裡。
// 用法：node dev/probe-sandbox-storage.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';

const host = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><body>'); });
await new Promise(r => host.listen(0, r));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${host.address().port}/`);

const card = `<body><script>
function t(fn){ try{ return {ok:true, v:String(fn())}; }catch(e){ return {ok:false, v:e.name+': '+e.message.slice(0,60)}; } }
parent.postMessage({
  origin:       t(function(){ return location.origin; }),
  localStorage: t(function(){ localStorage.setItem('k','v'); return localStorage.getItem('k'); }),
  sessionStore: t(function(){ sessionStorage.setItem('k','v'); return sessionStorage.getItem('k'); }),
  indexedDB:    t(function(){ return String(indexedDB.open('x')); }),
  cookie:       t(function(){ document.cookie='k=v'; return document.cookie || '(空字串)'; }),
  matchMedia:   t(function(){ return matchMedia('(prefers-color-scheme: dark)').matches; }),
  postMessage:  t(function(){ return typeof parent.postMessage; })
}, '*');
<\/script>`;

await page.evaluate(srcdoc => {
  window.__r = null;
  window.addEventListener('message', e => { window.__r = e.data; });
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');   // Larch 就是這個值，沒有 allow-same-origin
  f.srcdoc = srcdoc;
  document.body.appendChild(f);
}, card);
await page.waitForTimeout(1200);
const r = await page.evaluate(() => window.__r);
await browser.close(); host.close();

console.log('sandbox="allow-scripts" 的 srcdoc iframe 裡：\n');
for (const [k, v] of Object.entries(r || {}))
  console.log(`  ${k.padEnd(14)} ${v.ok ? '可以' : '不行'}  ${v.v}`);
console.log('\n結論：' + (r && !r.localStorage.ok
  ? 'localStorage 不能用，玩家的選擇只能走 Larch 變數（larch:set）。'
  : 'localStorage 可以用，再決定要不要用它。'));
