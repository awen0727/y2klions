const API_VERSION = 'y2k-2026-07-01-v7';

function doGet() {
  return json_({
    ok: true,
    version: API_VERSION,
    service: '千禧獅子會活動系統 API'
  });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = payload.action;
    const result = route_(action, payload);
    return json_({ ok: true, version: API_VERSION, data: result || null });
  } catch (error) {
    return json_({
      ok: false,
      version: API_VERSION,
      error: error.message || String(error)
    });
  }
}

function route_(action, payload) {
  switch (action) {
    case 'health':
      return { version: API_VERSION, now: nowIso_() };

    case 'memberIdentity':
      return memberIdentity_(payload.lineUserId);
    case 'bindMember':
      return bindMember_(payload);
    case 'memberHome':
      return memberHome_(payload.lineUserId);
    case 'registerEvent':
      return registerEvent_(payload);
    case 'cancelRegistration':
      return cancelRegistration_(payload);
    case 'checkIn':
      return checkIn_(payload);
    case 'displayDashboard':
      return displayDashboard_(payload);

    case 'adminLogin':
      return adminLogin_(payload.username, payload.password);
    case 'adminLogout':
      return adminLogout_(payload.sessionToken);
    case 'adminDashboard':
      return adminDashboard_(requireAdmin_(payload.sessionToken));
    case 'changeAdminPassword':
      return changeAdminPassword_(requireAdmin_(payload.sessionToken), payload.oldPassword, payload.newPassword);
    case 'saveMember':
      return saveMember_(requireAdmin_(payload.sessionToken), payload.member);
    case 'unbindMember':
      return unbindMember_(requireAdminRole_(payload.sessionToken, '系統管理員'), payload.memberId);
    case 'saveEvent':
      return saveEvent_(requireAdmin_(payload.sessionToken), payload.event);
    case 'deleteEvent':
      return deleteEvent_(requireAdmin_(payload.sessionToken), payload.eventId, payload.force);
    case 'manualCheckIn':
      return manualCheckIn_(requireAdmin_(payload.sessionToken), payload);
    case 'cancelCheckIn':
      return cancelCheckIn_(requireAdmin_(payload.sessionToken), payload.attendanceId);

    default:
      throw new Error('未知操作：' + action);
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (_error) {
    throw new Error('請求格式不是 JSON');
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function memberIdentity_(lineUserId) {
  if (!lineUserId) return { bound: false };
  const member = findRowByValue_('Members', 'LINE User ID', lineUserId);
  if (!member) return { bound: false };
  setCellByKey_('Members', '會員編號', member['會員編號'], '最後登入時間', nowIso_());
  return {
    bound: true,
    member: publicMember_(member)
  };
}

function bindMember_(payload) {
  const lineUserId = required_(payload.lineUserId, '缺少 LINE User ID');
  const phoneLast4 = String(required_(payload.phoneLast4 || payload.phone, '缺少手機末四碼')).replace(/\D/g, '');
  const lineDisplayName = payload.lineDisplayName || '';
  if (phoneLast4.length !== 4) throw new Error('請輸入行動電話末四碼');

  const existingLine = findRowByValue_('Members', 'LINE User ID', lineUserId);
  if (existingLine) throw new Error('此 LINE 帳號已綁定其他會員');

  const members = rows_('Members').filter((row) => String(row['手機'] || '').replace(/\D/g, '').slice(-4) === phoneLast4);
  if (members.length === 0) {
    appendRow_('BindingLogs', [makeId_('B'), lineUserId, '末四碼:' + phoneLast4, '', '失敗', '查無手機末四碼', nowIso_(), 'member']);
    throw new Error('查無會員資料，請聯絡管理員');
  }
  if (members.length > 1) throw new Error('此手機末四碼對應多位會員，請聯絡管理員協助綁定');

  const member = members[0];
  if (!isUsableMemberStatus_(member['會員狀態'])) throw new Error('此會員狀態不可使用，請聯絡管理員');
  if (member['LINE User ID']) throw new Error('此會員已綁定其他 LINE 帳號');

  const now = nowIso_();
  updateByKey_('Members', '會員編號', member['會員編號'], {
    'LINE User ID': lineUserId,
    'LINE顯示名稱': lineDisplayName,
    '綁定時間': now,
    '最後登入時間': now,
    '更新時間': now
  });
  appendRow_('BindingLogs', [makeId_('B'), lineUserId, '末四碼:' + phoneLast4, member['會員編號'], '成功', '手機末四碼認證', now, 'member']);
  audit_('member:' + member['姓名'], 'LINE 綁定', '會員', member['會員編號'], '手機末四碼認證後綁定');
  return { member: publicMember_(findRowByValue_('Members', '會員編號', member['會員編號'])) };
}

function memberHome_(lineUserId) {
  const identity = memberIdentity_(lineUserId);
  if (!identity.bound) return identity;
  const memberId = identity.member.memberId;
  const registrations = rows_('EventRegistrations').filter((row) => row['會員編號'] === memberId);
  const attendance = rows_('Attendance').filter((row) => row['會員編號'] === memberId);
  const relatedEventIds = {};
  registrations.forEach((row) => { relatedEventIds[row['活動編號']] = true; });
  attendance.forEach((row) => { relatedEventIds[row['活動編號']] = true; });
  return {
    bound: true,
    member: identity.member,
    events: rows_('Events')
      .filter((event) => event['活動狀態'] === '開放' || relatedEventIds[event['活動編號']])
      .map(publicEvent_),
    registrations: registrations.map(publicRegistration_),
    attendance: attendance.map(publicAttendance_)
  };
}

function registerEvent_(payload) {
  const member = requireMember_(payload.lineUserId);
  const event = requireOpenEvent_(payload.eventId, 'registration');
  const existing = rows_('EventRegistrations').find((row) => row['活動編號'] === event['活動編號'] && row['會員編號'] === member['會員編號']);
  const now = nowIso_();
  if (existing) {
    updateByKey_('EventRegistrations', '報名編號', existing['報名編號'], {
      '報名狀態': '已報名',
      '報名時間': existing['報名時間'] || now,
      '取消時間': '',
      '同行人數': Number(payload.companions || 0),
      '備註': payload.notes || '',
      '來源': 'LINE'
    });
    audit_(member['姓名'], '重新報名', '活動報名', existing['報名編號'], event['活動名稱']);
    return { registrationId: existing['報名編號'] };
  }
  const id = makeId_('R');
  appendRow_('EventRegistrations', [
    id,
    event['活動編號'],
    member['會員編號'],
    member['姓名'],
    '已報名',
    now,
    '',
    Number(payload.companions || 0),
    payload.notes || '',
    'LINE'
  ]);
  audit_(member['姓名'], '報名', '活動報名', id, event['活動名稱']);
  return { registrationId: id };
}

function cancelRegistration_(payload) {
  const member = requireMember_(payload.lineUserId);
  const event = requireOpenEvent_(payload.eventId, 'registration');
  const registration = rows_('EventRegistrations').find((row) => row['活動編號'] === event['活動編號'] && row['會員編號'] === member['會員編號'] && row['報名狀態'] === '已報名');
  if (!registration) throw new Error('目前沒有有效報名可取消');
  updateByKey_('EventRegistrations', '報名編號', registration['報名編號'], {
    '報名狀態': '已取消',
    '取消時間': nowIso_()
  });
  audit_(member['姓名'], '取消報名', '活動報名', registration['報名編號'], payload.eventId);
  return { registrationId: registration['報名編號'] };
}

function checkIn_(payload) {
  const member = requireMember_(payload.lineUserId);
  return createCheckIn_(member, payload.eventId, 'LINE', member['姓名'], payload.notes || '');
}

function adminLogin_(username, password) {
  username = required_(username, '缺少帳號');
  password = required_(password, '缺少密碼');
  const admin = findRowByValue_('AdminUsers', '帳號', username);
  if (!admin || admin['狀態'] !== '啟用') {
    audit_(username, '登入失敗', '後台帳號', username, '帳號不存在或停用');
    throw new Error('帳號或密碼錯誤');
  }
  if (admin['鎖定到期時間'] && new Date(admin['鎖定到期時間']).getTime() > Date.now()) {
    audit_(username, '登入失敗', '後台帳號', username, '帳號暫時鎖定');
    throw new Error('登入失敗次數過多，帳號暫時鎖定');
  }
  const hashed = hashPassword_(password, admin['密碼鹽值']);
  if (hashed !== admin['密碼雜湊']) {
    const failures = Number(admin['登入失敗次數'] || 0) + 1;
    const maxFailures = Number(setting_('MAX_LOGIN_FAILURES', '5'));
    const lockMinutes = Number(setting_('LOCK_MINUTES', '15'));
    const lockedUntil = failures >= maxFailures ? new Date(Date.now() + lockMinutes * 60 * 1000).toISOString() : '';
    updateByKey_('AdminUsers', '帳號', username, {
      '登入失敗次數': failures,
      '鎖定到期時間': lockedUntil,
      '更新時間': nowIso_()
    });
    audit_(username, '登入失敗', '後台帳號', username, lockedUntil ? '密碼錯誤並鎖定' : '密碼錯誤');
    throw new Error('帳號或密碼錯誤');
  }

  const token = makeToken_();
  const sessionId = makeId_('S');
  const now = nowIso_();
  const expires = new Date(Date.now() + Number(setting_('SESSION_HOURS', '8')) * 60 * 60 * 1000).toISOString();
  appendRow_('AdminSessions', [sessionId, username, hashText_(token), now, expires, now, '有效']);
  updateByKey_('AdminUsers', '帳號', username, {
    '登入失敗次數': 0,
    '鎖定到期時間': '',
    '最後登入時間': now,
    '更新時間': now
  });
  audit_(admin['姓名'], '登入成功', '後台帳號', username, '');
  return {
    sessionToken: token,
    admin: {
      username: username,
      name: admin['姓名'],
      role: admin['角色']
    }
  };
}

function adminLogout_(token) {
  const session = requireAdmin_(token);
  updateByKey_('AdminSessions', 'Session ID', session.sessionId, { '狀態': '登出', '最後使用時間': nowIso_() });
  audit_(session.name, '登出', '後台帳號', session.username, '');
  return { loggedOut: true };
}

function adminDashboard_(session) {
  touchSession_(session.sessionId);
  return {
    admin: { username: session.username, name: session.name, role: session.role },
    members: rows_('Members').map(adminMember_),
    events: rows_('Events').map(publicEvent_),
    registrations: rows_('EventRegistrations').map(publicRegistration_),
    attendance: rows_('Attendance').map(publicAttendance_),
    bindingLogs: rows_('BindingLogs'),
    auditLogs: rows_('AuditLogs').slice(-100).reverse()
  };
}

function displayDashboard_(payload) {
  const token = required_(payload.token, '缺少看板 token');
  if (token !== setting_('DISPLAY_TOKEN', 'y2k-display-2026')) throw new Error('看板 token 不正確');

  const events = rows_('Events')
    .map(publicEvent_)
    .sort((a, b) => publicEventSortValue_(b) - publicEventSortValue_(a));
  const event = payload.eventId
    ? events.find((item) => String(item.eventId) === String(payload.eventId))
    : events.find((item) => item.status === '開放' && isDuringPublicCheckInWindow_(item)) ||
      events.find((item) => item.status === '開放') ||
      events[0];
  if (!event) return { event: null, members: [], registrations: [], attendance: [], stats: {} };

  const members = rows_('Members').map(adminMember_);
  const registrations = rows_('EventRegistrations')
    .filter((row) => row['活動編號'] === event.eventId)
    .map(publicRegistration_);
  const attendance = rows_('Attendance')
    .filter((row) => row['活動編號'] === event.eventId)
    .map(publicAttendance_);
  const activeRegistrations = registrations.filter((item) => item.status === '已報名');
  const activeAttendance = attendance.filter((item) => item.status === '已簽到');
  const companionCount = activeRegistrations.reduce((sum, item) => sum + Number(item.companions || 0), 0);
  const memberById = {};
  members.forEach((member) => { memberById[member.memberId] = member; });

  return {
    event: event,
    stats: {
      registered: activeRegistrations.length,
      companions: companionCount,
      expected: activeRegistrations.length + companionCount,
      checkedIn: activeAttendance.length
    },
    registrations: activeRegistrations.map((item) => Object.assign({}, item, { member: memberById[item.memberId] || null })),
    attendance: activeAttendance.map((item) => Object.assign({}, item, { member: memberById[item.memberId] || null }))
  };
}

function changeAdminPassword_(session, oldPassword, newPassword) {
  touchSession_(session.sessionId);
  oldPassword = required_(oldPassword, '缺少目前密碼');
  newPassword = required_(newPassword, '缺少新密碼');
  if (String(newPassword).length < 8) throw new Error('新密碼至少 8 碼');

  const admin = findRowByValue_('AdminUsers', '帳號', session.username);
  if (!admin || admin['狀態'] !== '啟用') throw new Error('找不到後台帳號');
  if (hashPassword_(oldPassword, admin['密碼鹽值']) !== admin['密碼雜湊']) throw new Error('目前密碼錯誤');

  const now = nowIso_();
  const salt = makeId_('SALT');
  updateByKey_('AdminUsers', '帳號', session.username, {
    '密碼雜湊': hashPassword_(newPassword, salt),
    '密碼鹽值': salt,
    '更新時間': now
  });
  audit_(session.name, '變更密碼', '後台帳號', session.username, '');
  return { changed: true };
}

function saveMember_(session, member) {
  touchSession_(session.sessionId);
  ensureSheetColumns_('Members', ['年度職位']);
  const memberId = required_(member.memberId, '缺少會員編號');
  const now = nowIso_();
  const existing = findRowByValue_('Members', '會員編號', memberId);
  if (existing) {
    updateByKey_('Members', '會員編號', memberId, {
      '姓名': required_(member.name, '缺少姓名'),
      '手機': required_(member.phone, '缺少手機'),
      '會員狀態': member.status || '有效',
      '生日': member.birthday || '',
      '年度職位': member.annualRole || '',
      '更新時間': now
    });
    audit_(session.name, '修改會員', '會員', memberId, member.name);
  } else {
    appendRow_('Members', [
      memberId,
      required_(member.name, '缺少姓名'),
      required_(member.phone, '缺少手機'),
      member.status || '有效',
      member.birthday || '',
      '',
      '',
      '',
      '',
      now,
      now,
      member.annualRole || ''
    ]);
    audit_(session.name, '新增會員', '會員', memberId, member.name);
  }
  return { memberId: memberId };
}

function unbindMember_(session, memberId) {
  const member = findRowByValue_('Members', '會員編號', required_(memberId, '缺少會員編號'));
  if (!member) throw new Error('找不到會員');
  const oldLineId = member['LINE User ID'];
  updateByKey_('Members', '會員編號', memberId, {
    'LINE User ID': '',
    'LINE顯示名稱': '',
    '綁定時間': '',
    '更新時間': nowIso_()
  });
  appendRow_('BindingLogs', [makeId_('B'), oldLineId, '', memberId, '解除', '後台解除綁定', nowIso_(), session.name]);
  audit_(session.name, '解除 LINE 綁定', '會員', memberId, member['姓名']);
  return { memberId: memberId };
}

function saveEvent_(session, event) {
  touchSession_(session.sessionId);
  const now = nowIso_();
  const eventId = event.eventId || makeId_('E');
  const values = {
    '活動名稱': required_(event.name, '缺少活動名稱'),
    '活動日期': required_(event.date, '缺少活動日期'),
    '開始時間': event.startTime || '',
    '結束時間': event.endTime || '',
    '活動地點': event.location || '',
    '活動狀態': event.status || '開放',
    '是否開放報名': event.registrationOpen ? '是' : '否',
    '是否開放簽到': event.checkinOpen ? '是' : '否',
    '備註': event.notes || '',
    '更新者': session.name,
    '更新時間': now
  };
  const existing = findRowByValue_('Events', '活動編號', eventId);
  if (existing) {
    updateByKey_('Events', '活動編號', eventId, values);
    audit_(session.name, '修改活動', '活動', eventId, event.name);
  } else {
    appendRow_('Events', [
      eventId,
      values['活動名稱'],
      values['活動日期'],
      values['開始時間'],
      values['結束時間'],
      values['活動地點'],
      values['活動狀態'],
      values['是否開放報名'],
      values['是否開放簽到'],
      values['備註'],
      session.name,
      session.name,
      now,
      now
    ]);
    audit_(session.name, '新增活動', '活動', eventId, event.name);
  }
  return { eventId: eventId };
}

function deleteEvent_(session, eventId, force) {
  touchSession_(session.sessionId);
  eventId = required_(eventId, '缺少活動編號');
  const event = findRowByValue_('Events', '活動編號', eventId);
  if (!event) throw new Error('找不到活動');

  const registrationCount = rows_('EventRegistrations').filter((row) => row['活動編號'] === eventId).length;
  const attendanceCount = rows_('Attendance').filter((row) => row['活動編號'] === eventId).length;
  if ((registrationCount || attendanceCount) && !force) {
    throw new Error('此活動已有報名或簽到紀錄，請再次確認後刪除');
  }

  const deletedRegistrations = deleteRowsByValue_('EventRegistrations', '活動編號', eventId);
  const deletedAttendance = deleteRowsByValue_('Attendance', '活動編號', eventId);
  const deletedEvents = deleteRowsByValue_('Events', '活動編號', eventId);
  audit_(session.name, '刪除活動', '活動', eventId, event['活動名稱'] + ' / 報名 ' + deletedRegistrations + ' / 簽到 ' + deletedAttendance);
  return {
    eventId: eventId,
    deletedEvents: deletedEvents,
    deletedRegistrations: deletedRegistrations,
    deletedAttendance: deletedAttendance
  };
}

function manualCheckIn_(session, payload) {
  const member = findRowByValue_('Members', '會員編號', required_(payload.memberId, '缺少會員編號'));
  if (!member) throw new Error('找不到會員');
  return createCheckIn_(member, payload.eventId, '後台補登', session.name, payload.notes || '');
}

function cancelCheckIn_(session, attendanceId) {
  const record = findRowByValue_('Attendance', '簽到編號', required_(attendanceId, '缺少簽到編號'));
  if (!record) throw new Error('找不到簽到紀錄');
  updateByKey_('Attendance', '簽到編號', attendanceId, { '簽到狀態': '取消簽到' });
  audit_(session.name, '取消簽到', '活動簽到', attendanceId, record['姓名']);
  return { attendanceId: attendanceId };
}

function createCheckIn_(member, eventId, method, actor, notes) {
  if (!isUsableMemberStatus_(member['會員狀態'])) throw new Error('會員狀態不可簽到');
  const event = requireOpenEvent_(eventId, method === 'LINE' ? 'checkin' : 'manualCheckin');
  const existing = rows_('Attendance').find((row) => row['活動編號'] === event['活動編號'] && row['會員編號'] === member['會員編號']);
  const now = nowIso_();
  if (existing) {
    if (existing['簽到狀態'] === '已簽到') throw new Error('此活動已完成簽到');
    updateByKey_('Attendance', '簽到編號', existing['簽到編號'], {
      '簽到狀態': '已簽到',
      '簽到時間': now,
      '簽到方式': method,
      '操作人': actor || '',
      '備註': notes || ''
    });
    audit_(actor || member['姓名'], '重新簽到', '活動簽到', existing['簽到編號'], event['活動名稱']);
    return { attendanceId: existing['簽到編號'] };
  }
  const id = makeId_('C');
  appendRow_('Attendance', [
    id,
    event['活動編號'],
    member['會員編號'],
    member['姓名'],
    '已簽到',
    now,
    method,
    actor || '',
    notes || ''
  ]);
  audit_(actor || member['姓名'], '簽到', '活動簽到', id, event['活動名稱'] + ' / ' + method);
  return { attendanceId: id };
}

function requireMember_(lineUserId) {
  const member = findRowByValue_('Members', 'LINE User ID', required_(lineUserId, '缺少 LINE User ID'));
  if (!member) throw new Error('尚未綁定會員');
  if (!isUsableMemberStatus_(member['會員狀態'])) throw new Error('會員狀態不可使用');
  return member;
}

function isUsableMemberStatus_(status) {
  return ['有效', '系統管理員'].indexOf(String(status || '')) !== -1;
}

function requireOpenEvent_(eventId, mode) {
  const event = findRowByValue_('Events', '活動編號', required_(eventId, '缺少活動編號'));
  if (!event) throw new Error('此活動未開放');
  if (mode === 'manualCheckin') return event;
  if (effectiveEventStatus_(event) !== '開放') throw new Error('此活動未開放');
  if (mode === 'registration') {
    if (event['是否開放報名'] !== '是') throw new Error('此活動未開放報名');
    if (!isBeforeEventStart_(event)) throw new Error('活動開始後不可報名');
  }
  if (mode === 'checkin') {
    if (event['是否開放簽到'] !== '是') throw new Error('此活動未開放簽到');
    if (!isDuringCheckInWindow_(event)) throw new Error('簽到尚未開放或已結束');
  }
  return event;
}

function isBeforeEventStart_(event) {
  const start = eventDateTime_(event, 'start');
  if (!start) throw new Error('活動日期格式不正確');
  return new Date().getTime() < start.getTime();
}

function isDuringCheckInWindow_(event) {
  const start = eventDateTime_(event, 'start');
  const end = eventDateTime_(event, 'end');
  if (!start || !end) throw new Error('活動日期格式不正確');
  const checkInStart = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  const now = new Date().getTime();
  return now >= checkInStart.getTime() && now <= end.getTime();
}

function isEventEnded_(event) {
  const end = eventDateTime_(event, 'end');
  if (!end) return false;
  return new Date().getTime() > end.getTime();
}

function effectiveEventStatus_(event) {
  if (String(event['活動狀態'] || '') !== '開放') return event['活動狀態'] || '關閉';
  return isEventEnded_(event) ? '關閉' : '開放';
}

function eventDateTime_(event, boundary) {
  const dateParts = eventDateParts_(event['活動日期']);
  if (!dateParts) return null;
  const fallback = boundary === 'end' ? [23, 59] : [0, 0];
  const timeParts = eventTimeParts_(boundary === 'end' ? event['結束時間'] : event['開始時間'], fallback);
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], boundary === 'end' ? 59 : 0, 0);
}

function eventDateParts_(value) {
  const normalized = publicDateValue_(value);
  const normalizedMatch = String(normalized || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (normalizedMatch) return [Number(normalizedMatch[1]), Number(normalizedMatch[2]), Number(normalizedMatch[3])];
  if (value instanceof Date) {
    return [value.getFullYear(), value.getMonth() + 1, value.getDate()];
  }
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()];
}

function eventTimeParts_(value, fallback) {
  const normalized = publicTimeValue_(value);
  const normalizedMatch = String(normalized || '').match(/^(\d{1,2}):(\d{2})$/);
  if (normalizedMatch) return [Number(normalizedMatch[1]), Number(normalizedMatch[2])];
  if (value instanceof Date) {
    return [value.getHours(), value.getMinutes()];
  }
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (match) return [Number(match[1]), Number(match[2])];
  return fallback;
}

function requireAdmin_(token) {
  const tokenHash = hashText_(required_(token, '缺少後台登入 token'));
  const sessionRow = findRowByValue_('AdminSessions', 'Token雜湊', tokenHash);
  if (!sessionRow || sessionRow['狀態'] !== '有效') throw new Error('後台登入已失效');
  if (new Date(sessionRow['到期時間']).getTime() < Date.now()) {
    updateByKey_('AdminSessions', 'Session ID', sessionRow['Session ID'], { '狀態': '過期' });
    throw new Error('後台登入已過期');
  }
  const admin = findRowByValue_('AdminUsers', '帳號', sessionRow['帳號']);
  if (!admin || admin['狀態'] !== '啟用') throw new Error('後台帳號已停用');
  return {
    sessionId: sessionRow['Session ID'],
    username: admin['帳號'],
    name: admin['姓名'],
    role: admin['角色']
  };
}

function requireAdminRole_(token, role) {
  const session = requireAdmin_(token);
  if (session.role !== role) throw new Error('權限不足');
  return session;
}

function touchSession_(sessionId) {
  updateByKey_('AdminSessions', 'Session ID', sessionId, { '最後使用時間': nowIso_() });
}

function rows_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('找不到工作表：' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = normalizeCell_(row[index]);
    });
    return item;
  });
}

