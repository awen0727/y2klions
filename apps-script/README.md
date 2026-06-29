# 千禧獅子會 Apps Script 後端

這個資料夾是正式 Google Sheet + Apps Script 後端。

## 檔案

- `Setup.gs`：建立正式資料表、設定、會員匯入表與建置說明。
- `Code.gs`：Web App API，包含會員綁定、報名、簽到、後台登入、權限檢查與操作紀錄。

## 正式建立步驟

1. 建立一個新的 Google Sheet。
2. 開啟「擴充功能」->「Apps Script」。
3. 新增兩個檔案：
   - `Setup.gs`
   - `Code.gs`
4. 把本資料夾中的內容貼到對應檔案。
5. 在 Apps Script 編輯器執行：

```text
setupY2kDatabase
```

6. 回到 Google Sheet，確認出現「千禧獅子會系統」選單與 `SetupGuide` 工作表。
7. 建立第一個系統管理員，在 Apps Script 手動執行：

```text
createY2kAdminUser('admin', '請改成安全密碼', '系統管理員', '系統管理員')
```

## 匯入會員

1. 在 Google Sheet 選單執行「千禧獅子會系統 -> 建立會員匯入表」。
2. 到 `MembersImport` 填入：

```text
會員編號
姓名
手機
會員狀態
生日
```

3. 在 Google Sheet 選單執行「千禧獅子會系統 -> 匯入會員資料」。

系統會依 `會員編號` 新增或更新會員，不會清除既有 LINE 綁定資料。

## 部署 Web App

1. Apps Script 右上角點「部署」。
2. 選「新增部署作業」。
3. 類型選「網頁應用程式」。
4. 執行身分：選「我」。
5. 存取權：選擇系統實際需要的存取範圍。
6. 部署後取得 Web App URL。

前端 `config.js` 的 `apiUrl` 需填入這個 URL。

## 常用 API Action

會員端：

```text
memberIdentity
bindMember
memberHome
registerEvent
cancelRegistration
checkIn
```

後台：

```text
adminLogin
adminLogout
adminDashboard
changeAdminPassword
saveMember
unbindMember
saveEvent
manualCheckIn
cancelCheckIn
```

## 安全注意

- GitHub Pages 前端不可放會員資料、密碼、Token、Secret。
- 後台密碼在 `AdminUsers` 中以雜湊與鹽值儲存。
- 後台登入錯誤預設 5 次鎖定 15 分鐘，可在 `Settings` 調整。
- 後台 API 必須帶 `sessionToken`。
- 系統管理員才可解除 LINE 綁定。
- 匯出資料、補簽到、解除綁定等動作都會寫入 `AuditLogs`。
