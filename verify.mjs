// 驗收：起一台本機伺服器，開三晚各一次，等假載入跑完，證明浮水印被介面蓋住，順便存截圖。
// 兩層驗法：
//   命中測試　把浮水印範圍取 5×5 點，elementFromPoint 不能打到影片。
//   像素測試　同一塊截兩張，第二張把影片整個反相（filter:invert），兩張要一模一樣——
//             差得出來就代表影片還透得過去，浮水印只是被壓暗不是被蓋掉。
//             反相而不是藏起來，是因為藏起來會換掉合成層，圓角的抗鋸齒就跟著變，量到的是算繪差異不是漏光。
// 用法：node verify.mjs        node verify.mjs --headed
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const TMP = join(ROOT, 'shots');
const TYPE = { '.html': 'text/html', '.webp': 'image/webp', '.mp4': 'video/mp4', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const p = join(ROOT, rel === '/' ? 'index.html' : rel);
  try {
    const buf = await readFile(p);
    res.writeHead(200, { 'content-type': TYPE[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('no'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;
mkdirSync(TMP, { recursive: true });

// 兩張 PNG 的最大通道差。PIL 比 node 裝一套解碼器省事。
const maxDiff = (a, b) => Number(execFileSync('python3', ['-c', `
from PIL import Image, ImageChops
import sys
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
print(max(ImageChops.difference(a, b).getextrema(), key=lambda t: t[1])[1])
`, a, b]).toString().trim());

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const page = await browser.newPage({ viewport: { width: 780, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(base);

let bad = 0;
for (const night of [2, 5, 8]) {
  await page.click(`#nights button[data-n="${night}"]`);
  await page.waitForTimeout(1200);
  const loading = await page.evaluate(() => !document.querySelector('#load').classList.contains('gone'));
  await page.waitForTimeout(2800);
  const playing = await page.evaluate(() => { const v = document.querySelector('#vid'); return !v.paused && v.currentTime > 0; });
  const rows = await page.evaluate(() => document.querySelectorAll('#chat .row').length);
  const hit = await page.evaluate(() => window.checkCover());
  await page.locator('#phone').screenshot({ path: join(TMP, `night-${night}.png`) });

  // 像素測試：停在第 5 秒（浮水印在那一幀），截同一塊兩次。
  // 聊天室與愛心會動，兩張截圖之間本來就會不一樣，所以先把它們藏起來——
  // 順便讓這一項變嚴：證明光靠遮罩與輸入列就蓋住了，不靠剛好飄過去的字。
  await page.evaluate(() => {
    const v = document.querySelector('#vid'); v.pause(); v.currentTime = 5;
    for (const s of ['#chat', '#hearts']) document.querySelector(s).style.visibility = 'hidden';
  });
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => { const w = window.wmRect(); return { x: w.left, y: w.top, width: w.right - w.left, height: w.bottom - w.top }; });
  const on = join(TMP, `.wm-${night}-a.png`), on2 = join(TMP, `.wm-${night}-a2.png`), off = join(TMP, `.wm-${night}-b.png`);
  await writeFile(on, await page.screenshot({ clip }));
  await writeFile(on2, await page.screenshot({ clip }));   // 負控制：什麼都沒改，量這台機器自己的算繪雜訊
  await page.evaluate(() => { for (const s of ['#vid', '#poster']) document.querySelector(s).style.filter = 'invert(1) saturate(4)'; });
  await page.waitForTimeout(150);
  await writeFile(off, await page.screenshot({ clip }));
  await page.evaluate(() => { for (const s of ['#chat', '#hearts']) document.querySelector(s).style.visibility = ''; });
  // 正控制：畫面中央沒有介面蓋著，同一招量到的差必須很大。量不到就是這支測試壞了，不是畫面好。
  const mid = await page.evaluate(() => { const r = document.querySelector('#screen').getBoundingClientRect();
    return { x: r.left + r.width * .3, y: r.top + r.height * .4, width: r.width * .4, height: r.height * .15 }; });
  await writeFile(join(TMP, `.mid-${night}-b.png`), await page.screenshot({ clip: mid }));
  await page.evaluate(() => { for (const s of ['#vid', '#poster']) document.querySelector(s).style.filter = ''; });
  await page.waitForTimeout(150);
  await writeFile(join(TMP, `.mid-${night}-a.png`), await page.screenshot({ clip: mid }));
  const control = maxDiff(join(TMP, `.mid-${night}-a.png`), join(TMP, `.mid-${night}-b.png`));

  const noise = maxDiff(on, on2), diff = maxDiff(on, off);   // off = 影片反相

  // 反相前後的差要不大於負控制的雜訊：大於了才是影片真的透過來
  const ok = loading && playing && rows > 0 && hit.ok && hit.points >= 10 && diff <= Math.max(noise, 1) && control > 60;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} 第${night}天｜假載入有出現 ${loading}｜影片播放中 ${playing}｜聊天室 ${rows} 行｜`
    + `命中測試 ${hit.points} 點露出 ${hit.bad} 點｜像素測試 影片反相前後差 ${diff}/255（重截雜訊 ${noise}、沒遮的中央 ${control}）`);
}

await page.click('#replay');
await page.waitForTimeout(700);
await page.locator('#phone').screenshot({ path: join(TMP, 'loading.png') });

if (errs.length) { console.log('主控台錯誤：', errs); bad++; }
await browser.close(); server.close();
console.log(bad ? `\n${bad} 項不過` : '\n全部通過。截圖在 shots/');
process.exit(bad ? 1 : 0);
