"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { convertAll, start } = require("../extension/content.js");

const HTML = fs.readFileSync(path.join(__dirname, "fixtures", "usage-table.html"), "utf8");
const HK = "Asia/Hong_Kong";
const NOW = Date.parse("2026-11-05T03:30:00Z");

const load = () => new JSDOM(HTML, { pretendToBeVisual: true });
const cells = (doc) => Array.from(doc.querySelectorAll("#rows [role=row]")).map((row) => row.querySelector("[role=cell] span"));
const otherColumns = (doc) => Array.from(doc.querySelectorAll("#rows [role=row]")).flatMap((row) => Array.from(row.querySelectorAll("[role=cell]")).slice(1).map((c) => c.textContent));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("converts the date column and the header, and nothing else", () => {
  const { document: doc } = load().window;
  const others = otherColumns(doc);
  assert.equal(convertAll(doc, HK, NOW), 3 + 1); // three cells and the header

  assert.deepEqual(cells(doc).map((s) => s.textContent), ["Nov 5, 11:02 AM", "Nov 5, 08:44 AM", "Nov 5, 07:59 AM"]);
  assert.deepEqual(cells(doc).map((s) => s.title), [
    "Nov 5, 2026, 11:02:49 AM GMT+8", "Nov 5, 2026, 08:44:05 AM GMT+8", "Nov 5, 2026, 07:59:59 AM GMT+8",
  ]);
  const header = doc.querySelector('[role=columnheader]');
  assert.equal(header.getAttribute("aria-label"), "Date (UTC+8)");
  assert.equal(header.textContent, "Date (UTC+8)");
  assert.deepEqual(otherColumns(doc), others);
  assert.equal(others.length, 12);
  const headers = Array.from(doc.querySelectorAll(".dashboard-table-card [role=columnheader]"), (h) => h.textContent);
  assert.deepEqual(headers, ["Date (UTC+8)", "Type", "Model", "Tokens", "Requests"]);
});

test("a table without a Date (UTC) column, and a span outside any table, are left alone", () => {
  const { document: doc } = load().window;
  convertAll(doc, HK, NOW);
  const other = doc.querySelector("#other [role=cell] span");
  assert.equal(other.textContent, "Nov 5, 03:02 AM");
  assert.equal(other.title, "Nov 5, 2026, 03:02:49 AM UTC");
  assert.equal(doc.querySelector("#stray").textContent, "Nov 5, 03:02 AM");
  assert.equal(doc.querySelector("#other [role=columnheader]").getAttribute("aria-label"), "Day");
});

test("a converted table is never converted twice", () => {
  const { document: doc } = load().window;
  convertAll(doc, HK, NOW);
  const before = doc.body.innerHTML;
  assert.equal(convertAll(doc, HK, NOW), 0);
  assert.equal(convertAll(doc, HK, NOW), 0);
  assert.equal(doc.body.innerHTML, before);
});

test("a cell the page puts back to UTC is converted again, the others stay", () => {
  const { document: doc } = load().window;
  convertAll(doc, HK, NOW);
  const [first, second] = cells(doc);
  first.title = "Nov 5, 2026, 01:20:01 AM UTC"; // the page re-rendered this row with other data
  first.textContent = "Nov 5, 01:20 AM";
  assert.equal(convertAll(doc, HK, NOW), 1);
  assert.equal(first.textContent, "Nov 5, 09:20 AM");
  assert.equal(second.textContent, "Nov 5, 08:44 AM");
});

test("the text node is kept, because the page's framework holds a reference to it", () => {
  const { document: doc } = load().window;
  const [span] = cells(doc);
  const node = span.firstChild;
  convertAll(doc, HK, NOW);
  assert.equal(span.firstChild, node);
  assert.equal(node.nodeValue, "Nov 5, 11:02 AM");
});

test("in UTC itself there is nothing to change", () => {
  const { document: doc } = load().window;
  const before = doc.body.innerHTML;
  assert.equal(convertAll(doc, "UTC", NOW), 0);
  assert.equal(doc.body.innerHTML, before);
});

test("without the dashboard's table there is nothing to do", () => {
  const { document: doc } = new JSDOM("<p>hello</p><div role='table'><div role='row'></div></div>").window;
  assert.equal(convertAll(doc, HK, NOW), 0);
});

test("the observer converts rows that arrive later, and settles", async () => {
  const dom = load();
  const { document: doc } = dom.window;
  const observer = start({ doc, win: dom.window, timeZone: HK });
  try {
    assert.equal(cells(doc)[0].textContent, "Nov 5, 11:02 AM"); // the first pass is immediate

    let callbacks = 0;
    const counter = new dom.window.MutationObserver(() => callbacks++);
    counter.observe(doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
    const rows = doc.querySelector("#rows");
    rows.insertAdjacentHTML("beforeend",
      '<div role="row"><div role="cell"><span title="Nov 5, 2026, 05:00:00 AM UTC">Nov 5, 05:00 AM</span></div></div>');
    await wait(60);
    assert.equal(rows.lastElementChild.querySelector("span").textContent, "Nov 5, 01:00 PM");
    assert.ok(callbacks <= 3, `the observer kept running its own writes: ${callbacks} callbacks`);

    const quiet = callbacks;
    await wait(60);
    assert.equal(callbacks, quiet, "it settles");
  } finally {
    observer.disconnect();
  }
});

test("the observer follows a re-render of the header too", async () => {
  const dom = load();
  const { document: doc } = dom.window;
  const observer = start({ doc, win: dom.window, timeZone: HK });
  try {
    const header = doc.querySelector("[role=columnheader]");
    header.setAttribute("aria-label", "Date (UTC)");
    header.firstElementChild.textContent = "Date (UTC)";
    await wait(30);
    assert.equal(header.getAttribute("aria-label"), "Date (UTC+8)");
    assert.equal(header.textContent, "Date (UTC+8)");
  } finally {
    observer.disconnect();
  }
});
