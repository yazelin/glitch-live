// 驗收：起一台本機伺服器，把三頁與兩種模式走一遍，證明浮水印被介面蓋住，順便存截圖。
// 結構：index.html 是預覽殼（扮演 Larch 當宿主），card.html 是卡片本體，跑在 iframe 裡。
// 浮水印兩層驗法：
//   命中測試　把浮水印範圍取 5×5 點，elementFromPoint 不能打到影片。
//   像素測試　同一塊截兩張，第二張把影片 filter:invert(1)，兩張要一模一樣。
//             反相而不是把影片藏起來，是因為藏起來會換掉合成層，圓角的抗鋸齒跟著變，
//             量到的 4/255 是算繪差異。配負控制（同畫面重截）與正控制（量沒遮的中央）。
// 深淺兩套外觀都要跑：預設自己把自己跑兩遍（--one 是單跑那一輪用的）。
// 卡片本身沒有主題，所以 iframe 裡那些檢查在兩輪是同一件事；會真的不一樣的是預覽殼那幾項
// 與所有截圖。全部跑兩遍是因為「兩輪都過」比「我判斷哪幾項不受影響」可靠。
// 用法：node verify.mjs        node verify.mjs --headed        node verify.mjs --theme=light
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

/* ── 兩套外觀各跑一遍 ── */
if (!process.argv.includes('--one')) {
  const self = new URL(import.meta.url).pathname;
  const pass = process.argv.slice(2).filter(a => !a.startsWith('--theme='));
  let worst = 0;
  for (const theme of ['dark', 'light']) {
    console.log(`\n━━ 外觀：${theme === 'dark' ? '深色' : '淺色'} ━━`);
    try { execFileSync('node', [self, '--one', '--theme=' + theme, ...pass], { stdio: 'inherit' }); }
    catch { worst = 1; }
  }
  process.exit(worst);
}
const THEME = (process.argv.find(a => a.startsWith('--theme=')) || '--theme=dark').slice(8);
const THEME_ = THEME;

const ROOT = new URL('.', import.meta.url).pathname;
const TMP = join(ROOT, 'shots');
const shot = (n) => join(TMP, THEME === 'light' ? `light-${n}` : n);
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
await page.evaluate(t => window.setTheme(t), THEME);
await page.waitForTimeout(600);

const card = () => page.frames().find(f => f.url().includes('card.html'));
const inCard = (fn, arg) => card().evaluate(fn, arg);
let bad = 0;
const fail = (why) => { bad++; console.log('FAIL ' + why); };

/* ── 供給端：線上那支 mp4 還在不在 ──
   2026-09-12 拍板影片走外部網址，所以 glitch-vn 的正式專案直接指這裡。
   這一項擋的是「檔案被改名或搬走」。擋不到的是「整個 repo 被刪掉」——
   那種情況這支腳本也一起沒了，只有消費端（glitch-vn）的檢查救得到，見整合文件五之一。
   離線就跳過，不要讓沒網路的時候紅一片。 */
{
  const URL_ = 'https://yazelin.github.io/glitch-live/assets/live-loop.mp4';
  let code = null, netErr = null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(URL_, { method: 'HEAD', signal: ac.signal });
    clearTimeout(t);
    code = r.status;
  } catch (e) { netErr = e.name; }
  if (netErr) console.log(`SKIP 線上的 mp4｜連不出去（${netErr}），離線就跳過`);
  else if (code !== 200) fail(`線上的 mp4｜${URL_} 回 ${code}，正式專案指的就是這個網址，它壞了遊戲裡會是一片黑`);
  else console.log('PASS 線上的 mp4｜正式專案指的那個網址回 200');
}

