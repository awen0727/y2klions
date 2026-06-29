(function () {
  "use strict";

  const Api = window.Y2kApi;
  const Utils = window.Y2kUtils;
  let currentIdentity = null;
  let currentState = null;

  const $ = (id) => document.getElementById(id);

  function showMessage(text, type) {
    const box = $("message");
    box.textContent = text;
    box.className = `message ${type || ""}`.trim();
    box.classList.toggle("hidden", !text);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function memberId() {
    return currentState && currentState.member && currentState.member.memberId;
  }

  function findRegistration(eventId) {
    return (currentState.registrations || []).find((item) => item.memberId === memberId() && item.eventId === eventId);
  }

  function findAttendance(eventId) {
    return (currentState.attendance || []).find((item) => item.memberId === memberId() && item.eventId === eventId && item.status === "已簽到");
  }

  async function ensureIdentity() {
    currentIdentity = await Api.getLineIdentity();
    if (currentIdentity && currentIdentity.displayName) {
      $("lineDisplayName").value = currentIdentity.displayName;
    }
    return currentIdentity;
  }

  async function renderMemberState() {
    const identity = await ensureIdentity();
    if (!identity || !identity.lineUserId) {
      $("bindingPanel").classList.add("hidden");
      $("memberHome").classList.add("hidden");
      showMessage("尚未取得 LINE 身分，請從 LINE 入口開啟本系統。", "error");
      return;
    }

    currentState = await Api.memberHome(identity.lineUserId);
    $("bindingPanel").classList.toggle("hidden", Boolean(currentState.bound));
    $("memberHome").classList.toggle("hidden", !currentState.bound);

    if (!currentState.bound) {
      showMessage("此 LINE 帳號尚未綁定會員，請先用手機認證。", "");
      return;
    }

    const member = currentState.member;
    showMessage("", "");
    $("memberGreeting").textContent = `${member.name}，您好`;
    $("memberMeta").textContent = `會員編號 ${member.memberId}｜${member.status}${member.annualRole ? `｜${member.annualRole}` : ""}｜手機 ${member.phoneMasked || Utils.maskPhone(member.phone)}`;
    renderEvents();
    renderRecords();
    renderProfile();
  }

  function renderEvents() {
    const events = (currentState.events || [])
      .filter((event) => event.status === "開放")
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    $("eventList").innerHTML = events.map((event) => {
      const registration = findRegistration(event.eventId);
      const attendance = findAttendance(event.eventId);
      const registered = registration && registration.status === "已報名";
      const canceled = registration && registration.status === "已取消";
      const timing = Utils.eventTiming(event);
      const canRegister = event.registrationOpen && timing.beforeStart;
      const canCheckin = event.checkinOpen && timing.during;
      const timingHint = timing.beforeStart
        ? "活動開始前開放報名，活動期間開放簽到。"
        : timing.during
          ? "活動進行中，可進行簽到。"
          : "活動已結束。";
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
            <span class="badge ${attendance ? "green" : registered ? "yellow" : ""}">
              ${attendance ? "已簽到" : registered ? "已報名" : canceled ? "已取消" : "尚未報名"}
            </span>
          </div>
          <p class="muted">${escapeHtml(event.notes || "")}</p>
          <p class="hint">${escapeHtml(timingHint)}</p>
          ${registered ? `<p class="hint">同行人數：${Number(registration.companions || 0)}｜備註：${escapeHtml(registration.notes || "無")}</p>` : ""}
          <div class="button-row">
            ${canRegister && !registered ? `<button data-action="register" data-event="${escapeHtml(event.eventId)}" type="button">我要報名</button>` : ""}
            ${canRegister && registered ? `<button class="secondary" data-action="cancel-registration" data-event="${escapeHtml(event.eventId)}" type="button">取消報名</button>` : ""}
            ${canCheckin && !attendance ? `<button data-action="checkin" data-event="${escapeHtml(event.eventId)}" type="button">我要簽到</button>` : ""}
            ${attendance ? `<span class="badge green">簽到時間 ${Utils.displayDateTime(attendance.checkedInAt)}</span>` : ""}
          </div>
        </article>
      `;
    }).join("") || `<section class="panel"><p class="muted">目前沒有開放活動。</p></section>`;
  }

  function renderRecords() {
    const eventMap = new Map();
    (currentState.events || []).forEach((event) => {
      eventMap.set(event.eventId, { event, registration: null, attendance: null, time: event.date || "" });
    });
    (currentState.registrations || []).forEach((item) => {
      const event = (currentState.events || []).find((eventItem) => eventItem.eventId === item.eventId);
      const record = eventMap.get(item.eventId) || { event, registration: null, attendance: null, time: "" };
      record.registration = item;
      record.time = item.canceledAt || item.registeredAt || record.time;
      eventMap.set(item.eventId, record);
    });
    (currentState.attendance || []).forEach((item) => {
      const event = (currentState.events || []).find((eventItem) => eventItem.eventId === item.eventId);
      const record = eventMap.get(item.eventId) || { event, registration: null, attendance: null, time: "" };
      if (item.status === "已簽到") record.attendance = item;
      record.time = item.checkedInAt || record.time;
      eventMap.set(item.eventId, record);
    });
    const records = Array.from(eventMap.values()).filter((record) => record.registration || record.attendance);
    records.sort((a, b) => String(b.time).localeCompare(String(a.time)));
    $("recordList").innerHTML = records.map((record) => `
      <article class="item">
        <div class="item-row">
          <div>
            <h3>${escapeHtml(record.event ? record.event.name : (record.registration || record.attendance).eventId)}</h3>
            <p class="muted">${escapeHtml(record.event ? Utils.formatEventDate(record.event) : "")}</p>
          </div>
          <span class="badge ${record.attendance ? "green" : record.registration && record.registration.status === "已報名" ? "yellow" : ""}">
            ${record.attendance ? "已簽到" : record.registration ? record.registration.status : "未簽到"}
          </span>
        </div>
        ${record.registration ? `<p class="muted">報名：${escapeHtml(record.registration.status)}｜${Utils.displayDateTime(record.registration.registeredAt) || "未記錄"}${record.registration.canceledAt ? `｜取消 ${Utils.displayDateTime(record.registration.canceledAt)}` : ""}｜同行 ${Number(record.registration.companions || 0)}</p>` : `<p class="muted">報名：未報名</p>`}
        ${record.attendance ? `<p class="muted">簽到：${Utils.displayDateTime(record.attendance.checkedInAt)}｜${escapeHtml(record.attendance.method || "")}</p>` : `<p class="muted">簽到：尚未簽到</p>`}
      </article>
    `).join("") || `<p class="muted">目前尚無紀錄。</p>`;
  }

  function renderProfile() {
    const member = currentState.member;
    const rows = [
      ["姓名", member.name],
      ["會員編號", member.memberId],
      ["手機", member.phoneMasked || Utils.maskPhone(member.phone)],
      ["會員狀態", member.status],
      ["年度職位", member.annualRole || "未設定"],
      ["生日", member.birthday || "未填"],
      ["LINE 綁定", member.lineBound || member.lineUserId ? "已綁定" : "未綁定"],
      ["綁定時間", Utils.displayDateTime(member.boundAt) || "未綁定"]
    ];
    $("profileDetails").innerHTML = rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
  }

  async function bindMember() {
    try {
      const identity = currentIdentity || await ensureIdentity();
      if (!identity || !identity.lineUserId) throw new Error("尚未取得 LINE 身分");
      currentState = await Api.bindMember(identity.lineUserId, $("lineDisplayName").value.trim(), $("phoneInput").value.trim());
      showMessage(`已成功綁定 ${currentState.member.name}。`, "success");
      $("phoneInput").value = "";
      await renderMemberState();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function promptRegistration(eventId) {
    const companions = prompt("同行人數？", "0");
    if (companions == null) return;
    const notes = prompt("備註？可空白", "") || "";
    try {
      currentState = await Api.registerEvent(currentIdentity.lineUserId, eventId, Number(companions || 0), notes);
      showMessage("報名完成。", "success");
      await renderMemberState();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function cancelRegistration(eventId) {
    if (!confirm("確定取消這場活動報名？")) return;
    try {
      currentState = await Api.cancelRegistration(currentIdentity.lineUserId, eventId);
      showMessage("已取消報名。", "success");
      await renderMemberState();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function checkIn(eventId) {
    try {
      currentState = await Api.checkIn(currentIdentity.lineUserId, eventId);
      showMessage("簽到完成。", "success");
      await renderMemberState();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const eventId = button.dataset.event;
    if (action === "register") promptRegistration(eventId);
    if (action === "cancel-registration") cancelRegistration(eventId);
    if (action === "checkin") checkIn(eventId);
  });

  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (!tab) return;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
    tab.classList.add("active");
    $(`${tab.dataset.tab}Tab`).classList.remove("hidden");
  });

  document.addEventListener("DOMContentLoaded", () => {
    $("bindButton").addEventListener("click", bindMember);
    renderMemberState().catch((error) => showMessage(error.message, "error"));
  });
})();
