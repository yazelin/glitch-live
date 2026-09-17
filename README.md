> **這個 repo 在供一個正式專案要用的檔案。**
>
> `assets/live-loop.mp4` 會被 glitch-vn（《格莉奇與黑洞先生・調查篇》）的 Larch 正式專案
> 用絕對網址直接引用：
>
> ```
> https://cdn.jsdelivr.net/gh/yazelin/glitch-live@main/assets/live-loop.mp4（Pages 直連從台灣抓 3 MB 要 80 秒，jsDelivr 5 秒；改檔後要 purge：https://purge.jsdelivr.net/gh/yazelin/glitch-live@main/assets/live-loop.mp4）
> ```
>
> **這個 repo 改名、轉私有、刪掉，或是那個檔案改名、搬走，遊戲裡的直播畫面就會壞掉，
> 而且不會有任何錯誤訊息——玩家看到的是一片黑。** 整理這個 repo 之前先讀
> [`整合回-glitch-vn.md`](整合回-glitch-vn.md) 第五節之一。
>
> （這條依賴是 2026-09-12 拍板「影片走外部網址」帶來的。哪天影片改放 Larch 素材庫，
> 這一段就可以拿掉。）

---

# glitch-live

《格莉奇與黑洞先生・調查篇》裡，背包那支手機長什麼樣子。三頁完整原型。

