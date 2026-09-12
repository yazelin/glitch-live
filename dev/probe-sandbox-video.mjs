// 探測：Larch 的 miniGame／插件卡跑在 srcdoc + sandbox="allow-scripts" 的 iframe 裡（opaque origin）。
// 那種環境載得動跨網域的 <video> 嗎？這支在本機把同樣的條件重現一次，不碰 Larch 一根寒毛。
//
//   條件一　srcdoc + sandbox="allow-scripts" → origin 是 null，跟 Larch 一樣
//   條件二　影片放在另一個 port → 對 iframe 來說是跨網域，跟 R2 一樣
//   條件三　順便量 muted 自動播放過不過（Larch 裡沒有使用者手勢）
//
// 用法：node dev/probe-sandbox-video.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MP4 = join(ROOT, 'assets/live-loop.mp4');

// 影片伺服器：另一個 port，對 iframe 來說就是跨網域
const media = createServer(async (req, res) => {
  const buf = await readFile(MP4);
  res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': buf.length,
                       'access-control-allow-origin': '*' });
  res.end(buf);
});
await new Promise(r => media.listen(0, r));
const MEDIA = `http://127.0.0.1:${media.address().port}/live-loop.mp4`;

// 外層頁：什麼都不做，只放一個 srcdoc sandbox iframe
const host = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">');
});
await new Promise(r => host.listen(0, r));
const HOST = `http://127.0.0.1:${host.address().port}/`;

const size = (await stat(MP4)).size;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(HOST);

// 卡片那一段的最小重現：跟 card.html 一樣的屬性
const card = `
<body style="margin:0;background:#000">
<video id="v" playsinline muted loop preload="auto" style="width:100%;height:100vh;object-fit:cover"></video>
<script>
var v = document.getElementById('v'), out = {origin:'?', played:false, err:null, ready:0};
try { out.origin = String(location.origin); } catch (e) { out.origin = 'throws: ' + e.name; }
v.addEventListener('error', function(){ out.err = v.error ? (v.error.code + ' ' + v.error.message) : 'unknown'; });
v.src = ${JSON.stringify(MEDIA)};
v.play().then(function(){ out.played = true; }).catch(function(e){ out.err = 'play(): ' + e.name + ' ' + e.message; });
setInterval(function(){
  out.ready = v.readyState; out.t = v.currentTime; out.w = v.videoWidth; out.h = v.videoHeight;
  parent.postMessage(out, '*');
}, 200);
<\/script>`;

await page.evaluate(([srcdoc]) => {
  window.__r = null;
  window.addEventListener('message', e => { window.__r = e.data; });
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');   // Larch 就是這一個值，沒有 allow-same-origin
  f.srcdoc = srcdoc;
  f.style.cssText = 'width:100%;height:100vh;border:0';
  document.body.appendChild(f);
}, [card]);

await page.waitForTimeout(3500);
const r = await page.evaluate(() => window.__r);
await page.screenshot({ path: join(ROOT, 'shots', 'sandbox-video.png') });
await browser.close(); media.close(); host.close();

const ok = r && r.played && r.ready >= 3 && r.t > 0 && r.w === 720 && r.h === 1280 && !r.err;
console.log(`影片 ${(size / 1048576).toFixed(2)} MB，從另一個 origin 送進 sandbox="allow-scripts" 的 srcdoc iframe`);
console.log(`  iframe 的 origin      ${r && r.origin}`);
console.log(`  自動播放（muted）      ${r && r.played}`);
console.log(`  readyState / 播到第幾秒 ${r && r.ready} / ${r && (r.t || 0).toFixed(2)}`);
console.log(`  解析度                ${r && r.w}×${r && r.h}`);
console.log(`  錯誤                  ${(r && r.err) || '無'}${errs.length ? ' ｜主控台：' + errs.join(' / ') : ''}`);
console.log(ok ? '\nPASS 跨網域影片在 opaque origin 的 sandbox iframe 裡播得動，而且 muted 自動播放過。'
               : '\nFAIL 播不動——把上面那幾行貼進整合文件，那就是這條路走不通的證據。');
process.exit(ok ? 0 : 1);
