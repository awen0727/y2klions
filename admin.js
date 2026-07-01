(function () {
  "use strict";

  const Api = window.Y2kApi;
  const Utils = window.Y2kUtils;
  const $ = (id) => document.getElementById(id);

  let session = null;
  let dashboardState = null;

  function emptyDashboard() {
    return {
      members: [],
      events: [],
      registrations: [],
      attendance: [],
      bindingLogs: [],
      auditLogs: []
    };
  }

  function db() {
    return dashboardState || emptyDashboard();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showLoginMessage(text, type) {
    const box = $("loginMessage");
    box.textContent = text || "";
    box.className = `message ${type || ""}`.trim();
    box.classList.toggle("hidden", !text);
  }

  function requireSession() {
    session = Api.getAdminSession();
    $("loginPanel").classList.toggle("hidden", Boolean(session));
    $("adminApp").classList.toggle("hidden", !session);
    if (session) {
      $("adminName").textContent = session.name;
      $("adminRole").textContent = `${session.role}｜${Utils.displayDateTime(session.loginAt)} 登入`;
      renderConnectionStatus();
    }
    return session;
  }

  function renderConnectionStatus(detail, type) {
    const modeText = "Apps Script API 模式";
    const defaultText = "尚未檢查後端連線";
    const status = detail || defaultText;
    const className = `connection-status ${type || ""}`.trim();
    $("apiStatus").className = className;
    $("apiStatus").innerHTML = `<strong>${modeText}</strong>｜${escapeHtml(status)}`;
  }

  async function refreshDashboard() {
    if (!requireSession()) {
      dashboardState = null;
      return false;
    }
    dashboardState = await Api.adminDashboard();
    return true;
  }

  function registrationStats(data, eventId) {
    const registrations = data.registrations.filter((item) => item.eventId === eventId);
    const active = registrations.filter((item) => item.status === "已報名");
    const companions = active.reduce((sum, item) => sum + Number(item.companions || 0), 0);
    return {
      active: active.length,
      canceled: registrations.filter((item) => item.status === "已取消").length,
      companions,
      total: active.length + companions
    };
  }

  function attendanceStats(data, eventId) {
    return data.attendance.filter((item) => item.eventId === eventId && item.status === "已簽到").length;
  }

  function isCountedMember(member) {
    if (member.countInMemberStats === false || member.isSystemAdminMember) return false;
    return member.memberId !== "M000" && member.status !== "系統管理員";
  }

  function memberStatusBadgeClass(status) {
    if (status === "有效") return "green";
    if (status === "系統管理員") return "yellow";
    return "red";
  }

  function isUsableMember(member) {
    return member.status === "有效" || member.status === "系統管理員";
  }

  function sortedEvents() {
    return [...db().events].sort((a, b) => Utils.eventSortValue(b) - Utils.eventSortValue(a));
  }

  function eventById(eventId) {
    return db().events.find((event) => event.eventId === eventId);
  }

  function memberById(memberId) {
    return db().members.find((member) => member.memberId === memberId);
  }

  function displayUrl(eventId) {
    const token = (window.Y2kConfig && window.Y2kConfig.displayToken) || "y2k-display-2026";
    const url = new URL("display.html", window.location.href);
    url.searchParams.set("eventId", eventId);
    url.searchParams.set("token", token);
    return url.toString();
  }

  function downloadExcel(filename, tableHtml) {
    const content = `<html><head><meta charset="utf-8"></head><body>${tableHtml}</body></html>`;
    const blob = new Blob(["\ufeff", content], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/[\\/:*?"<>|]/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderStats() {
    const data = db();
    const countedMembers = data.members.filter(isCountedMember);
    $("statMembers").textContent = countedMembers.length;
    $("statBound").textContent = countedMembers.filter((member) => member.lineUserId || member.lineBound).length;
    $("statEvents").textContent = data.events.filter((event) => event.status === "開放").length;
    $("statRegs").textContent = data.registrations.filter((item) => item.status === "已報名").length;
    $("statCheckins").textContent = data.attendance.filter((item) => item.status === "已簽到").length;
  }

  function renderDashboard() {
    const data = db();
    $("dashboardList").innerHTML = sortedEvents().map((event) => {
      const reg = registrationStats(data, event.eventId);
      const checkins = attendanceStats(data, event.eventId);
      return `
        <article class="item">
          <div class="item-row">
            <div>
              <h3>${escapeHtml(event.name)}</h3>
              <div class="meta">
                <span>${escapeHtml(Utils.formatEventDate(event))}</span>
                <span>${escapeHtml(event.location || "未填地點")}</span>
              </div>
            </div>
            <span class="badge ${event.status === "開放" ? "green" : "yellow"}">${escapeHtml(event.status)}</span>
          </div>
          <div class="meta">
            <span>有效報名 ${reg.active}</span>
            <span>同行 ${reg.companions}</span>
            <span>預估總人數 ${reg.total}</span>
            <span>已簽到 ${checkins}</span>
            <span>報名：${event.registrationOpen ? "開放" : "關閉"}</span>
            <span>簽到：${event.checkinOpen ? "開放" : "關閉"}</span>
          </div>
        </article>
      `;
    }).join("") || `<p class="muted">尚未建立活動。</p>`;
  }

  function renderMembers() {
    const data = db();
    const keyword = ($("memberSearch").value || "").trim().toLowerCase();
    const members = data.members.filter((member) => {
      const text = `${member.memberId} ${member.name} ${member.phone || ""}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });

    $("memberList").innerHTML = members.map((member) => {
      const bound = Boolean(member.lineUserId || member.lineBound);
      const canUnbind = session && session.role === "系統管理員" && bound;
      return `
        <article class="item">
          <div class="item-row">
            <div>
              <h3>${escapeHtml(member.name)}</h3>
              <div class="meta">
                <span>${escapeHtml(member.memberId)}</span>
                <span>${escapeHtml(member.phoneMasked || Utils.maskPhone(member.phone))}</span>
                <span>${escapeHtml(member.annualRole || "未設定職位")}</span>
                <span>${escapeHtml(member.birthday || "未填生日")}</span>
              </div>
            </div>
            <span class="badge ${memberStatusBadgeClass(member.status)}">${escapeHtml(member.status)}</span>
          </div>
          <div class="meta">
            <span>LINE：${bound ? `已綁定 (${escapeHtml(member.lineDisplayName || member.lineUserId || "LINE")})` : "未綁定"}</span>
            <span>最後登入：${Utils.displayDateTime(member.lastLoginAt) || "尚無"}</span>
          </div>
          <div class="button-row">
            <button class="secondary small" data-action="edit-member" data-member="${escapeHtml(member.memberId)}" type="button">編輯</button>
            <button class="secondary small" data-action="member-attendance" data-member="${escapeHtml(member.memberId)}" type="button">出席紀錄</button>
            ${canUnbind ? `<button class="danger small" data-action="unbind-member" data-member="${escapeHtml(member.memberId)}" type="button">解除 LINE 綁定</button>` : ""}
          </div>
        </article>
      `;
    }).join("") || `<p class="muted">沒有符合的會員。</p>`;
  }

  function renderEvents() {
    $("eventAdminList").innerHTML = sortedEvents().map((event) => `
      <article class="item">
        <div class="item-row">
          <div>
            <h3>${escapeHtml(event.name)}</h3>
            <div class="meta">
              <span>${escapeHtml(event.eventId)}</span>
              <span>${escapeHtml(Utils.formatEventDate(event))}</span>
              <span>${escapeHtml(event.location || "未填地點")}</span>
            </div>
          </div>
          <span class="badge ${event.status === "開放" ? "green" : "yellow"}">${escapeHtml(event.status)}</span>
        </div>
        <div class="meta">
          <span>報名：${event.registrationOpen ? "開放" : "關閉"}</span>
          <span>簽到：${event.checkinOpen ? "開放" : "關閉"}</span>
          <span>${escapeHtml(event.notes || "")}</span>
        </div>
        <div class="button-row">
          <button class="secondary small" data-action="edit-event" data-event="${escapeHtml(event.eventId)}" type="button">編輯</button>
          <button class="secondary small" data-action="open-display" data-event="${escapeHtml(event.eventId)}" type="button">即時看板</button>
          <button class="secondary small" data-action="export-event" data-event="${escapeHtml(event.eventId)}" type="button">匯出 Excel</button>
          <button class="danger small" data-action="delete-event" data-event="${escapeHtml(event.eventId)}" type="button">刪除</button>
        </div>
      </article>
    `).join("") || `<p class="muted">尚未建立活動。</p>`;
    fillEventSelects();
  }

  function fillEventSelects() {
    const data = db();
    const events = sortedEvents();
    const options = events.map((event) => `<option value="${escapeHtml(event.eventId)}">${escapeHtml(event.name)}</option>`).join("");
    ["registrationEventFilter", "manualEventSelect", "attendanceEventFilter", "reportEventFilter"].forEach((id) => {
      const select = $(id);
      const old = select.value;
      select.innerHTML = options;
      if (events.some((event) => event.eventId === old)) select.value = old;
    });
    $("manualMemberSelect").innerHTML = data.members
      .filter(isUsableMember)
      .map((member) => `<option value="${escapeHtml(member.memberId)}">${escapeHtml(member.memberId)} ${escapeHtml(member.name)}</option>`)
      .join("");
  }

  function renderRegistrations() {
    const data = db();
    const eventId = $("registrationEventFilter").value || (sortedEvents()[0] && sortedEvents()[0].eventId);
    const rows = data.registrations
      .filter((item) => item.eventId === eventId)
      .map((item) => {
        const member = data.members.find((candidate) => candidate.memberId === item.memberId);
        return `
          <tr>
            <td>${escapeHtml(item.status)}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(member ? member.phoneMasked || Utils.maskPhone(member.phone) : "")}</td>
            <td>${Number(item.companions || 0)}</td>
            <td>${Utils.displayDateTime(item.registeredAt)}</td>
            <td>${Utils.displayDateTime(item.canceledAt) || ""}</td>
            <td>${escapeHtml(item.notes || "")}</td>
          </tr>
        `;
      }).join("");
    $("registrationList").innerHTML = `
      <table>
        <thead><tr><th>狀態</th><th>姓名</th><th>手機</th><th>同行</th><th>報名時間</th><th>取消時間</th><th>備註</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7">目前尚無報名紀錄。</td></tr>`}</tbody>
      </table>
    `;
  }

  function renderAttendance() {
    const data = db();
    const eventId = $("attendanceEventFilter").value || (sortedEvents()[0] && sortedEvents()[0].eventId);
    const activeRegs = data.registrations.filter((item) => item.eventId === eventId && item.status === "已報名");
    const activeAttendance = data.attendance.filter((item) => item.eventId === eventId && item.status === "已簽到");
    const attendedIds = new Set(activeAttendance.map((item) => item.memberId));
    const registeredIds = new Set(activeRegs.map((item) => item.memberId));
    const registeredAndAttended = activeRegs.filter((item) => attendedIds.has(item.memberId));
    const registeredNotAttended = activeRegs.filter((item) => !attendedIds.has(item.memberId));
    const notRegisteredAttended = activeAttendance.filter((item) => !registeredIds.has(item.memberId));

    $("attendanceCompare").innerHTML = `
      <article class="compare-card"><span>已報名且已簽到</span><strong>${registeredAndAttended.length}</strong></article>
      <article class="compare-card"><span>已報名未簽到</span><strong>${registeredNotAttended.length}</strong></article>
      <article class="compare-card"><span>未報名已簽到</span><strong>${notRegisteredAttended.length}</strong></article>
      <article class="compare-card"><span>總簽到</span><strong>${activeAttendance.length}</strong></article>
    `;

    const rows = activeAttendance.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${Utils.displayDateTime(item.checkedInAt)}</td>
        <td>${escapeHtml(item.method)}</td>
        <td>${escapeHtml(item.actor || "")}</td>
        <td>${escapeHtml(item.notes || "")}</td>
        <td><button class="danger small" data-action="cancel-checkin" data-attendance="${escapeHtml(item.attendanceId)}" type="button">取消</button></td>
      </tr>
    `).join("");
    $("attendanceList").innerHTML = `
      <table>
        <thead><tr><th>姓名</th><th>簽到時間</th><th>方式</th><th>操作人</th><th>備註</th><th>操作</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6">目前尚無簽到紀錄。</td></tr>`}</tbody>
      </table>
    `;
  }

  function attendanceReportRows(eventId) {
    const data = db();
    const activeRegs = data.registrations.filter((item) => item.eventId === eventId && item.status === "已報名");
    const activeAttendance = data.attendance.filter((item) => item.eventId === eventId && item.status === "已簽到");
    const registrationByMember = new Map(activeRegs.map((item) => [item.memberId, item]));
    const attendanceByMember = new Map(activeAttendance.map((item) => [item.memberId, item]));
    const includedIds = new Set([...registrationByMember.keys(), ...attendanceByMember.keys()]);

    return Array.from(includedIds).map((memberId) => {
      const member = memberById(memberId) || {};
      const registration = registrationByMember.get(memberId) || null;
      const attendance = attendanceByMember.get(memberId) || null;
      const registered = Boolean(registration);
      const checked = Boolean(attendance);
      return {
        memberId,
        name: member.name || registration?.name || attendance?.name || memberId,
        phone: member.phone || "",
        phoneMasked: member.phoneMasked || "",
        annualRole: member.annualRole || "",
        registered,
        checked,
        registration,
        attendance,
        statusKey: checked ? (registered ? "checked" : "walkin") : (registered ? "registered-unchecked" : "absent")
      };
    });
  }

  function memberAttendanceRows(memberId) {
    const data = db();
    const memberRegs = data.registrations.filter((item) => item.memberId === memberId);
    const memberAttendance = data.attendance.filter((item) => item.memberId === memberId);
    const ids = new Set([
      ...memberRegs.map((item) => item.eventId),
      ...memberAttendance.map((item) => item.eventId)
    ]);
    return Array.from(ids).map((eventId) => {
      const event = eventById(eventId);
      const registration = memberRegs.find((item) => item.eventId === eventId) || null;
      const attendance = memberAttendance.find((item) => item.eventId === eventId && item.status === "已簽到") || null;
      return {
        eventId,
        event,
        registration,
        attendance,
        time: attendance?.checkedInAt || registration?.registeredAt || (event && event.date) || ""
      };
    }).sort((a, b) => String(b.time).localeCompare(String(a.time)));
  }

  function renderMemberAttendance(memberId) {
    const member = memberById(memberId);
    if (!member) return;
    const rows = memberAttendanceRows(memberId);
    const registered = rows.filter((row) => row.registration && row.registration.status === "已報名").length;
    const checked = rows.filter((row) => row.attendance).length;
    const canceled = rows.filter((row) => row.registration && row.registration.status === "已取消").length;
    $("memberAttendanceTitle").textContent = `${member.name} 出席狀況`;
    $("memberAttendanceMeta").textContent = `${member.memberId}｜${member.annualRole || "未設定職位"}｜${member.phoneMasked || Utils.maskPhone(member.phone)}`;
    $("memberAttendanceSummary").innerHTML = `
      <article class="compare-card"><span>有紀錄活動</span><strong>${rows.length}</strong></article>
      <article class="compare-card"><span>有效報名</span><strong>${registered}</strong></article>
      <article class="compare-card"><span>已簽到</span><strong>${checked}</strong></article>
      <article class="compare-card"><span>取消報名</span><strong>${canceled}</strong></article>
    `;
    $("memberAttendanceList").innerHTML = `
      <table>
        <thead><tr><th>活動</th><th>日期時間</th><th>地點</th><th>報名</th><th>同行</th><th>簽到</th><th>簽到時間</th><th>方式</th></tr></thead>
        <tbody>${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.event ? row.event.name : row.eventId)}</td>
            <td>${escapeHtml(row.event ? Utils.formatEventDate(row.event) : "")}</td>
            <td>${escapeHtml(row.event?.location || "")}</td>
            <td>${escapeHtml(row.registration?.status || "未報名")}</td>
            <td>${Number(row.registration?.companions || 0)}</td>
            <td>${row.attendance ? "已簽到" : "未簽到"}</td>
            <td>${Utils.displayDateTime(row.attendance?.checkedInAt) || ""}</td>
            <td>${escapeHtml(row.attendance?.method || "")}</td>
          </tr>
        `).join("") || `<tr><td colspan="8">此會員目前沒有活動紀錄。</td></tr>`}</tbody>
      </table>
    `;
    $("memberAttendancePanel").classList.remove("hidden");
    $("memberAttendancePanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderReports() {
    const data = db();
    const eventId = $("reportEventFilter").value || (sortedEvents()[0] && sortedEvents()[0].eventId);
    const status = $("reportStatusFilter").value || "all";
    const keyword = ($("reportMemberSearch").value || "").trim().toLowerCase();
    const rows = attendanceReportRows(eventId);
    const filtered = rows.filter((row) => {
      const statusOk = status === "all" || row.statusKey === status || (status === "absent" && !row.checked);
      const searchText = `${row.memberId} ${row.name} ${row.phone} ${row.annualRole}`.toLowerCase();
      return statusOk && (!keyword || searchText.includes(keyword));
    });
    const checked = rows.filter((row) => row.checked).length;
    const registered = rows.filter((row) => row.registered).length;
    const registeredUnchecked = rows.filter((row) => row.registered && !row.checked).length;
    const walkin = rows.filter((row) => !row.registered && row.checked).length;

    $("reportSummary").innerHTML = `
      <article class="compare-card"><span>已報名</span><strong>${registered}</strong></article>
      <article class="compare-card"><span>已簽到</span><strong>${checked}</strong></article>
      <article class="compare-card"><span>已報名未簽到</span><strong>${registeredUnchecked}</strong></article>
      <article class="compare-card"><span>未報名已簽到</span><strong>${walkin}</strong></article>
    `;

    $("reportList").innerHTML = `
      <table>
        <thead><tr><th>會員</th><th>年度職位</th><th>手機</th><th>報名</th><th>同行</th><th>簽到</th><th>簽到時間</th><th>方式</th></tr></thead>
        <tbody>${filtered.map((row) => `
          <tr>
            <td>${escapeHtml(row.memberId)} ${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.annualRole || "")}</td>
            <td>${escapeHtml(row.phoneMasked || Utils.maskPhone(row.phone))}</td>
            <td>${row.registered ? "已報名" : "未報名"}</td>
            <td>${Number(row.registration?.companions || 0)}</td>
            <td>${row.checked ? "已簽到" : "未簽到"}</td>
            <td>${Utils.displayDateTime(row.attendance?.checkedInAt) || ""}</td>
            <td>${escapeHtml(row.attendance?.method || "")}</td>
          </tr>
        `).join("") || `<tr><td colspan="8">沒有符合的出席資料。</td></tr>`}</tbody>
      </table>
    `;
  }

  function renderLogs() {
    const rows = db().auditLogs.slice(0, 80).map((log) => `
      <tr>
        <td>${Utils.displayDateTime(log.time)}</td>
        <td>${escapeHtml(log.actor)}</td>
        <td>${escapeHtml(log.action)}</td>
        <td>${escapeHtml(log.targetType)}</td>
        <td>${escapeHtml(log.targetId)}</td>
        <td>${escapeHtml(log.detail || "")}</td>
      </tr>
    `).join("");
    $("logList").innerHTML = `
      <table>
        <thead><tr><th>時間</th><th>操作人</th><th>動作</th><th>資料類型</th><th>資料編號</th><th>內容</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6">尚無操作紀錄。</td></tr>`}</tbody>
      </table>
    `;
  }

  function renderFromState() {
    renderStats();
    renderDashboard();
    renderMembers();
    renderEvents();
    renderRegistrations();
    renderAttendance();
    renderReports();
    renderLogs();
  }

  async function renderAll() {
    try {
      if (!await refreshDashboard()) return;
      showLoginMessage("", "");
      renderFromState();
    } catch (error) {
      showLoginMessage(error.message, "error");
    }
  }

  async function login() {
    try {
      await Api.adminLogin($("username").value.trim(), $("password").value);
      showLoginMessage("", "");
      await renderAll();
    } catch (error) {
      showLoginMessage(error.message, "error");
    }
  }

  async function checkApiHealth() {
    try {
      renderConnectionStatus("檢查中...", "");
      const result = await Api.health();
      const version = result.version || "unknown";
      const time = Utils.displayDateTime(result.now) || Utils.displayDateTime(new Date().toISOString());
      renderConnectionStatus(`連線正常｜版本 ${version}｜${time}`, "ok");
    } catch (error) {
      renderConnectionStatus(error.message, "error");
    }
  }

  async function changePassword() {
    const oldPassword = prompt("請輸入目前密碼");
    if (oldPassword == null) return;
    const newPassword = prompt("請輸入新密碼，至少 8 碼");
    if (newPassword == null) return;
    const confirmPassword = prompt("請再次輸入新密碼");
    if (confirmPassword == null) return;
    if (newPassword !== confirmPassword) {
      alert("兩次新密碼不一致。");
      return;
    }
    try {
      await Api.changeAdminPassword(oldPassword, newPassword);
      alert("密碼已變更，請妥善保存新密碼。");
    } catch (error) {
      alert(error.message);
    }
  }

  async function saveMember() {
    try {
      dashboardState = await Api.saveMember({
        memberId: $("memberIdInput").value.trim(),
        name: $("memberNameInput").value.trim(),
        phone: $("memberPhoneInput").value.trim(),
        status: $("memberStatusInput").value,
        birthday: $("memberBirthdayInput").value.trim(),
        annualRole: $("memberAnnualRoleInput").value.trim()
      });
      ["memberIdInput", "memberNameInput", "memberPhoneInput", "memberBirthdayInput", "memberAnnualRoleInput"].forEach((id) => { $(id).value = ""; });
      $("memberStatusInput").value = "有效";
      renderFromState();
    } catch (error) {
      alert(error.message);
    }
  }

  async function saveEvent() {
    try {
      dashboardState = await Api.saveEvent({
        eventId: $("eventIdInput").value,
        name: $("eventNameInput").value.trim(),
        date: $("eventDateInput").value,
        startTime: $("eventStartInput").value,
        endTime: $("eventEndInput").value,
        location: $("eventLocationInput").value.trim(),
        status: $("eventStatusInput").value,
        registrationOpen: $("eventRegInput").checked,
        checkinOpen: $("eventCheckinInput").checked,
        notes: $("eventNotesInput").value.trim()
      });
      ["eventIdInput", "eventNameInput", "eventDateInput", "eventStartInput", "eventEndInput", "eventLocationInput", "eventNotesInput"].forEach((id) => { $(id).value = ""; });
      $("eventStatusInput").value = "開放";
      $("eventRegInput").checked = true;
      $("eventCheckinInput").checked = true;
      renderFromState();
    } catch (error) {
      alert(error.message);
    }
  }

  function exportEventExcel(eventId) {
    const event = eventById(eventId);
    if (!event) return;
    const rows = attendanceReportRows(eventId);
    const tableRows = rows.map((row) => `
      <tr>
        <td>${escapeHtml(event.eventId)}</td>
        <td>${escapeHtml(event.name)}</td>
        <td>${escapeHtml(Utils.formatEventDate(event))}</td>
        <td>${escapeHtml(row.memberId)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.annualRole || "")}</td>
        <td>${escapeHtml(row.phone)}</td>
        <td>${row.registered ? "已報名" : "未報名"}</td>
        <td>${Number(row.registration?.companions || 0)}</td>
        <td>${escapeHtml(row.registration?.notes || "")}</td>
        <td>${row.checked ? "已簽到" : "未簽到"}</td>
        <td>${Utils.displayDateTime(row.attendance?.checkedInAt) || ""}</td>
        <td>${escapeHtml(row.attendance?.method || "")}</td>
        <td>${escapeHtml(row.attendance?.notes || "")}</td>
      </tr>
    `).join("");
    downloadExcel(`${event.eventId}-${event.name || "活動"}-出席報表.xls`, `
      <table border="1">
        <thead><tr><th>活動編號</th><th>活動名稱</th><th>活動時間</th><th>會員編號</th><th>姓名</th><th>年度職位</th><th>手機</th><th>報名狀態</th><th>同行</th><th>報名備註</th><th>簽到狀態</th><th>簽到時間</th><th>方式</th><th>簽到備註</th></tr></thead>
        <tbody>${tableRows || `<tr><td colspan="14">無資料</td></tr>`}</tbody>
      </table>
    `);
  }

  function exportMembersExcel() {
    const rows = db().members.map((member) => `
      <tr>
        <td>${escapeHtml(member.memberId)}</td>
        <td>${escapeHtml(member.name)}</td>
        <td>${escapeHtml(member.phone || "")}</td>
        <td>${escapeHtml(member.status || "")}</td>
        <td>${escapeHtml(member.annualRole || "")}</td>
        <td>${escapeHtml(member.birthday || "")}</td>
        <td>${member.lineUserId || member.lineBound ? "已綁定" : "未綁定"}</td>
        <td>${escapeHtml(member.lineDisplayName || "")}</td>
        <td>${Utils.displayDateTime(member.boundAt) || ""}</td>
        <td>${Utils.displayDateTime(member.lastLoginAt) || ""}</td>
      </tr>
    `).join("");
    downloadExcel("千禧獅子會-會員清單.xls", `
      <table border="1">
        <thead><tr><th>會員編號</th><th>姓名</th><th>手機</th><th>會員狀態</th><th>年度職位</th><th>生日</th><th>LINE綁定</th><th>LINE顯示名稱</th><th>綁定時間</th><th>最後登入</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10">無資料</td></tr>`}</tbody>
      </table>
    `);
  }

  async function handleAction(button) {
    const action = button.dataset.action;
    const data = db();
    if (action === "edit-member") {
      const member = data.members.find((item) => item.memberId === button.dataset.member);
      if (!member) return;
      $("memberIdInput").value = member.memberId;
      $("memberNameInput").value = member.name;
      $("memberPhoneInput").value = member.phone || "";
      $("memberStatusInput").value = member.status;
      $("memberBirthdayInput").value = member.birthday || "";
      $("memberAnnualRoleInput").value = member.annualRole || "";
    }
    if (action === "unbind-member") {
      if (!confirm("確定解除此會員 LINE 綁定？")) return;
      dashboardState = await Api.unbindMember(button.dataset.member);
      renderFromState();
    }
    if (action === "member-attendance") {
      renderMemberAttendance(button.dataset.member);
    }
    if (action === "edit-event") {
      const event = data.events.find((item) => item.eventId === button.dataset.event);
      if (!event) return;
      $("eventIdInput").value = event.eventId;
      $("eventNameInput").value = event.name;
      $("eventDateInput").value = event.date;
      $("eventStartInput").value = event.startTime;
      $("eventEndInput").value = event.endTime;
      $("eventLocationInput").value = event.location;
      $("eventStatusInput").value = event.status;
      $("eventRegInput").checked = event.registrationOpen;
      $("eventCheckinInput").checked = event.checkinOpen;
      $("eventNotesInput").value = event.notes;
    }
    if (action === "open-display") {
      window.open(displayUrl(button.dataset.event), "_blank", "noopener");
    }
    if (action === "export-event") {
      exportEventExcel(button.dataset.event);
    }
    if (action === "delete-event") {
      const event = data.events.find((item) => item.eventId === button.dataset.event);
      if (!event) return;
      const regCount = data.registrations.filter((item) => item.eventId === event.eventId).length;
      const attendanceCount = data.attendance.filter((item) => item.eventId === event.eventId).length;
      const message = regCount || attendanceCount
        ? `確定刪除「${event.name}」？\n此動作會一併刪除 ${regCount} 筆報名與 ${attendanceCount} 筆簽到紀錄。`
        : `確定刪除「${event.name}」？`;
      if (!confirm(message)) return;
      dashboardState = await Api.deleteEvent(event.eventId, true);
      $("eventIdInput").value = "";
      renderFromState();
    }
    if (action === "cancel-checkin") {
      if (!confirm("確定取消這筆簽到？")) return;
      dashboardState = await Api.cancelCheckIn(button.dataset.attendance);
      renderFromState();
    }
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (tab) {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
      tab.classList.add("active");
      $(`${tab.dataset.tab}Tab`).classList.remove("hidden");
      return;
    }
    const actionButton = event.target.closest("button[data-action]");
    if (actionButton) handleAction(actionButton).catch((error) => alert(error.message));
  });

  document.addEventListener("DOMContentLoaded", () => {
    $("loginButton").addEventListener("click", () => login());
    $("apiHealthButton").addEventListener("click", () => checkApiHealth());
    $("changePasswordButton").addEventListener("click", () => changePassword());
    $("logoutButton").addEventListener("click", async () => {
      await Api.adminLogout();
      dashboardState = null;
      renderAll();
    });
    $("saveMemberButton").addEventListener("click", () => saveMember());
    $("saveEventButton").addEventListener("click", () => saveEvent());
    $("exportMembersButton").addEventListener("click", exportMembersExcel);
    $("closeMemberAttendanceButton").addEventListener("click", () => $("memberAttendancePanel").classList.add("hidden"));
    $("memberSearch").addEventListener("input", renderMembers);
    $("registrationEventFilter").addEventListener("change", renderRegistrations);
    $("attendanceEventFilter").addEventListener("change", renderAttendance);
    $("reportEventFilter").addEventListener("change", renderReports);
    $("reportStatusFilter").addEventListener("change", renderReports);
    $("reportMemberSearch").addEventListener("input", renderReports);
    $("manualCheckinButton").addEventListener("click", async () => {
      try {
        dashboardState = await Api.manualCheckIn($("manualEventSelect").value, $("manualMemberSelect").value, $("manualNotesInput").value.trim());
        $("manualNotesInput").value = "";
        renderFromState();
      } catch (error) {
        alert(error.message);
      }
    });
    renderAll();
  });
})();
