// 驗收：起一台本機伺服器，把四頁與兩種模式走一遍，證明浮水印被介面蓋住，順便存截圖。
// 結構：index.html 是預覽殼（扮演 Larch 當宿主），card.html 是卡片本體，跑在 iframe 裡。
// 浮水印兩層驗法：
//   命中測試　把浮水印範圍取 5×5 點，elementFromPoint 不能打到影片。
//   像素測試　同一塊截兩張，第二張把影片 filter:invert(1)，兩張要一模一樣。
//             反相而不是把影片藏起來，是因為藏起來會換掉合成層，圓角的抗鋸齒跟著變，
//             量到的 4/255 是算繪差異。配負控制（同畫面重截）與正控制（量沒遮的中央）。
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
const page = await browser.newPage({ viewport: { width: 780, height: 920 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(base);
await page.waitForTimeout(600);

const card = () => page.frames().find(f => f.url().includes('card.html'));
const inCard = (fn, arg) => card().evaluate(fn, arg);
let bad = 0;
const fail = (why) => { bad++; console.log('FAIL ' + why); };

/* ── 注入點對不對得上 ──
   push.py 是用字串 .replace() 注入的，對不上不會報錯，只會整份原樣送上去。
   所以這裡直接讀隔壁 glitch-vn 的 push.py，把它要換的字串逐一在 card.html 裡找。
   找不到 glitch-vn 就跳過（別台機器、CI）。 */
{
  const PUSH = join(ROOT, '../glitch-vn/larch/inv/push.py');
  let src = null;
  try { src = await readFile(PUSH, 'utf8'); } catch {}
  if (!src) console.log('SKIP 注入點｜這台機器沒有 ../glitch-vn，跳過');
  else {
    const cardSrc = await readFile(join(ROOT, 'card.html'), 'utf8');
    // 只看 phone_card 那一段，push.py 裡別的卡（notes、board…）也有自己的 @@
    const seg = src.slice(src.indexOf('def phone_card('), src.indexOf('def phone_data('));
    const targets = [...seg.matchAll(/\.replace\(\s*"(\/\*@@[A-Z_]+@@\*\/[^"]*)"/g)].map(m => m[1].replace(/\\'/g, "'"));
    const miss = targets.filter(t => !cardSrc.includes(t));
    if (!seg || seg.length > 4000) fail('注入點｜在 push.py 裡切不出 phone_card 那一段，切法要改');
    else if (!targets.length) fail('注入點｜phone_card 裡找不到任何 @@ 的 replace，正規表示式要改');
    else if (miss.length) fail(`注入點｜push.py 要換這幾個字串，card.html 裡沒有：${JSON.stringify(miss)}`);
    else console.log(`PASS 注入點｜push.py 的 phone_card 要換的 ${targets.length} 個字串，card.html 裡都找得到`);
  }
}

/* ── 開台的三個晚上 ── */
for (const night of [2, 5, 8]) {
  await page.evaluate(n => { window.setTime(n, 2); window.show('live'); }, night);
  await page.waitForTimeout(1200);
  const loading = await inCard(() => !document.querySelector('#load').classList.contains('gone'));
  await page.waitForTimeout(2800);
  const playing = await inCard(() => { const v = document.querySelector('#vid'); return !v.paused && v.currentTime > 0; });
  const rows = await inCard(() => document.querySelectorAll('#chat .row').length);
  const hit = await page.evaluate(() => window.checkCover());
  await page.locator('#phone').screenshot({ path: join(TMP, `night-${night}.png`) });

  // 停在第 5 秒（浮水印在那一幀）。聊天室與愛心會動，先藏起來，順便讓這一項變嚴：
  // 證明光靠遮罩、輸入列與分頁列就蓋住了，不靠剛好飄過去的字。
  await inCard(() => {
    const v = document.querySelector('#vid'); v.pause(); v.currentTime = 5;
    for (const s of ['#chat', '#hearts']) document.querySelector(s).style.visibility = 'hidden';
  });
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => { const w = window.wmRect(); return { x: w.left, y: w.top, width: w.right - w.left, height: w.bottom - w.top }; });
  const on = join(TMP, `.wm-${night}-a.png`), on2 = join(TMP, `.wm-${night}-a2.png`), off = join(TMP, `.wm-${night}-b.png`);
  await writeFile(on, await page.screenshot({ clip }));
  await writeFile(on2, await page.screenshot({ clip }));   // 負控制：什麼都沒改，量這台機器自己的算繪雜訊
  await inCard(() => { for (const s of ['#vid', '#poster']) document.querySelector(s).style.filter = 'invert(1) saturate(4)'; });
  await page.waitForTimeout(150);
  await writeFile(off, await page.screenshot({ clip }));

  // 正控制：畫面中央沒有介面蓋著，同一招量到的差必須很大。量不到就是這支測試壞了，不是畫面好。
  const mid = await page.evaluate(() => { const r = document.querySelector('#phone').getBoundingClientRect();
    return { x: r.x + r.width * .3, y: r.y + r.height * .35, width: r.width * .4, height: r.height * .15 }; });
  await writeFile(join(TMP, `.mid-${night}-b.png`), await page.screenshot({ clip: mid }));
  await inCard(() => { for (const s of ['#vid', '#poster']) document.querySelector(s).style.filter = ''; });
  await page.waitForTimeout(150);
  await writeFile(join(TMP, `.mid-${night}-a.png`), await page.screenshot({ clip: mid }));
  await inCard(() => { for (const s of ['#chat', '#hearts']) document.querySelector(s).style.visibility = ''; });

  const control = maxDiff(join(TMP, `.mid-${night}-a.png`), join(TMP, `.mid-${night}-b.png`));
  const noise = maxDiff(on, on2), diff = maxDiff(on, off);
  const ok = loading && playing && rows > 0 && hit.ok && hit.points >= 10 && diff <= Math.max(noise, 1) && control > 60;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} 第${night}天晚上・直播｜假載入 ${loading}｜播放中 ${playing}｜聊天室 ${rows} 行｜`
    + `命中 ${hit.points} 點露出 ${hit.bad} 點｜像素 反相前後差 ${diff}/255（重截雜訊 ${noise}、沒遮的中央 ${control}）`);
}

/* ── 第五天的留言橋段。送出去要寫 live_comment=true，板子照它分到五之一或五之二 ── */
await page.evaluate(() => { window.setTime(5, 2); window.show('live'); });
await page.waitForTimeout(3200);
await page.frameLocator('#frame').locator('#say').click();
await page.waitForTimeout(5200);                                  // 打字、刪掉、重打
const draft = await inCard(() => document.querySelector('#cfield').textContent);
await page.locator('#phone').screenshot({ path: join(TMP, 'compose.png') });
await page.frameLocator('#frame').locator('#csend').click();
await page.waitForTimeout(500);
const mineIn = await inCard(() => !!document.querySelector('#chat .row.mine'));
const wroteVar = await page.evaluate(() => window.getWrites().some(w => w.name === 'live_comment' && w.value === 'true'));
await page.waitForTimeout(5200);                                  // 設計文件：四秒就不見了
const mineGone = await inCard(() => !document.querySelector('#chat .row.mine'));
if (!(draft === '你記得開場講了什麼嗎' && mineIn && mineGone && wroteVar))
  fail(`第五天留言｜草稿「${draft}」｜送出後有 ${mineIn}｜四秒後沒了 ${mineGone}｜寫了 live_comment ${wroteVar}`);
else console.log(`PASS 第五天留言｜草稿改成「${draft}」｜四秒後滾掉｜卡片寫了 live_comment=true`);

/* ── 其餘三頁與沒開台的直播 ── */
const pages = [
  ['msg',  8, 2, ['格莉奇 開始直播了', '她不回'], 'page-msg'],
  ['feed', 8, 2, ['金魚腦合輯第七集有人剪好了', '@Null_0x99', '兩年前', '考完就刪'], 'page-feed'],
  ['live', 7, 2, ['上次開台：第五天', '聊天室最後一則：今天講到哪了'], 'page-offair'],
  ['live', 13, 2, ['第十三天', '上次開台：第八天', '聊天室最後一則：這集有我'], 'page-offair-d13'],
  ['call', 8, 2, ['沒有人會打來'], 'page-call'],
];
for (const [tab, d, s, want, shot] of pages) {
  await page.evaluate(([t, d, s]) => { window.setTime(d, s); window.show(t); }, [tab, d, s]);
  await page.waitForTimeout(350);
  const txt = await inCard(() => document.querySelector('#page').textContent);
  const paused = await inCard(() => document.querySelector('#vid').paused);
  const missing = want.filter(w => !txt.includes(w));
  await page.locator('#phone').screenshot({ path: join(TMP, shot + '.png') });
  if (missing.length || !paused) fail(`${shot}｜缺 ${JSON.stringify(missing)}｜影片有停 ${paused}`);
  else console.log(`PASS ${shot}｜該有的字都在，離開直播時影片有停`);
}

/* 訊息＝phone_log。則數對 design/調查篇-通關路線.txt 逐日的 [手機] 快照。 */
await page.evaluate(() => { window.setTime(8, 2); window.show('msg'); });
await page.waitForTimeout(250);
const push8 = await inCard(() => [...document.querySelectorAll('#page .msg .bub')].filter(e => e.textContent.includes('開始直播了')).length);
await page.evaluate(() => { window.setTime(5, 2); window.show('msg'); });
await page.waitForTimeout(250);
const push5 = await inCard(() => [...document.querySelectorAll('#page .msg .bub')].filter(e => e.textContent.includes('開始直播了')).length);
await page.evaluate(() => { window.setTime(8, 2); window.setFlag('open_studio'); window.show('msg'); });
await page.waitForTimeout(300);
const withFlag = await inCard(() => document.querySelector('#page').textContent);
await page.locator('#phone').screenshot({ path: join(TMP, 'page-msg-flag.png') });
if (!(push5 === 2 && push8 === 3 && withFlag.includes('有空來工作室')))
  fail(`訊息｜第五天晚上該有 2 則推播，量到 ${push5}；第八天該有 3 則，量到 ${push8}；旗標開了之後斑比那則 ${withFlag.includes('有空來工作室')}`);
else console.log('PASS 訊息｜第五天 2 則推播、第八天 3 則，旗標開了斑比那則才出現');

/* 貼文照天數出現 */
await page.evaluate(() => { window.setFlag('open_studio'); window.setTime(1, 0); window.show('feed'); });
await page.waitForTimeout(300);
const d1 = await inCard(() => document.querySelectorAll('#page .post').length);
if (d1 !== 2) fail(`第一天的貼文數應該是 2，量到 ${d1}`);
else console.log('PASS 貼文照天數出現｜第一天兩則');

/* 收起來：要寫 phone_day_seen 與 open_phone=false，然後 larch:complete */
await page.evaluate(() => { window.setTime(8, 2); window.show('call'); });
await page.waitForTimeout(300);
await page.frameLocator('#frame').locator('#t-close').click();
await page.waitForTimeout(300);
const closed = await page.evaluate(() => {
  const w = window.getWrites();
  return { open: w.some(x => x.name === 'open_phone' && x.value === 'false'),
           seen: w.some(x => x.name === 'phone_day_seen' && x.value === '8'),
           done: w.some(x => x.done) };
});
if (!(closed.open && closed.seen && closed.done))
  fail(`收起來｜open_phone=false ${closed.open}｜phone_day_seen=8 ${closed.seen}｜larch:complete ${closed.done}`);
else console.log('PASS 收起來｜寫了 open_phone=false 與 phone_day_seen=8，然後 larch:complete');

/* 橫幅模式：兩秒後自己走，而且要把那一則寫進 phone_log */
await page.evaluate(() => window.setMode('banner'));
await page.waitForTimeout(900);
const stripIn = await inCard(() => document.querySelector('#strip').classList.contains('in'));
await page.locator('#phone').screenshot({ path: join(TMP, 'banner.png') });
const logWrite = await page.evaluate(() => window.getWrites().find(w => w.name === 'phone_log'));
await page.waitForTimeout(2400);
const bannerDone = await page.evaluate(() => window.getWrites().some(w => w.done));
if (!(stripIn && logWrite && bannerDone))
  fail(`橫幅模式｜條子滑出來 ${stripIn}｜寫了 phone_log ${!!logWrite}｜兩秒後自己走 ${bannerDone}`);
else console.log('PASS 橫幅模式｜條子滑出來、寫了 phone_log、兩秒多一點自己 larch:complete');

await page.evaluate(() => { window.setMode('full'); });
await page.waitForTimeout(900);
await page.evaluate(() => { window.setTime(8, 2); window.show('live'); });
await page.waitForTimeout(700);
await page.locator('#phone').screenshot({ path: join(TMP, 'loading.png') });

if (errs.length) { console.log('主控台錯誤：', errs); bad++; }
await browser.close(); server.close();
console.log(bad ? `\n${bad} 項不過` : '\n全部通過。截圖在 shots/');
process.exit(bad ? 1 : 0);