/* ── 手機上那顆深淺鈕 ──
   玩家在這支手機上唯一能碰的東西（yazelin 2026-09-12）。三件要驗：
   按了會換、換了會寫 phone_theme、重新掛載之後還是玩家選的那一套。
   直播那一頁的疊層兩種主題都維持暗的（淺色的字疊在亮影片上讀不到，而且底部那條
   實心遮罩是拿來蓋浮水印的），所以那顆鈕只出現在有狀態列的三頁。 */
{
  await page.evaluate(() => { window.setTime(8, 2); window.show('feed'); });
  await page.waitForTimeout(300);
  const before = await inCard(() => window.getCardTheme());
  const hasBtn = await inCard(() => !!document.querySelector('#tbtn'));
  await inCard(() => window.flipCardTheme());
  await page.waitForTimeout(700);
  const after = await inCard(() => ({ theme: window.getCardTheme(),
    lit: document.querySelector('#screen').classList.contains('t-light'),
    panel: getComputedStyle(document.querySelector('#page')).backgroundColor }));
  await page.locator('#phone').screenshot({ path: shot('card-light.png') });
  const wrote = await page.evaluate(() => window.getSaved().phone_theme);
  // 直播那一頁不吃淺色
  await page.evaluate(() => window.show('live'));
  await page.waitForTimeout(3400);
  const liveDark = await inCard(() => !document.querySelector('#tbtn'));
  const hit2 = await page.evaluate(() => window.checkCover());
  // 重新掛載：玩家選的那一套要還在
  await page.evaluate(() => { window.setMode('full'); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.setTime(8, 2); window.show('feed'); });
  await page.waitForTimeout(400);
  const kept = await inCard(() => window.getCardTheme());
  await inCard(() => { if (window.getCardTheme() === 'light') window.flipCardTheme(); });
  await page.waitForTimeout(600);

  const lum = (c) => { const [r, g, b] = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return (.2126 * r + .7152 * g + .0722 * b) / 255; };
  const ok = hasBtn && before === 'dark' && after.theme === 'light' && after.lit
    && lum(after.panel) > .8 && wrote === 'light' && kept === 'light' && liveDark && hit2.ok;
  if (!ok) fail(`深淺鈕｜有鈕 ${hasBtn}｜按完 ${after.theme}/${after.lit}/底色 ${after.panel}｜`
    + `寫了 phone_theme=${wrote}｜重新掛載後 ${kept}｜直播頁沒有那顆鈕 ${liveDark}｜淺色下浮水印仍蓋住 ${hit2.ok}`);
  else console.log('PASS 深淺鈕｜按了會換、寫回 phone_theme、重新掛載還是淺色；'
    + '直播頁不吃淺色而且浮水印照樣蓋住');
}

/* ── 注入形狀 ──
   push.py 的 phone_feed() 吐出來的 comment.id **自帶 @**（正規表示式是 `(@\\S+?)：`），
   而「兩年前」那一串裡格莉奇自己那一行沒有 @。卡片如果自己再補一個就會變成 @@。
   這一項直接用「注入之後的形狀」餵卡片，因為預設值跟注入值形狀一樣的話，
   只驗預設值是驗不出來的——這個 bug 就是這樣藏到今天的。 */
{
  const inj = await browser.newPage({ viewport: { width: 780, height: 920 } });
  await inj.route('**/card.html', async r => {
    let t = await (await r.fetch()).text();
    t = t.replace('var POSTS = /*@@POSTS@@*/[];',
      'var POSTS = [{day:1,text:"注入的貼文",to:"x",comments:[{id:"@Bambi_Draft3",text:"內頁的格線重排過了",tm:""}]}];');
    t = t.replace('var OLD = /*@@OLD@@*/[];',
      'var OLD = [{id:"@考完就刪",text:"我剛剛考完了。",deleted:true,self:false},' +
      '{id:"格莉奇",text:"謝謝你！我會記得的。",deleted:false,self:true}];');
    await r.fulfill({ body: t, contentType: 'text/html' });
  });
  await inj.goto(base);
  await inj.waitForTimeout(700);
  await inj.evaluate(() => { window.setTime(8, 2); window.show('feed'); });
  await inj.waitForTimeout(400);
  const fr = inj.frames().find(f => f.url().includes('card.html'));
  const ids = await fr.evaluate(() => [...document.querySelectorAll('#page .cm .id')].map(e => e.textContent));
  await inj.close();
  const okIds = ids.length === 3 && ids[0] === '@Bambi_Draft3' && ids[1] === '@考完就刪' && ids[2] === '格莉奇';
  if (!okIds) fail(`注入形狀｜留言 ID 渲染成 ${JSON.stringify(ids)}，應該是 ["@Bambi_Draft3","@考完就刪","格莉奇"]`);
  else console.log('PASS 注入形狀｜push.py 那種自帶 @ 的 id 不會變成 @@，格莉奇那一行也沒有被加 @');
}

