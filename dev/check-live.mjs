// 驗**部署出去的**站，不是本機檔案。
//
//   node dev/check-live.mjs
//   node dev/check-live.mjs --base http://127.0.0.1:8080/
//   node dev/check-live.mjs --self-test      ← 負控制：故意送一份被改過的 card.html，L1 要紅
//
// 為什麼要有這一支：`verify.mjs` 自己起一個 server 讀本機檔，**從來沒有驗過線上那一份**。
// 2026-09-12 桌寵那條就是這樣栽的：本機全過、runtime 全過，線上的角色小了 16%，
// 因為那是部署環境才看得到的東西。「推上去了」跟「線上是新的」是兩件事——Pages 有快取。
//
// 範圍限縮在 2026-09-12 實際改過的東西，量到的當證據，量不準的標 SKIP 並寫明原因。
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('--base', 'https://yazelin.github.io/glitch-live/').replace(/\/?$/, '/');
const TAG = arg('--tag', 'phone-v2');

const rows = [];
const add = (state, name, counted, why = '') => rows.push({ state, name, counted, why });
const sha = (b) => createHash('sha256').update(b).digest('hex');

/* ── L1 線上那一份就是釘住的那一份 ────────────────────────────────────
   這一項最重要。對不上的話底下三項量到的是別的東西。 */
async function checkDeployed() {
  let want;
  try { want = execFileSync('git', ['show', `${TAG}:card.html`], { cwd: ROOT, maxBuffer: 1 << 24 }); }
  catch (e) { add('SKIP', `L1 線上的 card.html ＝ ${TAG}`, '0 筆', `讀不到 tag ${TAG}：${e.message.slice(0, 60)}`); return null; }
  const r = await fetch(BASE + 'card.html', { cache: 'no-store' });
  const got = Buffer.from(await r.arrayBuffer());
  const counted = `線上 ${got.length} bytes／sha ${sha(got).slice(0, 16)}　vs　${TAG} ${want.length} bytes／sha ${sha(want).slice(0, 16)}（HTTP ${r.status}）`;
  if (r.status !== 200) add('紅', `L1 線上的 card.html ＝ ${TAG}`, counted, `HTTP ${r.status}`);
  else if (!got.equals(want))
    add('紅', `L1 線上的 card.html ＝ ${TAG}`, counted,
      '線上那一份跟釘住的不一樣。**先回報不要動**：\n'
      + '可能是 Pages 還沒重建（等幾分鐘再跑一次），也可能是部署流程有問題，兩者處理方式不同。');
  else add('綠', `L1 線上的 card.html ＝ ${TAG}`, counted);
  return got.equals(want);
}

