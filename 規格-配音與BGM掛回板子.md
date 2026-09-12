# 規格：把配音與 BGM 掛回板子

第五道關第三層的三個 SKIP 要轉成實驗，缺的就是這一步
（`規格-劇情模式順順通關.md` 第三節）。

**先講結論：這條路已經存在，而且已經拍過板，只是調查篇沒接上。**
正篇有全套（產聲音、發佈、查表掛卡片、背景對 BGM），
`larch/inv/build.py`（調查篇）裡 `voiceUrl`、`urls.json`、`bgm` 三個字一次都沒出現。

---

## 零、現況（2026-09-12 量的）

| 量到什麼 | 數字 | 意思 |
|---|---|---|
| 板上台詞 | 1828 句，掛了 `voiceUrl` 的 **0 句** | 調查篇一句都沒掛 |
| 板上 BGM | 宣告 `bgm` 的卡 **0 張** | 調查篇一張都沒掛 |
| 本機錄音 | `art/voice/spoken.json` **1205 筆** | 錄好了 |
| 已發佈的網址表 | `art/voice/urls.json` **736 筆** | 這是**正篇**那批 |
| 已發佈的檔 | `docs/voice/` **890 個 mp3** | |
| 兩張表共用的鍵 | **15 個** | `spoken.json` 與 `urls.json` 幾乎是兩套鍵空間 |

**所以調查篇的錄音一筆都還沒進 `urls.json`**，而 `urls.json` 是建置唯一會查的表。

順帶量到兩個現存缺陷，見第五節。

---

## 一、voiceUrl 從哪裡來

**走 GitHub Pages，不走 Larch 上傳。這件已經拍板了，寫在 `tools/publish_voice.py` 檔頭：**

> 平台的上傳實測每分鐘只傳得動兩個（單筆二十五秒，跟檔案大小無關，八條並行會撞 429），
> 六百多個要五小時。這個專案的 Pages 來源就是 `docs/`，把檔案放進去就有網址，免上傳免額度。

另外有一條同方向的實測（`reference_larch_api_slow_upload_split`）：
`POST /media` 比網頁上傳慢大約 70 倍，而且**502 不等於沒寫入**——
收到 502 一定要先 GET 回專案查真實的 id 與 url，直接重試會產生重複素材。
**所以不要為了「資產集中」把六百個 mp3 推進 Larch。**

### 怎麼做

```bash
cd ~/glitch-vn
python3 tools/publish_voice.py          # 複製進 docs/voice/ 並寫 art/voice/urls.json
python3 tools/publish_voice.py --push   # 順便 commit 與 push
```

- **誰傳**：w1D 在本機跑，因為錄音檔在它的硬碟上。
- **傳到哪**：`docs/voice/`，網址是 `https://yazelin.github.io/glitch-vn/voice/<代號>.mp3`。
- **代價**：那些檔會進 git 歷史（正篇那批約 27 MB）。這是已經接受過的代價。
- **要等 Pages 佈署**，推完不是立刻可用。

### 失敗怎麼知道

`publish_voice.py` 只是複製加寫表，它不會告訴你網址通不通。所以加一條對帳
（第四節那支腳本會做）：**`urls.json` 裡的每一個代號，`docs/voice/` 裡都要有對應的檔**。
現在有 **57 個沒有**（第五節）。

---

## 二、對應關係怎麼建立

### 機制已經有了：`larch/novelkit.py` 的 `_voice()`

它用 `voice.key(speaker, text, emotion)` 去查 `urls.json`，查到就寫 `voiceUrl`。
多人卡掛在 `dialogueLines[i]` 上，單人卡掛在卡片層。

**那個檔自己寫了這條路最危險的地方：**

> 查表的鍵一定要跟 `tools/gen_voice.py` 收句子時算的一模一樣：
> 單人卡用卡片的 speaker/text/emotion，多人卡用每一行自己的三個欄位。
> **差一個欄位就全部對不上，而且不會報錯，只會安靜地沒有聲音。**

所以這一步的規矩只有一條：**對不到的必須被數出來。**

### 要求

`larch/inv/build.py` 接上 `novelkit._voice()` 的時候，**建置必須印出三個數字**：

```
配音：板上 1828 句　掛上 N 句　對不到 M 句
對不到的前五句：（講者｜前 20 字｜emotion）
```

`M > 0` 不一定是錯的（路人還沒選音色、純刪節號的沉默不該配音），
**但它必須被印出來並且有人看過**。今天的教訓：靜默跳過跟成功長得一模一樣。

### 這一步之前要先做的

`spoken.json` 與 `urls.json` 幾乎沒有共用鍵，所以**調查篇的錄音要先跑一次
`publish_voice.py`**，`urls.json` 才會有調查篇那 1205 筆。順序不能反。

---

## 三、BGM 掛在哪一層

**卡片層（`data.bgm`），而且是在 build 產生的時候就寫進去**，不是推上去之後另外補。

正篇的做法在 `larch/novelkit.py`：一張**背景 → BGM** 的對照表，
建置時查表寫進卡片。檔頭那句是理由：

> 靠人記會漂。要換的地方在 build 腳本裡明寫 `bgm=`。

