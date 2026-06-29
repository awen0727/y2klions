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

  function renderStats() {
    const data = db();
    $("statMembers").textContent = data.members.length;
    $("statBound").textContent = data.members.filter((member) => member.lineUserId || member.lineBound).length;
    $("statEvents").textContent = data.events.filter((event) => event.status === "開放").length;
    $("statRegs").textContent = data.registrations.filter((item) => item.status === "已報名").length;
    $("statCheckins").textContent = data.attendance.filter((item) => item.status === "已簽到").length;
  }

  function renderDashboard() {
    const data = db();
    $("dashboardList").innerHTML = data.events.map((event) => {
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
                <span>${escapeHtml(member.birthday || "未填生日")}</span>
              </div>
            </div>
            <span class="badge ${member.status === "有效" ? "green" : "red"}">${escapeHtml(member.status)}</span>
          </div>
          <div class="meta">
            <span>LINE：${bound ? `已綁定 (${escapeHtml(member.lineDisplayName || member.lineUserId || "LINE")})` : "未綁定"}</span>
            <span>最後登入：${Utils.displayDateTime(member.lastLoginAt) || "尚無"}</span>
          </div>
          <div class="button-row">
            <button class="secondary small" data-action="edit-member" data-member="${escapeHtml(member.memberId)}" type="button">編輯</button>
            ${canUnbind ? `<button class="danger small" data-action="unbind-member" data-member="${escapeHtml(member.memberId)}" type="button">解除 LINE 綁定</button>` : ""}
          </div>
        </article>
      `;
    }).join("") || `<p class="muted">沒有符合的會員。</p>`;
  }

  function renderEvents() {
    const data = db();
    $("eventAdminList").innerHTML = data.events.map((event) => `
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
        <button class="secondary small" data-action="edit-event" data-event="${escapeHtml(event.eventId)}" type="button">編輯</button>
      </article>
    `).join("") || `<p class="muted">尚未建立活動。</p>`;
    fillEventSelects();
  }

  function fillEventSelects() {
    const data = db();
    const options = data.events.map((event) => `<option value="${escapeHtml(event.eventId)}">${escapeHtml(event.name)}</option>`).join("");
    ["registrationEventFilter", "manualEventSelect", "attendanceEventFilter"].forEach((id) => {
      const select = $(id);
      const old = select.value;
      select.innerHTML = options;
      if (data.events.some((event) => event.eventId === old)) select.value = old;
    });
    $("manualMemberSelect").innerHTML = data.members
      .filter((member) => member.status === "有效")
      .map((member) => `<option value="${escapeHtml(member.memberId)}">${escapeHtml(member.memberId)} ${escapeHtml(member.name)}</option>`)
      .join("");
  }

  function renderRegistrations() {
    const data = db();
    const eventId = $("registrationEventFilter").value || (data.events[0] && data.events[0].eventId);
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
    const eventId = $("attendanceEventFilter").value || (data.events[0] && data.events[0].eventId);
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
        birthday: $("memberBirthdayInput").value.trim()
      });
      ["memberIdInput", "memberNameInput", "memberPhoneInput", "memberBirthdayInput"].forEach((id) => { $(id).value = ""; });
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

  function exportAll() {
    const content = JSON.stringify(db(), null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "y2k-admin-export.json";
    link.click();
    URL.revokeObjectURL(url);
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
    }
    if (action === "unbind-member") {
      if (!confirm("確定解除此會員 LINE 綁定？")) return;
      dashboardState = await Api.unbindMember(button.dataset.member);
      renderFromState();
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
    $("exportAllButton").addEventListener("click", exportAll);
    $("memberSearch").addEventListener("input", renderMembers);
    $("registrationEventFilter").addEventListener("change", renderRegistrations);
    $("attendanceEventFilter").addEventListener("change", renderAttendance);
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
