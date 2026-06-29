(function () {
  "use strict";

  const Api = window.Y2kApi;
  const Utils = window.Y2kUtils;
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, type) {
    $("displayMessage").textContent = text || "";
    $("displayMessage").className = `message ${type || ""}`.trim();
    $("displayMessage").classList.toggle("hidden", !text);
  }

  function updateClock() {
    $("displayClock").textContent = new Date().toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function personLine(item) {
    const member = item.member || {};
    const role = member.annualRole ? `<span class="badge yellow">${escapeHtml(member.annualRole)}</span>` : "";
    return `
      <div class="display-person">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.memberId)}</span>
        </div>
        ${role}
      </div>
    `;
  }

  function render(data) {
    if (!data || !data.event) {
      showMessage("目前沒有可顯示的活動。", "error");
      return;
    }
    const event = data.event;
    $("displayEventName").textContent = event.name || "千禧即時看板";
    $("displayEventMeta").textContent = `${Utils.formatEventDate(event)}｜${event.location || "未填地點"}`;
    $("displayRegistered").textContent = data.stats.registered || 0;
    $("displayCompanions").textContent = data.stats.companions || 0;
    $("displayExpected").textContent = data.stats.expected || 0;
    $("displayChecked").textContent = data.stats.checkedIn || 0;
    $("displayAttendance").innerHTML = (data.attendance || []).map((item) => `
      ${personLine(item)}
      <p class="muted">簽到 ${Utils.displayDateTime(item.checkedInAt)}｜${escapeHtml(item.method || "")}</p>
    `).join("") || `<p class="muted">尚無簽到。</p>`;
    $("displayRegistrations").innerHTML = (data.registrations || []).map((item) => `
      ${personLine(item)}
      <p class="muted">同行 ${Number(item.companions || 0)}${item.notes ? `｜${escapeHtml(item.notes)}` : ""}</p>
    `).join("") || `<p class="muted">尚無報名。</p>`;
    showMessage("", "");
  }

  async function load() {
    const url = new URL(window.location.href);
    const eventId = url.searchParams.get("eventId") || "";
    const token = url.searchParams.get("token") || (window.Y2kConfig && window.Y2kConfig.displayToken) || "";
    try {
      render(await Api.displayDashboard(eventId, token));
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateClock();
    load();
    setInterval(updateClock, 1000);
    setInterval(load, 15000);
  });
})();