調查篇要自己一張表，鍵是它自己的背景代號（`bg-investigation/*`）。
`art/bgm/` 裡已經有曲子（`bgm-cold`、`bgm-living`、`bgm-morning`、`bgm-notebook`…）。

### 三條規矩

1. **只在換曲點寫。** 沒寫的卡會延續前一首，那是平台行為不是 bug。
2. **空字串等於沒設**，前一首會繼續播。要靜音得掛一段真的無聲音軌
   （`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 5 -b:a 32k silence.mp3`，20 KB）。
3. 有配音的段落音量壓在 **0.24–0.32**，再高會蓋掉台詞。

`storylint.py` 的 S2 就是在驗第 2 條：它會把空字串判紅。

---

## 四、推上去之後怎麼確認真的進去了

**這一節最重要。** 「推完了」跟「真的寫進去了」是兩件事——
編輯器分頁會把版子打回舊版，而且完全不報錯。

### 四步，順序不能換

```bash
cd ~/glitch-vn

# 1. 發佈聲音，讓 urls.json 有調查篇那批
python3 tools/publish_voice.py --push

# 2. 對帳：urls.json 的每個代號都要有檔
#    （這一支還沒有，見第五節。在那之前先手動比對）

# 3. 重跑建置，看它印出來的三個數字（第二節那個要求）
python3 larch/inv/build.py

# 4. 推上去，然後**回讀對卡數**
#    編輯器分頁開著會把版子打回舊版，推完必對卡數
```

### 然後跑 storylint，這是真正的判準

```bash
python3 tools/storylint.py
```

| 推之前 | 推之後應該 |
|---|---|
| S2 BGM　SKIP（0 張卡有 bgm） | **綠或紅** |
| S3 語音　SKIP（0 句有 voiceUrl） | **綠或紅** |
| 結束碼 2 | 全掛上就是 **0**；有漏就是 **1** |

**轉不動就表示沒真的寫進去。** SKIP 還是 SKIP 的話，不管建置印了什麼、
不管 push 回了什麼，那批東西就是沒進板子。這一條比任何「已推送」的訊息可靠，
因為它讀的是板子本身。

S4（匯出版的語音閘）要另外抓專案整包才驗得到：

```bash
curl -s -H "Authorization: Bearer $KEY" \
  "https://larch.ink/api/agent/projects/<專案ID>" -o /tmp/proj.json
python3 tools/storylint.py --project /tmp/proj.json
```

`project.languages[].voiceMode` 要設。**線上播放器看卡片的 `voiceMode`，
匯出的單檔版只看 `project.languages[].voiceMode`，兩邊各要各的**，
少一邊會出現「線上七百句都正常、匯出版一句都不播、而且完全不報錯」。

### 負控制

照今天的慣例，不能省：

| 弄壞什麼 | 應該怎樣 |
|---|---|
| 把 `art/voice/urls.json` 暫時改名，重跑建置與 storylint | S3 退回 **SKIP**（證明 S3 真的在讀板子，不是記憶中的狀態） |
| 挑一張卡的 `bgm` 改成空字串 | S2 **紅**（`storylint --self-test` 的案例五已經證明過） |
| 建置時故意把 `_voice()` 的 key 少帶 emotion | 「對不到 M 句」的 M 應該暴增 |

第三項是在驗第二節那個「差一個欄位就靜默沒聲音」——**那是這條路最容易出事的地方，
而它的失敗長相是「建置成功、推送成功、遊戲裡沒聲音」。**

---

## 五、掛載之前要先處理的兩件（我量到的現存缺陷）

### 之一、57 個死網址

`urls.json` 裡有 **57 個代號**，`docs/voice/` 與 `art/voice/` 都找不到對應的檔。
那些 `voiceUrl` 推上去就是 404——而**音檔載不到不會讓卡片壞掉，只會沒有聲音**，
所以沒有人會發現。

樣本：`v-04758bc36bf938bc`、`v-095f3a92d6178363`、`v-098e816736712f31`。

要嘛補檔、要嘛從 `urls.json` 拿掉。**建議寫成一支對帳腳本**
（`tools/voice_reconcile.py`），三個數字一起對：
`urls.json` 筆數、`docs/voice/` 檔數、板上掛上 `voiceUrl` 的句數。

### 之二、211 個孤兒檔

`docs/voice/` 裡有 **211 個 mp3 不在 `urls.json` 裡**，樣本是
`intro-bambi`、`intro-blackhole`、`intro-catgrass`——看起來是開場介紹那批，
用另一套代號。**確認一下那是故意的**（它們可能由別的地方直接引用網址），
是故意的就在 `publish_voice.py` 檔頭註明，免得下一個人以為是漏寫。

---

## 六、順序

```
1. 對帳並修掉 57 個死網址（第五節之一）
2. publish_voice.py --push          → urls.json 有調查篇那 1205 筆
3. inv/build.py 接上 novelkit._voice()，並印出「掛上 N 句／對不到 M 句」
4. 調查篇自己的 背景 → BGM 對照表，build 時寫進 data.bgm
5. 推上去，回讀對卡數
6. storylint.py → S2 S3 必須從 SKIP 轉成綠或紅。轉不動就是沒進去
7. 負控制三項（第四節）
8. 抓專案整包，storylint --project 驗 S4
```

**第 6 步是這道關的判準，不是第 5 步。** 推送成功只代表送出去了。
