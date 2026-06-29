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

  function datePart(value) {
    const text = String(value || "");
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return [date.getFullYear(), date.getMonth(), date.getDate()];
  }

  function timePart(value, fallbackHour, fallbackMinute) {
    const text = String(value || "");
    const match = text.match(/(\d{1,2}):(\d{2})/);
    if (match) return [Number(match[1]), Number(match[2])];
    return [fallbackHour, fallbackMinute];
  }

  function eventDateTime(event, boundary) {
    const date = datePart(event.date);
    if (!date) return null;
    const fallback = boundary === "end" ? [23, 59] : [0, 0];
    const time = timePart(boundary === "end" ? event.endTime : event.startTime, fallback[0], fallback[1]);
    return new Date(date[0], date[1], date[2], time[0], time[1], boundary === "end" ? 59 : 0, 0);
  }

  function eventTiming(event, nowValue) {
    const now = nowValue ? new Date(nowValue) : new Date();
    const start = eventDateTime(event, "start");
    const end = eventDateTime(event, "end");
    if (!start || !end) return { beforeStart: false, during: false, afterEnd: false };
    return {
      beforeStart: now.getTime() < start.getTime(),
      during: now.getTime() >= start.getTime() && now.getTime() <= end.getTime(),
      afterEnd: now.getTime() > end.getTime(),
      start,
      end
    };
  }

  function maskPhone(phone) {
    const text = String(phone || "");
    if (text.length < 7) return text;
    return `${text.slice(0, 4)}***${text.slice(-3)}`;
  }

  window.Y2kUtils = {
    displayDateTime,
    formatEventDate,
    eventTiming,
    maskPhone
  };
})();