`card.html` **就是 Larch 卡片本體**，整合時整份複製成
[glitch-vn](https://github.com/yazelin/glitch-vn) 的 `larch/cards/phone.html`。
`index.html` 是預覽殼，扮演 Larch 當宿主，用同一套 postMessage 協定
（`larch:ready` / `larch:init` / `larch:set` / `larch:complete`）餵變數給它，
並把卡片寫回來的變數印在右邊。所以在這裡看到的，就是遊戲裡會看到的。

**現在不要整合。** 時機與做法見 [`整合回-glitch-vn.md`](整合回-glitch-vn.md)。

看這裡 → <https://yazelin.github.io/glitch-live/>

右邊主控台可以切第幾天（板走到第十三天，第十四天上午只有結局不經過板）、上午下午晚上深夜，
以及兩個旗標 `met_櫃檯` 與 `open_studio`，三頁的內容跟著變。
「忘掉已讀」那一顆會把三個已讀變數清掉重新掛載，用來看紅點。

## 三頁

| 頁 | 內容 | 來源 |
|---|---|---|
| 訊息 | 收過的推播全留著，最新在上面。輸入框是灰的，「她不回」 | `調查篇-手機.md` 二之一 |
| — | 三則「開始直播了」照她開台的晚上一則一則進來，斑比與公關窗口那兩則靠旗標，不靠天數 | `調查篇-通關路線.txt` 逐日的 `[手機]` 快照 |
| 格莉奇 | 官方帳號。貼文照天數出現，底下有留言；最底下是兩年前那一串，帳號已刪除 | `調查篇-手機.md` 二之二 |
| 直播 | 她在第二、五、八天的晚上開台。其他時候是離線畫面，寫上次開台第幾天與聊天室最後一則 | `調查篇-直播.md` |

原本還有第四頁「電話」，2026-09-12 拿掉了：它沒有任何資料來源，是 `phone_ringing` 廢掉之後
留下來的遺留物。那句「沒有人會打來。」回背包道具的備註欄——有意義的空只需要被看到一次。
依據與連帶改動在 [`整合回-glitch-vn.md`](整合回-glitch-vn.md) 五之三。

**一個字都沒有自己加。** 貼文、留言、ID 的口氣、兩年前那三行、三晚的聊天室，全部照設計文件。

## 手機上那顆深淺鈕

狀態列右邊那顆小鈕，**是玩家在這支手機上唯一能碰的東西**。按下去圖示轉半圈、
新的底色從那顆鈕漫出去、整個螢幕跟著過渡——那是回饋，不是裝飾。

玩家的選擇存在 Larch 變數 `phone_theme`。**不是 localStorage**：那種
`srcdoc` + `sandbox="allow-scripts"` 的 iframe 裡 localStorage／sessionStorage／
indexedDB／cookie 四個全部丟 `SecurityError`，實測在 `dev/probe-sandbox-storage.mjs`。

**直播那一頁不吃淺色**，兩種主題都維持暗的：淺色的字疊在亮影片上讀不到，
而且底部那條實心遮罩是拿來蓋浮水印的。真的串流 app 全螢幕播放時也一律是暗的。
所以那顆鈕只出現在有狀態列的三頁。

| 深 | 淺 |
|---|---|
| ![手機深色](shots/card-dark.webp) | ![手機淺色](shots/card-light.webp) |

## demo 外框的深淺外觀

這一組是 demo 站自己的外框（主控台最上面），跟手機裡那顆鈕是兩回事。

三態：沒選過就跟隨系統（`prefers-color-scheme`，不寫 `data-theme`），
選了記在 `localStorage['glitch-live-theme']`，重新整理還是那一套。
第一次進站不硬塞一個值。無痕視窗或擋了 site data 時 `localStorage` 會丟例外，
接住之後退回跟隨系統。

切換放在主控台最上面，不做浮動按鈕：窄螢幕時手機的右上角是「追蹤」，
浮動按鈕會壓在它上面。主控台在手機外框之外，任何寬度都不會擋到內容。

`verify.mjs` 兩套各跑一遍（`node verify.mjs` 預設就是兩遍），截圖分開存：
淺色那一輪的檔名前面多一個 `light-`。

| 深 | 淺 |
|---|---|
| ![深色](shots/demo-dark.webp) | ![淺色](shots/demo-light.webp) |

## 紅點

分頁列唯一的新鮮度訊號。兩條規矩：

| 分頁 | 什麼時候亮 | 看過之後寫回 |
|---|---|---|
| 訊息 | `phone_log` 的則數 > `phone_msg_seen` | `phone_msg_seen` |
| 格莉奇 | 有今天以前、還沒看過的貼文 | `phone_day_seen` |
| 直播 | 今晚在開台，而且今天還沒看過 | `phone_live_seen` |

1. **掛變數不掛天數。** 「今晚開不開台」讀的是 `phone_log` 裡今晚那一則「開始直播了」，
   不是照 `[2,5,8]` 推。跟訊息同一個來源。
2. **已讀要寫回 Larch。** 不寫回去的話卡片一重新掛載紅點就又亮了，
   玩家會學到紅點沒有意義，那比沒有紅點更糟。
訊息那一頁的則數對過 `design/調查篇-通關路線.txt`：第五天晚上兩則推播、第八天三則。

## 直播頁

1. 開場是假載入：連線中、取得串流網址、緩衝 720p、進聊天室，約 2.4 秒。這段只有模糊的預覽圖與標題列。
2. 載完換成 `LIVE`，影片開始循環播放，聊天室一行一行滾、人數往上跳、愛心往上飄。
3. 三晚各有自己的節奏：第二天人數從六百跳到七百、字快；第五天她在唸 ID，被唸到的那幾則是薄荷色的；
   第八天晚上九點整排的早安，中間夾一則「金魚腦合輯 第七集」的連結。
4. **第五天的留言橋段做成可以按的**：輸入框亮起來，點下去會看見她打「你記得昨天講到哪嗎」，
   停三秒，把後半句刪掉改成「開場講了什麼嗎」，兩個選擇是「送出去」與「不打」。
   送出去那一行會進聊天室，四秒之後滾掉。她沒有唸到。

**影片本身一幀都沒有動。** 右下角那個 Gemini 浮水印是靠底部的聊天室、輸入列與分頁列蓋掉的。

## 浮水印怎麼確定真的蓋住了

`assets/live-loop.mp4` 是 Gemini 生的，右下角有星形浮水印，量到的位置是影片正規化座標
`x 0.78–0.90、y 0.86–0.95`，峰值比周圍的地板亮 28 階。半透明的遮罩只會把它壓暗、壓不掉，
所以底部那塊遮罩到螢幕 84% 就是實心的，浮水印整個埋在下面。

驗法四項，`node verify.mjs` 會跑（全部十五項）：

| 測什麼 | 怎麼測 | 過的條件 |
|---|---|---|
| 命中測試 | 浮水印範圍取 5×5 點，每點 `elementFromPoint` | 一點都不能打到影片 |
| 像素測試 | 同一塊截兩張，第二張把影片 `filter:invert(1)` | 兩張要完全一樣 |
| 負控制 | 什麼都不改，同一塊重截一次 | 量這台機器自己的算繪雜訊 |
| 正控制 | 同一招量畫面中央（沒有介面蓋著） | 差必須很大，量不到代表測試壞了 |

為什麼用反相：把影片藏起來會換掉合成層，圓角的抗鋸齒跟著變，量到的 4/255 其實是算繪差異。
第一版就是這樣誤判的，加了負控制才看出來。

`verify.mjs` 同時會走完三頁、紅點與已讀、第五天的留言橋段、貼文照天數出現，全部有截圖。

瀏覽器裡也能自己看：網址加 `?wm=1` 會把浮水印的範圍畫成紅框，
右邊主控台的「驗浮水印」按鈕跑的是同一支命中測試。

### 先裝相依

驗收工具（`verify.mjs`、`dev/*.mjs`）要 **playwright**：

```bash
npm i                        # 裝 playwright 套件
npx playwright install chromium   # 第一次在這台機器上跑才需要（會下載瀏覽器）
```

**之前這件事沒有人需要寫**，因為 repo 裡有一個 `node_modules` symlink 指向隔壁
`glitch-2d` 借用套件。那個 symlink 在 2026-09-12 被刪掉了（指向本機絕對路徑的
symlink 進版控，在任何別的機器上都是壞的），所以從這裡開始要自己裝。

```
npm i                        # 只為了 playwright
node verify.mjs              # 深淺各跑一遍，截圖存到 shots/
node verify.mjs --theme=light  # 只跑淺色那一輪
node verify.mjs --headed     # 開視窗看
```

## 驗線上那個站

`verify.mjs` 自己起一台 server 讀**本機檔案**，所以它驗不到部署出去的東西。
`dev/check-live.mjs` 打真站量：

```bash
node dev/check-live.mjs              # 量 https://yazelin.github.io/glitch-live/
node dev/check-live.mjs --self-test  # 負控制：送一份被改過的 card.html，L1 要紅
```

**L1 最重要**：線上那一份 `card.html` 要跟釘住的 tag 逐 byte 相同。
「推上去了」跟「線上是新的」是兩件事——Pages 有快取。

2026-09-12 實際跑的：

```
量的是：https://yazelin.github.io/glitch-live/

   綠   L1 線上的 card.html ＝ phone-v2
        量到：線上 47551 bytes／sha 6ff82e278dc4e1de　vs　phone-v2 47551 bytes／sha 6ff82e278dc4e1de（HTTP 200）
   綠   L2 深淺鈕在狀態列、按了會換、過場真的動
        量到：鈕 26×26、在狀態列內 true、離訊號圖示 9px、主題 dark→light、頁底色 rgb(244, 246, 249)（亮度 0.96）、圖示 sun→moon、過場 animation-name=wipe、鈕 class=spin
   綠   L3a 外框的深淺，重新整理記得住
        量到：data-theme=light、localStorage=light、底色 rgb(238, 241, 245)
  SKIP  L3b 手機那顆的深淺，重新整理記得住
        量到：重新整理之後卡片主題是 dark（切成 light 之後重整）
        量不到，而且**這是預覽殼的設計不是 bug**：那顆存的是 Larch 變數 phone_theme，
        而 sandbox iframe 裡 localStorage 一碰就 SecurityError（dev/probe-sandbox-storage.mjs 實測），
        所以卡片只能靠 larch:set 寫回宿主。遊戲裡宿主是 Larch，變數進存檔所以記得住；
        這個 demo 的宿主是 index.html，它把變數放在記憶體（var saved），重新整理就沒了。
        **要在 demo 上也量得到，得讓預覽殼把 phone_theme 也寫進 localStorage——那是行為改動，沒做。**
   綠   L4 直播頁不吃淺色、浮水印仍然蓋住
        量到：那頁沒有深淺鈕 true、沒有 t-light true、影片播放中 true、命中測試 25 點露出 0 點、影片反相前後的 PNG 完全相同

  沒有紅的，但 1 項沒驗到。**這不等於全過。**（結束碼 2）
```

負控制：

```
負控制：起一台本機站，card.html 多塞一行註解（47551 → 47574 bytes）

  線上 47574 bytes／sha f56ba146eb614c49
  phone-v2 47551 bytes／sha 6ff82e278dc4e1de
  → L1 *紅*（抓到了）

PASS 負控制有效：線上那一份跟釘住的不一樣就會紅。
```

## 檔案

```
card.html                  卡片本體。整合時整份複製成 glitch-vn/larch/cards/phone.html
                           **目前釘在 tag phone-v2（c411160）**，要改就打 phone-v3，
                           不要動已經發出去的 tag——w1D 是照那個 tag 拉的
index.html                 預覽殼，扮演 Larch 當宿主。不進遊戲
assets/live-loop.mp4       直播畫面，720×1280、10 秒、首尾同幀可以無縫循環
assets/poster.webp         載入時的預覽圖，也是頭像的來源
ref/                       設計參考圖（含一支沒採用的循環影片，理由在 ref/README.md）
快照/                      Larch 專案整包快照。那個平台的 PUT 會清空版子，這是唯一的回頭路

驗收工具（全部要 playwright，見上面「先裝相依」）
  verify.mjs                     卡片本身。深淺各跑一遍，每輪 23 項
  dev/check-live.mjs             **部署出去的站**。verify.mjs 只讀本機檔，驗不到這個
  dev/check-transcript.mjs       通關逐字稿裡手機那幾行。四點，--self-test 是負控制
  dev/probe-sandbox-video.mjs    平台能力探測：sandbox iframe 載不載得動跨網域影片
  dev/probe-sandbox-storage.mjs  平台能力探測：sandbox iframe 存不存得住東西（答案是不行）
  給-glitch-vn/storylint.py      給 glitch-vn 用的靜態檢查，套進它的 tools/

文件（各自對著不同的讀者）
  整合回-glitch-vn.md            要改手機卡片／要做整合的人
  交辦-重產通關路線基準.md        要重產通關基準的人（第四節是整合時 autoplay.mjs 要改的五處）
  規格-劇情模式順順通關.md        第五道關的三層判準
  規格-配音與BGM掛回板子.md       要把配音與 BGM 掛回板子的人
  NEXT.md                        還沒做完的，以及今天學到而且會再犯的幾條
```

## 兩種模式

卡片跟舊的 `phone.html` 一樣吃推送層注入的 `MODE`：

- `full`　從背包打開，三頁。收起來時寫 `open_phone=false` 與 `phone_day_seen`。
- `banner`　收到訊息的橫幅，頂端一條，兩秒後把那一則寫進 `phone_log`，自己 `larch:complete`。
  底是透明的（`調查篇-手機.md` 六），預覽殼會在 iframe 後面放一張圖，透得出來就看得到她。

主控台的「模式」那兩顆可以切。

## 搬進 Larch 之前要處理的

見 [`整合回-glitch-vn.md`](整合回-glitch-vn.md)。還沒拍板的三件在第五節：
影片放哪、第五天的留言橋段怎麼接。電話那一格已拍板拿掉。

## 授權

程式碼 MIT。`assets/` 與 `ref/` 裡的圖與影片屬於《格莉奇與黑洞先生》，不在 MIT 範圍內。
