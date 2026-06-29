# y2klions

這個資料夾是千禧獅子會正式系統檔案。

## 前端檔案

```text
index.html
admin.html
styles.css
config.js
utils.js
api.js
member.js
admin.js
```

## 後端檔案

```text
apps-script/Setup.gs
apps-script/Code.gs
apps-script/README.md
```

## 正式部署前

修改 `config.js`：

```js
apiUrl: "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE"
```

把 `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` 換成 Apps Script Web App URL。

如果已建立 LINE LIFF，將 `liffId` 填入 `config.js`。尚未填 LIFF 時，可由入口網址帶入 `lineUserId`。

目前正式 LIFF：

```text
LIFF URL: https://liff.line.me/2010549563-FKKbO0xy
LIFF ID: 2010549563-FKKbO0xy
Endpoint URL: https://awen0727.github.io/y2klions/
```

## 不要放進 GitHub Pages

```text
Google Sheet 會員資料
後台密碼
session token
Apps Script 原始碼以外的私密設定
任何包含個資的匯出檔
```