function appendRow_(sheetName, values) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).appendRow(values);
}

function findRowByValue_(sheetName, key, value) {
  return rows_(sheetName).find((row) => String(row[key]) === String(value)) || null;
}

function updateByKey_(sheetName, key, keyValue, updates) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1) throw new Error('找不到欄位：' + key);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][keyIndex]) === String(keyValue)) {
      Object.keys(updates).forEach((field) => {
        const colIndex = headers.indexOf(field);
        if (colIndex === -1) throw new Error('找不到欄位：' + field);
        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(updates[field]);
      });
      return;
    }
  }
  throw new Error('找不到資料：' + keyValue);
}

function deleteRowsByValue_(sheetName, key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('找不到工作表：' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  const headers = values[0];
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1) throw new Error('找不到欄位：' + key);
  let deleted = 0;
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    if (String(values[rowIndex][keyIndex]) === String(value)) {
      sheet.deleteRow(rowIndex + 1);
      deleted += 1;
    }
  }
  return deleted;
}

function ensureSheetColumns_(sheetName, columns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('找不到工作表：' + sheetName);
  const width = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  let nextColumn = headers.length + 1;
  columns.forEach((column) => {
    if (headers.indexOf(column) !== -1) return;
    sheet.getRange(1, nextColumn).setValue(column);
    headers.push(column);
    nextColumn += 1;
  });
}

