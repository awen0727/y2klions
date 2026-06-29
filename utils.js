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

  function twoDigits(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateOnly(value) {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.replaceAll("-", "/");
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}/${twoDigits(date.getMonth() + 1)}/${twoDigits(date.getDate())}`;
    }
    const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) return `${match[1]}/${twoDigits(match[2])}/${twoDigits(match[3])}`;
    return text;
  }

  function formatTimeOnly(value) {
    if (!value) return "";
    const text = String(value);
    const match = text.match(/T?(\d{1,2}):(\d{2})/);
    if (match) return `${twoDigits(match[1])}:${match[2]}`;
    return text;
  }

  function formatEventDate(event) {
    const date = formatDateOnly(event.date);
    const start = formatTimeOnly(event.startTime);
    const end = formatTimeOnly(event.endTime);
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
    formatDateOnly,
    formatTimeOnly,
    formatEventDate,
    eventTiming,
    maskPhone
  };
})();
