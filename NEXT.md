# glitch-live 待辦

1. 畫面請 yazelin 看過：<https://yazelin.github.io/glitch-live/>。四頁各切一次，三晚各切一次，
   第五天的輸入框按一次。過了才動 Larch。
2. 搬進 `glitch-vn/larch/cards/phone.html`，四頁整份換掉：
   - `day`、`slot`、`phone_log`、`open_studio`、`met_櫃檯`、`phone_day_seen` 照原本那份讀 Larch 變數，
     主控台那一塊不進遊戲。
   - 訊息頁現在是照天數推出來的預覽，遊戲裡要回去讀 `phone_log`。
   - 橫幅模式（`MODE=banner`）原本那一份還在，這一版沒有做，搬的時候要接回去。
3. 第五天的留言橋段現在只是演給人看。遊戲裡它是一個 choice（`調查篇-直播.md` 第五天），
   要決定是留在插件卡裡寫變數，還是回板上讓 Larch 的選項卡處理。
4. 影片放哪還沒決定：Larch 素材庫還是外部網址。插件卡吃不吃得動 3.2 MB 的 mp4 要實測。
5. 自動播放要 `muted`，聲音留給玩家自己開。插件卡沙箱的限制先查 larch-vn skill
   （`reference_larch_plugin_sandbox_no_mic` 那一類的坑）。
6. `~/gemini-watermark-cleaner` 那條路沒走：這一版是用介面蓋掉浮水印，影片沒動過。
   哪天需要沒有浮水印的影片本身（例如全螢幕播），再回頭看那支工具。
