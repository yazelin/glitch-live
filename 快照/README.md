# 快照

## 調查篇-2026-09-12.json.gz

Larch 專案 `project-d2fea918-c0eb-4ab6-aefb-2fe9a75dc7c4`（《格莉奇與黑洞先生・調查篇》）
的整包快照，**2026-09-12 10:5x 抓的**。

```bash
curl -s -H "Authorization: Bearer $(cat ~/.config/larch/key)" \
  "https://larch.ink/api/agent/projects/project-d2fea918-c0eb-4ab6-aefb-2fe9a75dc7c4" \
  -o 調查篇-2026-09-12.json
```

原始 2,725,886 bytes，776 張卡。只做過 `GET`，沒有任何寫入。

### 為什麼留著

**那個平台的 `PUT /projects/:id` 會清空版子，而且不報錯**
（`reference_larch_project_put_wipes`：body 沒包一層 `{"project": …}` 會把整個專案寫成空的，
包對了也仍然會把 boards 清掉）。伺服器的版本端點讀不到單一版本的內容，
所以**自己的快照是唯一救得回內容的東西**。

有人動壞了專案就用這一份回頭。還原本身也是一次寫入，所以動手前先再抓一份現況存起來。

### 裡面沒有金鑰

抓下來當場掃過：`settings.liveApiKey` 是 `None`（GET 會遮蔽），
`lpk_`／`sk-`／`Bearer`／JWT 四種樣式命中 0，角色 0 個所以沒有 `secrets`。
劇本文字本來就在公開的 glitch-vn repo 裡，所以放在這個公開 repo 沒有新增暴露。

### 怎麼用

```bash
gunzip -k 調查篇-2026-09-12.json.gz
python3 tools/storylint.py --project 快照/調查篇-2026-09-12.json    # 驗 S4
```