/* ── 其餘三項要開瀏覽器 ──────────────────────────────────────────── */
async function inBrowser() {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 780, height: 920 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const card = () => page.frames().find(f => f.url().includes('card.html'));
  const inCard = (fn, a) => card().evaluate(fn, a);

  /* L2 深淺鈕：位置、按了會換、過場真的動 */
  await page.evaluate(() => { window.setTime(8, 2); window.show('feed'); });
  await page.waitForTimeout(400);
  const before = await inCard(() => {
    const b = document.querySelector('#tbtn'), s = document.querySelector('#status');
    const svg = document.querySelector('#status .sb');
    if (!b || !s || !svg) return null;
    const r = b.getBoundingClientRect(), sr = s.getBoundingClientRect(), vr = svg.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             inStatus: r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1,
             leftOfSignal: Math.round(vr.left - r.right),
             top: Math.round(r.top), theme: window.getCardTheme(),
             icon: b.querySelector('svg path, svg circle') ? b.innerHTML.includes('4.2') ? 'sun' : 'moon' : '?' };
  });
  await page.frameLocator('#frame').locator('#tbtn').click();
  const mid = await inCard(() => {
    const w = document.querySelector('#wipe');
    return { wipe: w.className, anim: getComputedStyle(w).animationName, spin: document.querySelector('#tbtn').className };
  });
  await page.waitForTimeout(700);
  const after = await inCard(() => ({
    theme: window.getCardTheme(),
    lit: document.querySelector('#screen').classList.contains('t-light'),
    panel: getComputedStyle(document.querySelector('#page')).backgroundColor,
    icon: document.querySelector('#tbtn').innerHTML.includes('4.2') ? 'sun' : 'moon',
  }));
  await page.locator('#phone').screenshot({ path: join(ROOT, 'shots', 'live-card-light.png') });
  const lum = (c) => { const [r, g, bl] = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return (.2126 * r + .7152 * g + .0722 * bl) / 255; };
  if (!before) add('紅', 'L2 深淺鈕在狀態列、按了會換', '0 筆（#tbtn 或 #status 找不到）');
  else {
    const ok = before.inStatus && before.leftOfSignal >= 0 && before.w >= 20
      && before.theme === 'dark' && after.theme === 'light' && after.lit && lum(after.panel) > .8
      && mid.anim === 'wipe' && mid.spin === 'spin' && before.icon !== after.icon;
    add(ok ? '綠' : '紅', 'L2 深淺鈕在狀態列、按了會換、過場真的動',
      `鈕 ${before.w}×${before.h}、在狀態列內 ${before.inStatus}、離訊號圖示 ${before.leftOfSignal}px、`
      + `主題 ${before.theme}→${after.theme}、頁底色 ${after.panel}（亮度 ${lum(after.panel).toFixed(2)}）、`
      + `圖示 ${before.icon}→${after.icon}、過場 animation-name=${mid.anim}、鈕 class=${mid.spin}`);
  }

  /* L3 重新整理記不記得。兩半分開量。 */
  await page.evaluate(() => window.setTheme('light'));
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const shell = await page.evaluate(() => window.getTheme());
  await page.evaluate(() => { window.setTime(8, 2); window.show('feed'); });
  await page.waitForTimeout(400);
  const cardTheme = await inCard(() => window.getCardTheme());
  add(shell.attr === 'light' && shell.stored === 'light' ? '綠' : '紅',
    'L3a 外框的深淺，重新整理記得住',
    `data-theme=${shell.attr}、localStorage=${shell.stored}、底色 ${shell.bg}`);
  add('SKIP', 'L3b 手機那顆的深淺，重新整理記得住',
    `重新整理之後卡片主題是 ${cardTheme}（切成 light 之後重整）`,
    '量不到，而且**這是預覽殼的設計不是 bug**：那顆存的是 Larch 變數 phone_theme，\n'
    + '而 sandbox iframe 裡 localStorage 一碰就 SecurityError（dev/probe-sandbox-storage.mjs 實測），\n'
    + '所以卡片只能靠 larch:set 寫回宿主。遊戲裡宿主是 Larch，變數進存檔所以記得住；\n'
    + '這個 demo 的宿主是 index.html，它把變數放在記憶體（var saved），重新整理就沒了。\n'
    + '**要在 demo 上也量得到，得讓預覽殼把 phone_theme 也寫進 localStorage——那是行為改動，沒做。**');

  /* L4 直播頁不吃淺色、浮水印仍然蓋住 */
  await page.evaluate(() => { window.setTime(8, 2); window.show('live'); });
  await page.waitForTimeout(3600);
  const live = await inCard(() => ({
    noBtn: !document.querySelector('#tbtn'),
    lit: document.querySelector('#screen').classList.contains('t-light'),
    playing: (() => { const v = document.querySelector('#vid'); return !v.paused && v.currentTime > 0; })(),
  }));
  const hit = await page.evaluate(() => window.checkCover());
  // 像素：把影片反相，浮水印那一塊要一模一樣
  await inCard(() => { const v = document.querySelector('#vid'); v.pause(); v.currentTime = 5;
    for (const s of ['#chat', '#hearts']) document.querySelector(s).style.visibility = 'hidden'; });
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => { const w = window.wmRect(); return { x: w.left, y: w.top, width: w.right - w.left, height: w.bottom - w.top }; });
  const a = await page.screenshot({ clip });
  await inCard(() => { for (const s of ['#vid', '#poster']) document.querySelector(s).style.filter = 'invert(1) saturate(4)'; });
  await page.waitForTimeout(150);
  const c = await page.screenshot({ clip });
  await page.locator('#phone').screenshot({ path: join(ROOT, 'shots', 'live-live.png') });
  const diff = a.equals(c) ? 0 : 1;   // 逐 byte：同樣的 PNG 編碼器，內容一樣就一樣
  const okLive = live.noBtn && !live.lit && live.playing && hit.ok && diff === 0;
  add(okLive ? '綠' : '紅', 'L4 直播頁不吃淺色、浮水印仍然蓋住',
    `那頁沒有深淺鈕 ${live.noBtn}、沒有 t-light ${live.lit === false}、影片播放中 ${live.playing}、`
    + `命中測試 ${hit.points} 點露出 ${hit.bad} 點、影片反相前後的 PNG ${diff === 0 ? '完全相同' : '不同'}`);

  await b.close();
  return errs;
}

