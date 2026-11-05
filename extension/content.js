// Shows the usage table on https://cursor.com/dashboard in the browser's time zone instead of UTC.
//
// The dashboard draws the table as <div role="table"> with a "Date (UTC)" column header, and every date cell as
//   <div role="cell"><span title="Nov 5, 2026, 03:02:49 AM UTC">Nov 5, 03:02 AM</span></div>
// The title carries the full UTC time (with year and seconds), so nothing has to be guessed: parse the title,
// rewrite the cell text and the title in local time, and rewrite the header's label. A converted title no longer
// ends in " UTC", so a converted cell is never converted twice, and a cell the page re-renders (new data, a new
// page of rows) goes back to UTC and is converted again by the observer.
//
// Only the display changes. The date filter (?from=&to=) and the daily totals are computed by the server in UTC.
(function () {
  "use strict";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const UTC_TITLE = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2}) ([AP]M) UTC$/;
  const HEADER_UTC = "Date (UTC)";
  const HEADER_PREFIX = "Date (UTC"; // also matches an already converted header: "Date (UTC+8)"

  // ICU in some engines puts a narrow no-break space before AM/PM; the page uses a plain space.
  const plain = (text) => text.replace(/[\u202f\u00a0]/g, " ");

  /** The epoch milliseconds of a title such as "Nov 5, 2026, 03:02:49 AM UTC", or null if it is not one. */
  function parseUtcTitle(text) {
    const m = UTC_TITLE.exec(plain(text));
    if (!m) return null;
    const month = MONTHS.indexOf(m[1]);
    const [day, year, hour12, minute, second] = [m[2], m[3], m[4], m[5], m[6]].map(Number);
    if (month < 0 || hour12 < 1 || hour12 > 12 || minute > 59 || second > 59) return null;
    const hour = (hour12 % 12) + (m[7] === "PM" ? 12 : 0);
    const ms = Date.UTC(year, month, day, hour, minute, second);
    const back = new Date(ms);
    return back.getUTCMonth() === month && back.getUTCDate() === day ? ms : null; // rejects "Feb 31"
  }

  const OPTIONS = {
    cell: { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
    title: { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" },
    offset: { timeZoneName: "longOffset" },
  };
  const formatters = new Map();

  function formatter(kind, timeZone) {
    const key = kind + "|" + (timeZone || "");
    let f = formatters.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", Object.assign({ timeZone, hour12: true }, OPTIONS[kind]));
      formatters.set(key, f);
    }
    return f;
  }

  /** "Nov 5, 11:02 AM": the same look as the page's own cell text. `timeZone` undefined = the browser's. */
  function formatCell(ms, timeZone) {
    return plain(formatter("cell", timeZone).format(ms));
  }

  /** "Nov 5, 2026, 11:02:49 AM GMT+8": the tooltip, now in local time (and in the page's own style: 2-digit hours). */
  function formatTitle(ms, timeZone) {
    return plain(formatter("title", timeZone).format(ms));
  }

  /** "UTC+8", "UTC-7", "UTC+5:30", "UTC": how far the zone is from UTC at that moment. */
  function offsetLabel(ms, timeZone) {
    const part = formatter("offset", timeZone).formatToParts(ms).find((p) => p.type === "timeZoneName");
    const name = part ? part.value : "UTC";
    const m = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name);
    if (!m) return name;
    const minutes = m[3] && m[3] !== "00" ? ":" + m[3] : "";
    if (!m[1] || (Number(m[2]) === 0 && !minutes)) return "UTC"; // some engines say "GMT", some "GMT+00:00"
    return "UTC" + m[1] + Number(m[2]) + minutes;
  }

  function setText(element, text) {
    const only = element.childNodes.length === 1 ? element.firstChild : null;
    if (only && only.nodeType === 3) {
      if (only.nodeValue !== text) only.nodeValue = text; // keep the text node: the page's framework holds it
    } else if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  /** Converts one date cell's span if it still shows UTC. Returns whether it changed anything. */
  function convertCell(span, timeZone) {
    const title = span.getAttribute("title");
    const ms = title === null ? null : parseUtcTitle(title);
    if (ms === null) return false;
    const text = formatCell(ms, timeZone);
    const local = formatTitle(ms, timeZone);
    const changed = span.textContent !== text || title !== local;
    setText(span, text);
    if (title !== local) span.setAttribute("title", local);
    return changed;
  }

  /** Rewrites a "Date (UTC)" column header to the zone the cells are now in. */
  function convertHeader(header, timeZone, now) {
    if (header.getAttribute("aria-label") !== HEADER_UTC) return false;
    const label = "Date (" + offsetLabel(now, timeZone) + ")";
    if (label === HEADER_UTC) return false;
    header.setAttribute("aria-label", label);
    const span = header.querySelector("span") || header;
    setText(span, label);
    return true;
  }

  /** One pass over the document. Only tables that have a "Date (UTC…)" column header are touched. */
  function convertAll(doc, timeZone, now) {
    let changed = 0;
    for (const table of doc.querySelectorAll('[role="table"]')) {
      const headers = Array.from(table.querySelectorAll('[role="columnheader"]'));
      if (!headers.some((h) => (h.getAttribute("aria-label") || "").startsWith(HEADER_PREFIX))) continue;
      for (const header of headers) if (convertHeader(header, timeZone, now === undefined ? Date.now() : now)) changed++;
      for (const span of table.querySelectorAll('[role="cell"] span[title]')) if (convertCell(span, timeZone)) changed++;
    }
    return changed;
  }

  /** Converts now and again whenever the page changes (data loads, a new page of rows, a route change). */
  function start(options) {
    const { doc = document, win = window, timeZone } = options || {};
    const run = () => convertAll(doc, timeZone);
    // Right in the observer callback, before the browser paints: no flash of UTC. Our own writes trigger one more
    // callback that finds nothing left to do.
    const observer = new win.MutationObserver(run);
    observer.observe(doc, { // the document itself: at document_start the <html> element may not be there yet
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label"],
    });
    run();
    return observer;
  }

  const api = { parseUtcTitle, formatCell, formatTitle, offsetLabel, convertCell, convertHeader, convertAll, start };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else start();
})();
