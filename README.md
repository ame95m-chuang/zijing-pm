# 紫晶設計｜專案管理系統

放在 GitHub 就能使用的專案期程與工作日誌系統，不需要主機、資料庫或安裝任何軟體。

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html` | 網頁入口 |
| `style.css` | 畫面樣式 |
| `app.js` | 主程式（不需要修改） |
| `config.js` | **設定檔（唯一需要修改的檔案）** |
| `README.md` | 本說明 |

## 架設步驟（約 10 分鐘，只需做一次）

會用到兩個 GitHub 倉庫：一個放程式（公開），一個放資料（私人）。
程式倉庫裡沒有任何公司資料；所有專案與日誌都存在私人的資料倉庫，外人看不到。

### 1. 建立資料倉庫（私人）
1. 登入 GitHub，右上角「＋」→「New repository」。
2. 名稱填 `zijing-data`，選 **Private**，勾選「Add a README file」，按「Create repository」。

### 2. 建立程式倉庫並上傳檔案
1. 再建立一個倉庫，名稱填 `zijing-pm`，選 **Public**。
2. 進入倉庫 →「Add file」→「Upload files」，把這 5 個檔案拖進去 →「Commit changes」。

### 3. 修改設定檔
在 `zijing-pm` 倉庫點開 `config.js` → 右上角鉛筆圖示編輯，把

```js
dataRepo: '',
```

改成（「你的帳號」換成實際的 GitHub 帳號）：

```js
dataRepo: '你的帳號/zijing-data',
```

按「Commit changes」儲存。

### 4. 開啟網站
`zijing-pm` 倉庫 →「Settings」→ 左側「Pages」→ Source 選「Deploy from a branch」，
Branch 選 `main`、資料夾選 `/ (root)` →「Save」。
等 1～2 分鐘，網址會是：`https://你的帳號.github.io/zijing-pm/`

### 5. 產生存取權杖（Token）
系統要用權杖才能讀寫私人資料倉庫。
1. GitHub 右上角頭像 →「Settings」→ 左側最下方「Developer settings」
   →「Personal access tokens」→「Fine-grained tokens」→「Generate new token」。
2. Token name：`紫晶專案管理`；Expiration：選最長期限。
3. Repository access：選「Only select repositories」，只勾 `zijing-data`。
4. Permissions →「Repository permissions」→ **Contents** 設為 **Read and write**。
5. 按「Generate token」，複製 `github_pat_` 開頭的那串文字（只會顯示一次，請妥善保存）。

### 6. 開始使用
打開網址，第一次會要求貼上權杖，貼上後就能使用。每台電腦只需要輸入一次。
同事的電腦也貼同一組權杖即可（請用私訊等安全方式給他們，不要貼在公開的地方）。

## 第一次使用建議
- 首頁 →「系統設定」：確認人員（已預設阿莊、阿彤）、可填寫期間（2026/9/25～2027/9/25）、國定假日（已內建）。
- 需要時可設定個人密碼、主管密碼（防止點錯人用）。
- 「匯入專案檔」可匯入另外提供的 `專案匯入檔_莊01-莊08.json`，把原本 Excel 的專案期程帶進來。
  **這個檔案含公司資料，請不要上傳到公開的 zijing-pm 倉庫。**

## 常見問題

**資料存在哪裡？**
`zijing-data` 倉庫的 `data` 資料夾。每次儲存都會留下一筆修改紀錄，需要時可以在 GitHub 上找回任何時間點的內容。
系統設定頁也可以下載完整備份。

**權杖過期或外流怎麼辦？**
到第 5 步的頁面刪除舊權杖、產生新的，大家重新貼上即可。
清除某台電腦的權杖：系統設定 →「清除這台電腦的存取權杖」。

**改了 config.js 沒生效？**
GitHub Pages 更新需要幾分鐘，等一下再重新整理。

**沒有設定 dataRepo 會怎樣？**
系統會以「單機模式」運作，資料只存在各自電腦的瀏覽器，主管看不到別人的資料。