/* ── 負控制 ──────────────────────────────────────────────────────── */
async function selfTest() {
  const want = execFileSync('git', ['show', `${TAG}:card.html`], { cwd: ROOT, maxBuffer: 1 << 24 });
  const tampered = Buffer.concat([want, Buffer.from('\n<!-- 動過手腳 -->\n')]);
  const srv = createServer(async (req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/card.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(tampered); }
    try {
      const buf = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
      res.writeHead(200, { 'content-type': { '.html': 'text/html', '.webp': 'image/webp', '.mp4': 'video/mp4' }[extname(p)] || 'application/octet-stream' });
      res.end(buf);
    } catch { res.writeHead(404).end('no'); }
  });
  await new Promise(r => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  console.log(`負控制：起一台本機站，card.html 多塞一行註解（${want.length} → ${tampered.length} bytes）\n`);
  const r = await fetch(base + 'card.html');
  const got = Buffer.from(await r.arrayBuffer());
  const same = got.equals(want);
  console.log(`  線上 ${got.length} bytes／sha ${sha(got).slice(0, 16)}`);
  console.log(`  ${TAG} ${want.length} bytes／sha ${sha(want).slice(0, 16)}`);
  console.log(`  → L1 ${same ? '綠（沒抓到，負控制無效）' : '*紅*（抓到了）'}`);
  srv.close();
  console.log('\n' + (same ? 'FAIL 負控制無效——改了 card.html 還是綠的。' : 'PASS 負控制有效：線上那一份跟釘住的不一樣就會紅。'));
  return same ? 1 : 0;
}

if (process.argv.includes('--self-test')) process.exit(await selfTest());

console.log(`量的是：${BASE}\n`);
const deployed = await checkDeployed();
let errs = [];
if (deployed === false) console.log('（L1 紅，底下三項照跑，但要記得它們量到的可能是別的版本）\n');
errs = await inBrowser();

for (const r of rows) {
  console.log(`  ${{ '綠': ' 綠 ', '紅': '*紅*', 'SKIP': 'SKIP' }[r.state]}  ${r.name}`);
  console.log(`        量到：${r.counted}`);
  if (r.why) for (const l of r.why.split('\n')) console.log(`        ${l}`);
}
if (errs.length) console.log(`\n  主控台錯誤：${errs.join(' / ')}`);
const bad = rows.filter(r => r.state === '紅').length;
const skip = rows.filter(r => r.state === 'SKIP').length;
console.log();
if (bad) console.log(`  ${bad} 項不過。（結束碼 1）`);
else if (skip) console.log(`  沒有紅的，但 ${skip} 項沒驗到。**這不等於全過。**（結束碼 2）`);
else console.log('  全部通過。（結束碼 0）');
process.exit(bad ? 1 : skip ? 2 : 0);
