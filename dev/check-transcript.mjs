// 通關路線逐字稿的驗收閘。跑：
//
//   node dev/check-transcript.mjs <新的 transcript>
//   node dev/check-transcript.mjs --self-test        ← 負控制：證明弄壞它會紅
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

const dayBlock = (t, d) => {
  const m = t.match(new RegExp(`=== 板 第 ${d} 天[\\s\\S]*?(?==== 板 第 |=== 統計|$)`));
  return m ? m[0] : '';
};
const num = (blk, label) => { const m = blk.match(new RegExp(`${label} (\\d+) 則`)); return m ? Number(m[1]) : null; };

function run(t) {
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
  const mk = (broken) => DAYS.map(d =>
    `=== 板 第 ${d} 天 | 便條：… | 可去：…\n` +
    (broken ? '  [手機] 打不開'
            : `  [手機] 訊息 ${MSG[d]} 則 []；貼文 ${POST[d]} 則：立牌站得有點歪，剛剛｜這禮拜的排程跟上禮｜明天也會開台。你們來｜下個月的新周邊做好｜…`)
  ).join('\n') + '\n=== 統計：出門 48 次，到過 {…}，選過 37 格，1409 秒';
  const good = mk(false), bad = mk(true);

  // 半壞：手機只在三天開得成（例如選擇器改壞之後偶爾還撈得到）。這種最像「路線浮動」。
  const half = DAYS.map((d, i) =>
    `=== 板 第 ${d} 天 | 便條：… | 可去：…\n` +
    (i < 3 ? `  [手機] 訊息 ${MSG[d]} 則 []；貼文 ${POST[d]} 則：立牌站得有點歪，剛剛｜這禮拜的排程跟上禮｜明天也會開台。你們來｜下個月的新周邊做好｜…`
           : '  [手機] 打不開')
  ).join('\n') + '\n=== 統計：出門 48 次，到過 {…}，選過 37 格，1409 秒';

  console.log('好的逐字稿（手機正常）：');
  const g = run(good); show(g);
  console.log('\n全壞（手機每天都「打不開」，autoplay 仍然 exit 0）：');
  const b = run(bad); show(b);
  console.log('\n半壞（只有三天開得成，最像「路線浮動」的那種）：');
  const h = run(half); show(h);

  const red = (rows) => rows.filter(x => x[1] === false).map(x => x[0][0]);
  const gOk = g.every(x => x[1] !== false);
  const eRed = (rows) => rows.some(x => x[0].startsWith('E') && x[1] === false);

  console.log(`\n好的：全綠 ${gOk}｜全壞：${red(b).join('、') || '沒有變紅'}｜半壞：${red(h).join('、') || '沒有變紅'}`);
  console.log('\nB 與 C 在壞掉的那兩份是綠的，那是分工不是漏洞：');
  console.log('  它們只驗逐字稿裡真的有手機那一行的天，為的是容忍訪客隨機（board.html:262）造成的浮動。');
  console.log('  **覆蓋率歸 E 管**——開得成的天數低於下限、或出現任何一行「打不開／出錯」就紅。');
  console.log('  所以：不要拿 B、C 當手機有沒有跑到的證據，要看 E。');

  const fine = gOk && eRed(b) && eRed(h);
  console.log('\n' + (fine
    ? 'PASS 負控制有效：全壞與半壞都被 E 抓到，好的全綠。'
    : 'FAIL 負控制無效——弄壞了 E 還是綠，先修驗收再談整合。'));
  process.exit(fine ? 0 : 1);
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
