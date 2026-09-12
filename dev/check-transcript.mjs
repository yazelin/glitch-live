// 通關路線逐字稿的驗收閘。跑：
//
//   node dev/check-transcript.mjs <新的 transcript>
//   node dev/check-transcript.mjs --self-test                 ← 負控制，跑在合成的逐字稿上
//   node dev/check-transcript.mjs --self-test <真的逐字稿>     ← 同樣四種壞法，但拿真檔來改
//
// **有真檔就用真檔。** 2026-09-12 踩過：合成的逐字稿每天只有一個時段標頭，
// 而真的每天有 2–4 個，切區塊那條正規式因此只涵蓋當天第一個時段、手機永遠落在區塊外，
// B 與 C 恆綠——而負控制在那份合成資料上四種壞法全部正常變紅。
// **fixture 不同形，負控制驗的就是 fixture 不是工具。**
//
// **這一支只管手機。路線歸 glitch-vn 的 tools/route_diff.py 管。**
// 原本這裡有一項 A「路線沒變（逐字比）」，2026-09-12 拿掉了：
// larch/cards/board.html 第 262 行用**未定種子的 Math.random()** 決定訪客出不出現，
// SEED 只管自動玩家選哪一格，管不到遊戲自己的擲骰。所以逐格重現在這個系統上做不到，
// 逐字比一定紅，而那種紅會逼人去找一個不存在的 bug。驗收標準是統計一致。
// （A 本來也抓不到手機壞掉——它的比法把 [手機] 那幾行濾掉了。兩個理由都指向同一件事：
//   路線與手機是兩種東西，要用兩支工具分別驗。）
//
// 為什麼要有這一支，而不是一張表：
// 整合之後 tools/autoplay.mjs 是用 #close 找手機 frame 的，而新卡片那顆叫 #t-close。
// 找不到就掉進 else 印「[手機] 打不開」，**腳本 exit 0**。逐字稿每一天都變那一行，
// 驗收照樣綠——那是會騙過驗收的靜默失敗。而且原本那四個驗收點裡：
//   A（路線 diff）抓不到，因為它的指令是 grep -v '[手機]'，把手機那幾行整個濾掉了；
//   B、C、D 抓得到，但都是靠「那一行不見了」——人很容易把缺席解釋成「那天沒開手機」。
// 所以第五點 E 把缺席變成可數的紅。**負控制（--self-test）要先綠，這份驗收才有意義。**
import { readFile } from 'node:fs/promises';

// 2026-09-12 的基準路線在這幾天開了手機。訪客是未定種子的隨機（board.html:262），
// 所以哪幾天開得成會小幅浮動——**只驗逐字稿裡真的有的那幾天**，缺席由 E 兜底。
const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12];
const FLOOR = 10;   // 開得成的天數下限。低於這個就是手機那段大面積沒跑到
// 訊息則數跟路線綁著（公關窗口與斑比那兩則看旗標什麼時候亮）。這組數字抽自 2026-09-12 的基準。
// **路線真的變了要重新抽一份，不要把數字改小。**
const MSG  = { 1:0, 2:1, 3:1, 4:2, 5:3, 6:3, 7:3, 8:5, 9:5, 11:5, 12:5 };
// 貼文則數用算的：卡片讀到的 day 是板上那一天 +1，所以看到的是累計到第 N+1 天的貼文。
const CUM  = { 1:2, 2:3, 3:4, 4:5, 5:5, 6:6, 7:6, 8:7, 9:8, 10:9, 11:10, 12:11, 13:12 };
const POST = Object.fromEntries([...Array(13)].map((_, i) => [i + 1, CUM[Math.min(i + 2, 13)]]));
const NEW  = ['立牌站得有點歪', '這禮拜的排程', '明天也會開台。你們來', '下個月的新周邊'];

/* 一天有好幾個時段標頭（`=== 板 第 N 天 ・ 上午/下午/晚上/深夜 | …`），
   第一天 2 個、第二三天 3 個、第四天起 4 個，而**手機一律在當天最後一個時段**
   （第 1–3 天在晚上、第 4 天起在深夜）。
   2026-09-12 這裡原本是一條惰性比對加前瞻的正規式，前瞻停在下一個「=== 板 第 」，
   而那通常是**同一天的下一個時段**，所以區塊只涵蓋當天第一個時段，手機永遠落在區塊外，
   B 與 C 恆綠。逐行切就沒有這個問題。 */