/* ── 外觀：切得動、記得住、跟得上系統、對比度夠 ── */
{
  const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = (c) => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };

  const now = await page.evaluate(() => window.getTheme());
  const c = ratio(now.text, now.bg);
  const dark = lum(now.bg) < .18;
  const themeOk = now.attr === THEME_ && now.stored === THEME_ && c >= 4.5 && (THEME_ === 'dark') === dark;

  // 記得住：重新整理之後還是同一套
  await page.reload();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.getTheme());

  // 跟隨系統：清掉選擇之後不該留 data-theme，而且底色要跟著系統走
  await page.evaluate(() => window.setTheme(''));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(200);
  const sysLight = await page.evaluate(() => window.getTheme());
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(200);
  const sysDark = await page.evaluate(() => window.getTheme());
  await page.emulateMedia({ colorScheme: null });
  await page.evaluate(t => window.setTheme(t), THEME);   // 放回這一輪要驗的那套
  await page.waitForTimeout(300);

  const follows = !sysLight.attr && !sysDark.attr && sysLight.stored === null
                  && lum(sysLight.bg) > .5 && lum(sysDark.bg) < .18;
  if (!(themeOk && after.attr === THEME_ && after.stored === THEME_ && follows))
    fail(`外觀｜data-theme=${now.attr} 存 ${now.stored} 對比 ${c.toFixed(2)}｜`
      + `重新整理後 ${after.attr}/${after.stored}｜跟隨系統 ${follows}（淺 ${sysLight.bg} 深 ${sysDark.bg}，屬性 ${sysLight.attr}/${sysDark.attr}）`);
  else console.log(`PASS 外觀｜切得動（data-theme=${now.attr}）、記得住（重新整理後還是 ${after.attr}）、`
    + `沒選過就跟隨系統、正文對比 ${c.toFixed(2)}:1`);
}

