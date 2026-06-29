(function () {
  "use strict";

  const config = window.Y2kConfig || { apiUrl: "" };
  const ADMIN_SESSION_KEY = "y2k-api-admin-session-v1";
  const LINE_ID_KEY = "y2k-line-user-id-v1";

  function requireApiUrl() {
    if (!config.apiUrl || config.apiUrl.includes("PASTE_APPS_SCRIPT")) {
      throw new Error("尚未設定 Apps Script API URL");
    }
  }

  async function post(payload) {
    requireApiUrl();
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (_error) {
      throw new Error("後端回應格式不正確，請確認 Apps Script 已重新部署");
    }
    if (!result.ok) throw new Error(result.error || "操作失敗");
    return result.data;
  }

  async function getLineIdentity() {
    const url = new URL(window.location.href);
    const urlLineId = url.searchParams.get("lineUserId");
    if (urlLineId) {
      sessionStorage.setItem(LINE_ID_KEY, urlLineId);
      return {
        lineUserId: urlLineId,
        displayName: url.searchParams.get("displayName") || ""
      };
    }

    if (window.liff && config.liffId) {
      await window.liff.init({ liffId: config.liffId });
      if (!window.liff.isLoggedIn()) {
        window.liff.login();
        return null;
      }
      const profile = await window.liff.getProfile();
      sessionStorage.setItem(LINE_ID_KEY, profile.userId);
      return {
        lineUserId: profile.userId,
        displayName: profile.displayName || ""
      };
    }

    const stored = sessionStorage.getItem(LINE_ID_KEY);
    if (stored) return { lineUserId: stored, displayName: "" };
    return null;
  }

  function getAdminSession() {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function saveRemoteSession(data) {
    const session = {
      sessionToken: data.sessionToken,
      username: data.admin.username,
      name: data.admin.name,
      role: data.admin.role,
      loginAt: new Date().toISOString()
    };
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSessionToken() {
    const session = getAdminSession();
    return session && session.sessionToken;
  }

  async function memberHome(lineUserId) {
    return post({ action: "memberHome", lineUserId });
  }

  async function bindMember(lineUserId, displayName, phone) {
    await post({ action: "bindMember", lineUserId, lineDisplayName: displayName, phone });
    return memberHome(lineUserId);
  }

  async function registerEvent(lineUserId, eventId, companions, notes) {
    await post({ action: "registerEvent", lineUserId, eventId, companions: Number(companions || 0), notes: notes || "" });
    return memberHome(lineUserId);
  }

  async function cancelRegistration(lineUserId, eventId) {
    await post({ action: "cancelRegistration", lineUserId, eventId });
    return memberHome(lineUserId);
  }

  async function checkIn(lineUserId, eventId) {
    await post({ action: "checkIn", lineUserId, eventId });
    return memberHome(lineUserId);
  }

  async function adminLogin(username, password) {
    return saveRemoteSession(await post({ action: "adminLogin", username, password }));
  }

  async function adminLogout() {
    const token = getSessionToken();
    if (token) {
      try {
        await post({ action: "adminLogout", sessionToken: token });
      } catch (_error) {
        // Local cleanup should still happen if the remote session already expired.
      }
    }
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }

  async function adminDashboard() {
    return post({ action: "adminDashboard", sessionToken: getSessionToken() });
  }

  async function changeAdminPassword(oldPassword, newPassword) {
    return post({
      action: "changeAdminPassword",
      sessionToken: getSessionToken(),
      oldPassword,
      newPassword
    });
  }

  async function health() {
    return post({ action: "health" });
  }

  async function displayDashboard(eventId, token) {
    return post({ action: "displayDashboard", eventId, token });
  }

  async function saveMember(member) {
    await post({ action: "saveMember", sessionToken: getSessionToken(), member });
    return adminDashboard();
  }

  async function unbindMember(memberId) {
    await post({ action: "unbindMember", sessionToken: getSessionToken(), memberId });
    return adminDashboard();
  }

  async function saveEvent(event) {
    await post({ action: "saveEvent", sessionToken: getSessionToken(), event });
    return adminDashboard();
  }

  async function deleteEvent(eventId, force) {
    await post({ action: "deleteEvent", sessionToken: getSessionToken(), eventId, force: Boolean(force) });
    return adminDashboard();
  }

  async function manualCheckIn(eventId, memberId, notes) {
    await post({ action: "manualCheckIn", sessionToken: getSessionToken(), eventId, memberId, notes: notes || "" });
    return adminDashboard();
  }

  async function cancelCheckIn(attendanceId) {
    await post({ action: "cancelCheckIn", sessionToken: getSessionToken(), attendanceId });
    return adminDashboard();
  }

  window.Y2kApi = {
    post,
    getLineIdentity,
    getAdminSession,
    memberHome,
    bindMember,
    registerEvent,
    cancelRegistration,
    checkIn,
    adminLogin,
    adminLogout,
    adminDashboard,
    changeAdminPassword,
    health,
    displayDashboard,
    saveMember,
    unbindMember,
    saveEvent,
    deleteEvent,
    manualCheckIn,
    cancelCheckIn
  };
})();