function dayBlocks(t) {
  const out = {};
  let cur = null;
  for (const line of t.split('\n')) {
    const m = line.match(/^=== 板 第 (\d+) 天/);
    if (m) cur = Number(m[1]);
    else if (/^=== 統計/.test(line)) cur = null;
    if (cur != null) (out[cur] = out[cur] || []).push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n');
  return out;
}
let BLK = {};
const dayBlock = (t, d) => BLK[d] || '';
const num = (blk, label) => { const m = blk.match(new RegExp(`${label} (\\d+) 則`)); return m ? Number(m[1]) : null; };

function run(t) {
  BLK = dayBlocks(t);
  const r = [];
  // 只看逐字稿裡真的有手機那一行的天；哪幾天開得成由 E 管
  const seen = DAYS.filter(d => num(dayBlock(t, d), '訊息') !== null);
  const badMsg = seen.filter(d => num(dayBlock(t, d), '訊息') !== MSG[d]);
  r.push([`B 訊息則數不變（量到 ${seen.length} 天）`, badMsg.length === 0,
          badMsg.map(d => `第${d}天 ${num(dayBlock(t, d), '訊息')}≠${MSG[d]}`).join('、')]);

  const seenP = DAYS.filter(d => num(dayBlock(t, d), '貼文') !== null);
  const badPost = seenP.filter(d => num(dayBlock(t, d), '貼文') !== POST[d]);
  r.push([`C 貼文則數照表（量到 ${seenP.length} 天）`, badPost.length === 0,
          badPost.map(d => `第${d}天 ${num(dayBlock(t, d), '貼文')}≠${POST[d]}`).join('、')]);

  const missing = NEW.filter(s => !t.includes(s));
  r.push(['D 四則新貼文都出現過', missing.length === 0, missing.join('、')]);

  const open = (t.match(/\[手機\] 訊息/g) || []).length;
  const dead = (t.match(/\[手機\] (打不開|出錯)/g) || []).length;
  r.push([`E 手機真的打開了（${open} 行，下限 ${FLOOR}；打不開或出錯 ${dead} 行，要 0）`,
          open >= FLOOR && dead === 0,
          dead ? '手機那一段沒跑到，上面幾點的「缺席」不是路線造成的'
               : open < FLOOR ? '開得成的天數太少，不像只是訪客隨機造成的浮動' : '']);
  return r;
}
const show = (rows) => rows.forEach(([n, ok, why]) =>
  console.log(`  ${ok === null ? '跳過' : ok ? ' 綠 ' : '*紅*'}  ${n}${why ? '　' + why : ''}`));

/* ── 負控制 ── */
if (process.argv.includes('--self-test')) {
  const realPath = process.argv[process.argv.indexOf('--self-test') + 1];
  const real = realPath ? await readFile(realPath, 'utf8') : null;

  /* 拿真檔改出四種壞法。手機那一段在真檔裡是連續三行
     （訊息／直播頁＋電話頁／回應列），整組換成一行「打不開」才像真的壞掉。 */
  const mutate = (t, fn) => {
    const lines = t.split('\n'), out = [];
    let day = null, run = [];
    const flush = () => { if (run.length) { const r = fn(day, run); if (r) out.push(...r); run = []; } };
    for (const l of lines) {
      const m = l.match(/^=== 板 第 (\d+) 天/);
      if (m) { flush(); day = Number(m[1]); }
      if (/^\s*\[手機\]/.test(l)) { run.push(l); continue; }
      flush(); out.push(l);
    }
    flush();
    return out.join('\n');
  };
  const dead = () => ['  [手機] 打不開'];
  const minus = (label, target) => (d, run) => d !== target ? run
    : run.map(l => l.replace(new RegExp(`${label} (\\d+) 則`), (_, n) => `${label} ${Number(n) - 1} 則`));

  /* fixture 要跟真實逐字稿同形，否則負控制驗的是 fixture 不是工具。
     真實的形狀（量自 design/調查篇-通關路線.txt）：
       第 1 天 2 個時段（下午、晚上），第 2–3 天 3 個（上午、下午、晚上），第 4 天起 4 個（加深夜）
       標頭是「=== 板 第 N 天 ・ 時段 | 便條：… | 可去：…」
       **手機一律在當天最後一個時段**，第 1–3 天在晚上、第 4 天起在深夜
       第 10 與第 13 天沒有開手機 */
  const SLOTS = (d) => d === 1 ? ['下午', '晚上'] : d <= 3 ? ['上午', '下午', '晚上']
                                                 : ['上午', '下午', '晚上', '深夜'];
  const line = (msg, post) =>
    `  [手機] 訊息 ${msg} 則 []；貼文 ${post} 則：立牌站得有點歪，剛剛｜這禮拜的排程跟上禮｜明天也會開台。你們來｜下個月的新周邊做好｜…`;
  // phone(d) 回傳那一天最後一個時段要印的手機那幾行（回 null 代表那天沒開手機）
  const build = (phone) => {
    const out = [];
    for (let d = 1; d <= 13; d++) {
      const slots = SLOTS(d);
      slots.forEach((sl, i) => {
        out.push(`=== 板 第 ${d} 天 ・ ${sl} | 便條：… | 可去：一樓(管理員)、便利商店(店員)`);
        out.push(`→ 選「去便利商店」`);
        out.push(`  旁白 走進去。冷氣很強。`);
        if (i === slots.length - 1) {            // 最後一個時段才開背包
          const ph = phone(d);
          if (ph) out.push(ph);
        }
      });
    }
    out.push('=== 統計：出門 48 次，到過 {…}，選過 37 格，1409 秒');
    return out.join('\n');
  };
  const normal = (d) => DAYS.includes(d) ? line(MSG[d], POST[d]) : null;
  const good = build(normal);

  // 三種壞法加一個邊界案例。每一種都要紅，而且要是「該抓的那一點」抓到的。
  const cases = [
    ['一、手機整個打不開', 'E',
     build((d) => DAYS.includes(d) ? '  [手機] 打不開' : null)],
    ['二、第五天少一則訊息', 'B',
     build((d) => !DAYS.includes(d) ? null : line(d === 5 ? MSG[d] - 1 : MSG[d], POST[d]))],
    ['三、第九天少一則貼文', 'C',
     build((d) => !DAYS.includes(d) ? null : line(MSG[d], d === 9 ? POST[d] - 1 : POST[d]))],
    ['四、半壞：只有三天開得成', 'E',
     build((d) => !DAYS.includes(d) ? null
            : DAYS.indexOf(d) < 3 ? line(MSG[d], POST[d]) : '  [手機] 打不開')],
  ];

  let GOOD = good, CASES = cases;
  if (real) {
    let seen = 0;
    GOOD = real;
    CASES = [
      ['一、手機整個打不開', 'E', mutate(real, dead)],
      ['二、第五天少一則訊息', 'B', mutate(real, minus('訊息', 5))],
      ['三、第九天少一則貼文', 'C', mutate(real, minus('貼文', 9))],
      ['四、半壞：只有三天開得成', 'E', mutate(real, (d, run) => (++seen <= 3 ? run : dead()))],
    ];
    console.log(`（拿真的逐字稿來改：${realPath}）\n`);
  }

  console.log('好的逐字稿（手機正常）：');
  const g = run(GOOD); show(g);
  const gOk = g.every(x => x[1] !== false);

  const red = (rows) => rows.filter(x => x[1] === false).map(x => x[0][0]);
  let allFine = gOk;
  for (const [name, want, text] of CASES) {
    console.log(`\n${name}　（應該由 ${want} 抓到）`);
    const rows = run(text); show(rows);
    const got = red(rows);
    const hit = got.includes(want);
    if (!hit) allFine = false;
    console.log(`  → 變紅的是：${got.join('、') || '沒有'}　${hit ? '✔ ' + want + ' 抓到了' : '✘ ' + want + ' 沒抓到，容忍度開太大'}`);
  }

  console.log('\n容忍度的判準（B、C 用的）：');
  console.log('  只驗逐字稿裡**真的有 [手機] 那一行**的天。整天缺席＝跳過（那是訪客隨機造成的路線擺動），');
  console.log('  有行但數字不對＝紅。**沒有「差一以內都算過」這種寫法**，所以吸收不到「少一則」。');
  console.log('  整天缺席由 E 兜底：行數低於下限、或出現任何一行「打不開／出錯」就紅。');

  // 數字從 cases 算，不要寫死：寫死就會在加案例的時候漂掉，
  // 而「少數了一種」正好是這支工具在防的那種壞法。
  console.log('\n' + (allFine
    ? `PASS 負控制有效：好的全綠，${CASES.length} 種壞法各自被該抓的那一點抓到（`
      + (real ? '真的逐字稿' : '合成逐字稿') + '）。'
    : 'FAIL 負控制無效——有壞法沒被該抓的那一點抓到，先修驗收再談整合。'));
  process.exit(allFine ? 0 : 1);
}

/* ── 正常使用 ── */
const [, , path] = process.argv;
if (!path) { console.log('用法：node dev/check-transcript.mjs <transcript>   或   --self-test'); process.exit(2); }
const t = await readFile(path, 'utf8');
const rows = run(t);
show(rows);
const bad = rows.filter(x => x[1] === false).length;
console.log('\n' + (bad ? `${bad} 點不過，不要覆蓋基準。` : '全部通過。'));
process.exit(bad ? 1 : 0);
