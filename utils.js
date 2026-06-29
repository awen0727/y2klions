(function () {
  "use strict";

  function displayDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatEventDate(event) {
    const date = event.date || "";
    const start = event.startTime || "";
    const end = event.endTime || "";
    if (!date) return "日期未定";
    if (start && end) return `${date} ${start}-${end}`;
    if (start) return `${date} ${start}`;
    return date;
  }

  function maskPhone(phone) {
    const text = String(phone || "");
    if (text.length < 7) return text;
    return `${text.slice(0, 4)}***${text.slice(-3)}`;
  }

  window.Y2kUtils = {
    displayDateTime,
    formatEventDate,
    maskPhone
  };
})();
