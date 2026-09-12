// 通關路線逐字稿的驗收閘。跑：
//
//   node dev/check-transcript.mjs <新的 transcript> [舊的基準]
//   node dev/check-transcript.mjs --self-test        ← 負控制：證明弄壞它會紅
//
// 為什麼要有這一支，而不是一張表：
// 整合之後 tools/autoplay.mjs 是用 #close 找手機 frame 的，而新卡片那顆叫 #t-close。
// 找不到就掉進 else 印「[手機] 打不開」，**腳本 exit 0**。逐字稿每一天都變那一行，
// 驗收照樣綠——那是會騙過驗收的靜默失敗。而且原本那四個驗收點裡：
//   A（路線 diff）抓不到，因為它的指令是 grep -v '[手機]'，把手機那幾行整個濾掉了；
//   B、C、D 抓得到，但都是靠「那一行不見了」——人很容易把缺席解釋成「那天沒開手機」。
// 所以第五點 E 把缺席變成可數的紅。**負控制（--self-test）要先綠，這份驗收才有意義。**
import { readFile } from 'node:fs/promises';

const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12];          // 這一輪路線有開手機的那幾天
const MSG  = { 1:0, 2:1, 3:1, 4:2, 5:3, 6:3, 7:3, 8:5, 9:5, 11:5, 12:5 };
const POST = { 1:3, 2:4, 3:5, 4:5, 5:6, 6:6, 7:7, 8:8, 9:9, 11:11, 12:12 };  // 補完 9–13 天之後
const NEW  = ['立牌站得有點歪', '這禮拜的排程', '明天也會開台。你們來', '下個月的新周邊'];

const strip = (t) => t.split('\n').filter(l => !l.includes('[手機]')).join('\n')
                      .replace(/，\d+ 秒/, '，N 秒');
const dayBlock = (t, d) => {
  const m = t.match(new RegExp(`=== 板 第 ${d} 天[\\s\\S]*?(?==== 板 第 |=== 統計|$)`));
  return m ? m[0] : '';
};
const num = (blk, label) => { const m = blk.match(new RegExp(`${label} (\\d+) 則`)); return m ? Number(m[1]) : null; };

function run(t, baseline) {
  const r = [];
  r.push(['A 路線沒變（把手機那幾行濾掉之後比）', baseline == null ? null : strip(t) === strip(baseline),
          baseline == null ? '沒給基準，跳過' : '']);

  const badMsg = DAYS.filter(d => num(dayBlock(t, d), '訊息') !== MSG[d]);
  r.push(['B 訊息則數不變', badMsg.length === 0,
          badMsg.map(d => `第${d}天 ${num(dayBlock(t, d), '訊息')}≠${MSG[d]}`).join('、')]);

  const badPost = DAYS.filter(d => num(dayBlock(t, d), '貼文') !== POST[d]);
  r.push(['C 貼文則數照表', badPost.length === 0,
          badPost.map(d => `第${d}天 ${num(dayBlock(t, d), '貼文')}≠${POST[d]}`).join('、')]);

  const missing = NEW.filter(s => !t.includes(s));
  r.push(['D 四則新貼文都出現過', missing.length === 0, missing.join('、')]);

  const open = (t.match(/\[手機\] 訊息/g) || []).length;
  const dead = (t.match(/\[手機\] (打不開|出錯)/g) || []).length;
  r.push([`E 手機真的打開了（${open}/${DAYS.length} 行，打不開或出錯 ${dead} 行）`,
          open === DAYS.length && dead === 0,
          dead ? '手機那一段整個沒跑到，上面幾點的「缺席」不是路線造成的' : '']);
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

  console.log('好的逐字稿（手機正常）：');
  const g = run(good, good); show(g);
  console.log('\n壞的逐字稿（手機每天都「打不開」，autoplay 仍然 exit 0）：');
  const b = run(bad, good); show(b);

  const gOk = g.every(x => x[1] !== false);
  const bCaught = b.filter(x => x[1] === false).map(x => x[0][0]);
  const eCaught = b.some(x => x[0].startsWith('E') && x[1] === false);
  console.log(`\n好的：全綠 ${gOk}｜壞的：${bCaught.length}/5 點變紅（${bCaught.join('、')}）`);
  console.log(b.find(x => x[0].startsWith('A'))[1]
    ? '注意：A 在壞掉的那份仍然是綠的——它的比法把手機那幾行濾掉了，本來就看不到這種壞法。'
    : '');
  const fine = gOk && eCaught && bCaught.length >= 3;
  console.log('\n' + (fine
    ? 'PASS 負控制有效：故意弄壞會紅，而且 E 一定抓得到。'
    : 'FAIL 負控制無效——弄壞了還是綠，先修驗收再談整合。'));
  process.exit(fine ? 0 : 1);
}

/* ── 正常使用 ── */
const [, , path, basePath] = process.argv;
if (!path) { console.log('用法：node dev/check-transcript.mjs <transcript> [baseline]   或   --self-test'); process.exit(2); }
const t = await readFile(path, 'utf8');
const baseline = basePath ? await readFile(basePath, 'utf8') : null;
const rows = run(t, baseline);
show(rows);
const bad = rows.filter(x => x[1] === false).length;
console.log('\n' + (bad ? `${bad} 點不過，不要覆蓋基準。` : '全部通過。'));
process.exit(bad ? 1 : 0);