/* ── 全域名字撞車 ──
   `var X` 在全域等於 window.X，後面再寫 `window.X = function(){}` 會蓋掉同一個繫結，
   陣列就變成函式。這個坑在這支檔案上踩過三次（wrote、saved、dropTonight），所以擋起來。 */
{
  for (const f of ['index.html', 'card.html']) {
    const src = await readFile(join(ROOT, f), 'utf8');
    const vars = new Set([...src.matchAll(/^\s*var\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
    const hit = [...src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]).filter(n => vars.has(n));
    if (hit.length) fail(`${f}｜window.X 跟 var X 撞名，會把變數蓋成函式：${JSON.stringify([...new Set(hit)])}`);
    else console.log(`PASS ${f}｜掛到 window 的名字沒有跟 var 撞`);
  }
}

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
  await page.locator('#phone').screenshot({ path: shot(`night-${night}.png`) });

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
await page.locator('#phone').screenshot({ path: shot('compose.png') });
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
];
for (const [tab, d, s, want, shotName] of pages) {
  await page.evaluate(([t, d, s]) => { window.setTime(d, s); window.show(t); }, [tab, d, s]);
  await page.waitForTimeout(350);
  const txt = await inCard(() => document.querySelector('#page').textContent);
  const paused = await inCard(() => document.querySelector('#vid').paused);
  const missing = want.filter(w => !txt.includes(w));
  await page.locator('#phone').screenshot({ path: join(TMP, (THEME === 'light' ? 'light-' : '') + shotName + '.png') });
  if (missing.length || !paused) fail(`${shotName}｜缺 ${JSON.stringify(missing)}｜影片有停 ${paused}`);
  else console.log(`PASS ${shotName}｜該有的字都在，離開直播時影片有停`);
}

/* 電話那一格拿掉了（整合回-glitch-vn.md 五之三）：分頁剩三格，那兩行字一個都不能留 */
{
  const tabs = await inCard(() => [...document.querySelectorAll('#tabs button')].map(b => b.textContent.replace(/\s/g, '')));
  const anyCall = await inCard(() => document.body.textContent.includes('沒有人會打來'));
  if (!(tabs.length === 4 && tabs.slice(0, 3).join('|') === '訊息|格莉奇|直播' && tabs[3] === '收起來' && !anyCall))
    fail(`電話拿掉｜分頁是 ${JSON.stringify(tabs)}｜還找得到「沒有人會打來」${anyCall}`);
  else console.log('PASS 電話拿掉｜分頁剩 訊息／格莉奇／直播＋收起來，找不到「沒有人會打來」');
}

/* 紅點：三個都要會亮、看過會滅，而且要寫回變數（不然重新掛載又亮，玩家會學到紅點沒意義） */
{
  await page.evaluate(() => { window.forget(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.setTime(8, 2); });
  await page.waitForTimeout(300);
  // 手機一打開就落在訊息頁（有訊息的話），所以那一格是「當場讀掉」，開場就不該亮。
  // 要驗的是它有沒有把 phone_msg_seen 寫回去。
  const lit = await inCard(() => ({
    msg: !document.querySelector('#dot-msg').hidden,
    feed: !document.querySelector('#dot-feed').hidden,
    live: !document.querySelector('#dot-live').hidden }));
  const msgRead = await page.evaluate(() => window.getSaved().phone_msg_seen === 3);
  await page.locator('#phone').screenshot({ path: shot('dots.png') });
  for (const t of ['feed', 'live']) { await page.evaluate(x => window.show(x), t); await page.waitForTimeout(900); }
  const out2 = await inCard(() => ({
    msg: !document.querySelector('#dot-msg').hidden,
    feed: !document.querySelector('#dot-feed').hidden,
    live: !document.querySelector('#dot-live').hidden }));
  const persisted = await page.evaluate(() => window.getSaved());
  // 重新掛載一次：已讀存得住的話，三個紅點都不該回來
  await page.evaluate(() => { window.setMode('full'); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.setTime(8, 2); });
  await page.waitForTimeout(400);
  const after = await inCard(() => ({
    msg: !document.querySelector('#dot-msg').hidden,
    feed: !document.querySelector('#dot-feed').hidden,
    live: !document.querySelector('#dot-live').hidden }));
  const allLit = !lit.msg && msgRead && lit.feed && lit.live;
  const allOut = !out2.msg && !out2.feed && !out2.live;
  const stayOut = !after.msg && !after.feed && !after.live;
  const vars = persisted.phone_msg_seen === 3 && persisted.phone_day_seen === 8 && persisted.phone_live_seen === 8;
  if (!(allLit && allOut && stayOut && vars))
    fail(`紅點｜清掉已讀後 訊息當場讀掉 ${allLit}(${JSON.stringify(lit)})｜看過都滅 ${allOut}｜重新掛載不再亮 ${stayOut}｜寫回變數 ${vars}(${JSON.stringify(persisted)})`);
  else console.log('PASS 紅點｜格莉奇與直播會亮、訊息落地就讀掉，看過都滅，重新掛載不再亮，三個已讀變數都寫回去了');
}

/* 開台的日子讀 phone_log，不是照天數推：把今晚那一則拿掉，直播頁就該變離線 */
{
  await page.evaluate(() => { window.setTime(8, 2); window.show('live'); });
  await page.waitForTimeout(400);
  const onAirBefore = await inCard(() => !document.querySelector('#screen').classList.contains('page-on'));
  await page.evaluate(() => { window.dropTonight(true); window.setTime(8, 2); window.show('live'); });
  await page.waitForTimeout(400);
  const offAfter = await inCard(() => document.querySelector('#page').textContent.includes('上次開台：第五天'));
  await page.evaluate(() => { window.dropTonight(false); });
  if (!(onAirBefore && offAfter))
    fail(`開台讀 phone_log｜第八天晚上原本在直播 ${onAirBefore}｜抽掉今晚那一則之後變離線且寫「上次開台：第五天」 ${offAfter}`);
  else console.log('PASS 開台讀 phone_log｜抽掉今晚那一則，直播頁就變離線、上次開台退回第五天');
}

/* 送出鈕畫得出來（移植自 glitch-vn c886435，那顆原本是空的 <i>，實玩被當成 icon 不見了） */
{
  await page.evaluate(() => { window.setTime(8, 2); window.show('msg'); });
  await page.waitForTimeout(300);
  const arrow = await inCard(() => {
    const i = document.querySelector('#reply i');
    if (!i) return null;
    const a = getComputedStyle(i, '::after');
    const b = i.getBoundingClientRect();
    return { content: a.content, w: Math.round(b.width), h: Math.round(b.height) };
  });
  const ok = arrow && arrow.content.includes('↑') && arrow.w > 20 && arrow.h > 20;
  if (!ok) fail(`送出鈕｜#reply i 的 ::after 是 ${JSON.stringify(arrow)}，應該畫得出箭頭`);
  else console.log(`PASS 送出鈕｜#reply i 畫得出箭頭（${arrow.content}，${arrow.w}×${arrow.h}）`);
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
await page.locator('#phone').screenshot({ path: shot('page-msg-flag.png') });
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
await page.evaluate(() => { window.setTime(8, 2); window.show('feed'); });
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
await page.locator('#phone').screenshot({ path: shot('banner.png') });
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
await page.locator('#phone').screenshot({ path: shot('loading.png') });

if (errs.length) { console.log('主控台錯誤：', errs); bad++; }
await browser.close(); server.close();
console.log(bad ? `\n${bad} 項不過` : '\n全部通過。截圖在 shots/');
process.exit(bad ? 1 : 0);
