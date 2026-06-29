const Y2K_SHEET_SCHEMA = {
  Members: [
    '會員編號',
    '姓名',
    '手機',
    '會員狀態',
    '生日',
    'LINE User ID',
    'LINE顯示名稱',
    '綁定時間',
    '最後登入時間',
    '建立時間',
    '更新時間'
  ],
  AdminUsers: [
    '帳號',
    '密碼雜湊',
    '密碼鹽值',
    '姓名',
    '角色',
    '狀態',
    '登入失敗次數',
    '鎖定到期時間',
    '最後登入時間',
    '建立時間',
    '更新時間'
  ],
  AdminSessions: [
    'Session ID',
    '帳號',
    'Token雜湊',
    '建立時間',
    '到期時間',
    '最後使用時間',
    '狀態'
  ],
  Events: [
    '活動編號',
    '活動名稱',
    '活動日期',
    '開始時間',
    '結束時間',
    '活動地點',
    '活動狀態',
    '是否開放報名',
    '是否開放簽到',
    '備註',
    '建立者',
    '更新者',
    '建立時間',
    '更新時間'
  ],
  EventRegistrations: [
    '報名編號',
    '活動編號',
    '會員編號',
    '姓名',
    '報名狀態',
    '報名時間',
    '取消時間',
    '同行人數',
    '備註',
    '來源'
  ],
  Attendance: [
    '簽到編號',
    '活動編號',
    '會員編號',
    '姓名',
    '簽到狀態',
    '簽到時間',
    '簽到方式',
    '操作人',
    '備註'
  ],
  BindingLogs: [
    '紀錄編號',
    'LINE User ID',
    '輸入手機',
    '會員編號',
    '結果',
    '原因',
    '時間',
    '操作人'
  ],
  AuditLogs: [
    '紀錄編號',
    '操作時間',
    '操作人',
    '操作類型',
    '資料類型',
    '資料編號',
    '操作內容'
  ],
  Settings: [
    '設定鍵',
    '設定值',
    '說明',
    '更新時間'
  ]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('千禧獅子會系統')
    .addItem('建立正式資料庫', 'setupY2kDatabase')
    .addSeparator()
    .addItem('建立會員匯入表', 'createMembersImportSheet')
    .addItem('匯入會員資料', 'importY2kMembersFromSheet')
    .addToUi();
}

function setupY2kDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupY2kSheets_(ss);
  createSetupGuideSheet_(ss);
  seedProductionSettings_();
  ensureY2kSystemAdminMember();
  SpreadsheetApp.flush();
}

function ensureY2kSystemAdminMember() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) throw new Error('請先執行 setupY2kDatabase');

  const now = nowIso_();
  const member = {
    '會員編號': 'M000',
    '姓名': '王立文',
    '手機': '0932368727',
    '會員狀態': '系統管理員',
    '生日': '',
    '更新時間': now
  };
  const existing = findRowByValue_('Members', '會員編號', member['會員編號']);
  if (existing) {
    updateByKey_('Members', '會員編號', member['會員編號'], member);
    audit_('setup', '更新系統管理員會員', '會員', member['會員編號'], member['姓名']);
    SpreadsheetApp.flush();
    return;
  }

  appendRow_('Members', [
    member['會員編號'],
    member['姓名'],
    member['手機'],
    member['會員狀態'],
    member['生日'],
    '',
    '',
    '',
    '',
    now,
    now
  ]);
  audit_('setup', '建立系統管理員會員', '會員', member['會員編號'], member['姓名']);
  SpreadsheetApp.flush();
}

function createY2kAdminUser(username, password, name, role) {
  username = required_(username, '缺少帳號');
  password = required_(password, '缺少密碼');
  name = required_(name, '缺少姓名');
  role = role || '一般管理員';

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AdminUsers');
  if (!sheet) throw new Error('請先執行 setupY2kDatabase');
  if (findRowByValue_('AdminUsers', '帳號', username)) throw new Error('帳號已存在：' + username);

  const now = nowIso_();
  const salt = makeId_('SALT');
  sheet.appendRow([username, hashPassword_(password, salt), salt, name, role, '啟用', 0, '', '', now, now]);
  audit_('setup', '建立後台帳號', '後台帳號', username, role);
}