function setCellByKey_(sheetName, key, keyValue, field, value) {
  updateByKey_(sheetName, key, keyValue, Object.fromEntries([[field, value]]));
}

function normalizeCell_(value) {
  return value;
}

function publicMember_(row) {
  const memberId = String(row['會員編號'] || '');
  const status = String(row['會員狀態'] || '');
  const countInMemberStats = memberId !== 'M000' && status !== '系統管理員';
  return {
    memberId: memberId,
    name: row['姓名'],
    phoneMasked: maskPhone_(row['手機']),
    status: status,
    annualRole: row['年度職位'] || (status === '系統管理員' ? '系統管理員' : ''),
    birthday: row['生日'],
    lineBound: Boolean(row['LINE User ID']),
    boundAt: row['綁定時間'] || '',
    lastLoginAt: row['最後登入時間'] || '',
    countInMemberStats: countInMemberStats,
    isSystemAdminMember: !countInMemberStats
  };
}

function adminMember_(row) {
  const member = publicMember_(row);
  member.phone = row['手機'];
  member.lineUserId = row['LINE User ID'];
  member.lineDisplayName = row['LINE顯示名稱'];
  return member;
}

function publicEvent_(row) {
  return {
    eventId: row['活動編號'],
    name: row['活動名稱'],
    date: publicDateValue_(row['活動日期']),
    startTime: publicTimeValue_(row['開始時間']),
    endTime: publicTimeValue_(row['結束時間']),
    location: row['活動地點'],
    status: effectiveEventStatus_(row),
    registrationOpen: row['是否開放報名'] === '是',
    checkinOpen: row['是否開放簽到'] === '是',
    notes: row['備註']
  };
}

