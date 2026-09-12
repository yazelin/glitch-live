# glitch-live 待辦

**卡片已釘住：`phone-v1`**
`https://raw.githubusercontent.com/yazelin/glitch-live/phone-v1/card.html`
（commit `b50f6b9`，打 tag 時 verify 深淺各 22 項兩輪全過）
整合過程要改卡片就打 `phone-v2`，不要動 `phone-v1`。


**整合方案在 `整合回-glitch-vn.md`，這裡只留還沒做完的。**

1. 畫面請 yazelin 看過：<https://yazelin.github.io/glitch-live/>。
   三頁各切一次，三晚各切一次，第五天的輸入框按一次，模式切到橫幅看一次，
   「忘掉已讀」按一次看三顆紅點。
2. **整合日必做：在 glitch-vn 那邊加消費端檢查**（整合文件五之一最後有貼好的程式碼）。
   影片走外部網址是拍板的，那條跨 repo 依賴在 glitch-live 這邊已經擋了三層
   （README 警告、`assets/README.md`、verify 查網址回 200），
   但**三層都擋不到「整個 repo 被刪掉」**——那一種只有 glitch-vn 那邊的檢查救得到。
3. 備案沒丟：「公關窗口那通始終沒有打來的電話」寫在五之三最後，那是新正典要 yazelin 定。
4. `~/gemini-watermark-cleaner` 那條路沒走：這一版是用介面蓋掉浮水印，影片沒動過。
   哪天需要沒有浮水印的影片本身（例如全螢幕播），再回頭看那支工具。

## 做完的

- 第五天的留言橋段留在卡片裡（2026-09-12 拍板），`COMPOSE` 維持 `true`，送出寫 `live_comment`。
- 電話那一格拿掉（2026-09-12 yazelin 拍板），直播加紅點，三個已讀變數都寫回 Larch。
- 拆成 `card.html`（卡片本體）與 `index.html`（預覽殼）。
- 橫幅模式補回來。
- 第二部循環影片沒採用，存在 `ref/`，理由寫在 `ref/README.md`。