function createY2kFirstAdmin() {
  throw new Error('正式版請改用 createY2kAdminUser(username, password, name, role) 建立管理員');
}

function importY2kMembersFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const importSheet = ss.getSheetByName('MembersImport');
  if (!importSheet) throw new Error('請先建立 MembersImport 工作表');

  const values = importSheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('MembersImport 沒有可匯入資料');

  const headers = values[0];
  const requiredHeaders = ['會員編號', '姓名', '手機', '會員狀態', '生日'];
  requiredHeaders.forEach((header) => {
    if (headers.indexOf(header) === -1) throw new Error('MembersImport 缺少欄位：' + header);
  });

  const now = nowIso_();
  values.slice(1).forEach((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    if (!item['會員編號'] || !item['姓名'] || !item['手機']) return;
    upsertY2kMember_(item, now);
  });
  SpreadsheetApp.flush();
}

function createMembersImportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, 'MembersImport');
  setupHeader_(sheet, ['會員編號', '姓名', '手機', '會員狀態', '生日']);
}

function createSetupGuideSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, 'SetupGuide');
  sheet.clear();
  const rows = [
    ['千禧獅子會系統建置步驟', ''],
    ['1', '執行「千禧獅子會系統 > 建立正式資料庫」。'],
    ['2', '系統會預設建立 M000 王立文，會員狀態為「系統管理員」，不計入會員總數。'],
    ['3', '在 Apps Script 手動執行 createY2kAdminUser(username, password, name, role) 建立第一個後台登入帳號。'],
    ['4', '執行「建立會員匯入表」，到 MembersImport 填入會員編號、姓名、手機、會員狀態、生日。'],
    ['5', '執行「匯入會員資料」，系統會新增或更新 Members。'],
    ['6', '部署 Apps Script Web App，取得 URL 後填入前端 config.js。'],
    ['安全提醒', 'GitHub Pages 只能放前端，不能放會員資料、密碼、Token 或 Google Sheet ID。']
  ];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#E8F0EF').setFontColor('#123B3A');
  sheet.getRange(1, 1, rows.length, 2).setWrap(true);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 620);
}

function setupY2kSheets_(ss) {
  Object.keys(Y2K_SHEET_SCHEMA).forEach((sheetName) => {
    const sheet = getOrCreateSheet_(ss, sheetName);
    setupHeader_(sheet, Y2K_SHEET_SCHEMA[sheetName]);
  });
}

function getOrCreateSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function setupHeader_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#E8F0EF')
    .setFontColor('#123B3A');
  sheet.autoResizeColumns(1, headers.length);
}

function appendIfEmpty_(sheetName, rows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (sheet.getLastRow() > 1) return;
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function seedProductionSettings_() {
  appendIfEmpty_('Settings', [
    ['SYSTEM_NAME', '千禧獅子會', '前台系統名稱', nowIso_()],
    ['ADMIN_NAME', '千禧管理後台', '後台系統名稱', nowIso_()],
    ['DIVISION', '第三專區第五分區', '所屬分區', nowIso_()],
    ['SESSION_HOURS', '8', '後台登入有效小時數', nowIso_()],
    ['MAX_LOGIN_FAILURES', '5', '後台登入失敗鎖定門檻', nowIso_()],
    ['LOCK_MINUTES', '15', '後台登入鎖定分鐘數', nowIso_()],
    ['ENVIRONMENT', 'production', '資料庫用途', nowIso_()]
  ]);
}

function upsertY2kMember_(item, now) {
  const memberId = String(item['會員編號']).trim();
  const existing = findRowByValue_('Members', '會員編號', memberId);
  const payload = {
    '姓名': String(item['姓名']).trim(),
    '手機': String(item['手機']).trim(),
    '會員狀態': String(item['會員狀態'] || '有效').trim(),
    '生日': item['生日'] || '',
    '更新時間': now
  };
  if (existing) {
    updateByKey_('Members', '會員編號', memberId, payload);
    audit_('import', '匯入更新會員', '會員', memberId, payload['姓名']);
    return;
  }
  appendRow_('Members', [
    memberId,
    payload['姓名'],
    payload['手機'],
    payload['會員狀態'],
    payload['生日'],
    '',
    '',
    '',
    '',
    now,
    now
  ]);
  audit_('import', '匯入新增會員', '會員', memberId, payload['姓名']);
}