function publicEventSortValue_(event) {
  const dateParts = eventDateParts_(event.date);
  if (!dateParts) return 0;
  const timeParts = eventTimeParts_(event.startTime, [0, 0]);
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], 0, 0).getTime();
}

function isDuringPublicCheckInWindow_(event) {
  const dateParts = eventDateParts_(event.date);
  if (!dateParts) return false;
  const startParts = eventTimeParts_(event.startTime, [0, 0]);
  const endParts = eventTimeParts_(event.endTime, [23, 59]);
  const start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], startParts[0], startParts[1], 0, 0);
  const end = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], endParts[0], endParts[1], 59, 0);
  const checkInStart = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  const now = new Date().getTime();
  return now >= checkInStart.getTime() && now <= end.getTime();
}

function publicDateValue_(value) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const text = String(value);
  const parsed = new Date(value);
  if (text.indexOf('T') !== -1 && !Number.isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return text;
  return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2);
}

function publicTimeValue_(value) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  const text = String(value);
  const match = text.match(/T?(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return ('0' + match[1]).slice(-2) + ':' + match[2];
}

function publicRegistration_(row) {
  return {
    registrationId: row['報名編號'],
    eventId: row['活動編號'],
    memberId: row['會員編號'],
    name: row['姓名'],
    status: row['報名狀態'],
    registeredAt: row['報名時間'],
    canceledAt: row['取消時間'],
    companions: Number(row['同行人數'] || 0),
    notes: row['備註'],
    source: row['來源']
  };
}

function publicAttendance_(row) {
  return {
    attendanceId: row['簽到編號'],
    eventId: row['活動編號'],
    memberId: row['會員編號'],
    name: row['姓名'],
    status: row['簽到狀態'],
    checkedInAt: row['簽到時間'],
    method: row['簽到方式'],
    actor: row['操作人'],
    notes: row['備註']
  };
}

function audit_(actor, action, targetType, targetId, detail) {
  appendRow_('AuditLogs', [makeId_('A'), nowIso_(), actor || 'system', action, targetType, targetId, detail || '']);
}

function setting_(key, fallback) {
  const row = findRowByValue_('Settings', '設定鍵', key);
  return row ? row['設定值'] : fallback;
}

function required_(value, message) {
  if (value === undefined || value === null || value === '') throw new Error(message);
  return value;
}

function nowIso_() {
  return new Date().toISOString();
}

function makeId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function makeToken_() {
  return Utilities.getUuid() + Utilities.getUuid();
}

function hashPassword_(password, salt) {
  return hashText_(salt + ':' + password);
}

function hashText_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map((byte) => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function maskPhone_(phone) {
  const text = String(phone || '');
  if (text.length < 7) return text;
  return text.slice(0, 4) + '***' + text.slice(-3);
}
