"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseUtcTitle, formatCell, formatTitle, offsetLabel } = require("../extension/content.js");

const HK = "Asia/Hong_Kong";
const LA = "America/Los_Angeles";
const ms = (iso) => Date.parse(iso);

test("parses the dashboard's UTC title", () => {
  assert.equal(parseUtcTitle("Nov 5, 2026, 03:02:49 AM UTC"), ms("2026-11-05T03:02:49Z"));
  assert.equal(parseUtcTitle("Nov 4, 2026, 11:59:59 PM UTC"), ms("2026-11-04T23:59:59Z"));
});

test("12 AM is the first hour of the day and 12 PM is noon", () => {
  assert.equal(parseUtcTitle("Nov 5, 2026, 12:05:00 AM UTC"), ms("2026-11-05T00:05:00Z"));
  assert.equal(parseUtcTitle("Nov 5, 2026, 12:05:00 PM UTC"), ms("2026-11-05T12:05:00Z"));
  assert.equal(parseUtcTitle("Nov 5, 2026, 1:00:00 PM UTC"), ms("2026-11-05T13:00:00Z"));
});

test("accepts the narrow no-break space some engines put before AM/PM", () => {
  assert.equal(parseUtcTitle("Nov 5, 2026, 03:02:49\u202fAM UTC"), ms("2026-11-05T03:02:49Z"));
});

test("rejects anything that is not exactly a UTC title", () => {
  for (const text of [
    "", "Nov 5, 03:02 AM", "Nov 5, 2026, 03:02:49 AM", "Nov 5, 2026, 03:02:49 AM GMT+8", "Nov 5, 2026, 03:02:49 AM PST",
    "Nov 5, 2026, 13:02:49 AM UTC", "Nov 5, 2026, 00:02:49 AM UTC", "Nov 5, 2026, 03:60:49 AM UTC", "Foo 5, 2026, 03:02:49 AM UTC",
    "Feb 31, 2026, 03:02:49 AM UTC", "Included", "Nov 5, 2026, 03:02:49 AM UTC and more",
  ]) {
    assert.equal(parseUtcTitle(text), null, text);
  }
});

test("cell text keeps the page's look, in the given zone", () => {
  assert.equal(formatCell(ms("2026-11-05T03:02:49Z"), HK), "Nov 5, 11:02 AM");
  assert.equal(formatCell(ms("2026-11-05T03:02:49Z"), "UTC"), "Nov 5, 03:02 AM");
  assert.equal(formatCell(ms("2026-11-05T03:02:49Z"), LA), "Nov 4, 07:02 PM");
});

test("the date follows the zone across midnight and across New Year", () => {
  assert.equal(formatCell(ms("2026-11-04T23:59:59Z"), HK), "Nov 5, 07:59 AM");
  assert.equal(formatCell(ms("2026-12-31T20:00:00Z"), HK), "Jan 1, 04:00 AM");
  assert.equal(formatCell(ms("2027-01-01T03:00:00Z"), LA), "Dec 31, 07:00 PM");
});

test("midnight and noon read 12:xx", () => {
  assert.equal(formatCell(ms("2026-11-04T16:05:00Z"), HK), "Nov 5, 12:05 AM");
  assert.equal(formatCell(ms("2026-11-05T04:05:00Z"), HK), "Nov 5, 12:05 PM");
});

test("half-hour and quarter-hour zones", () => {
  assert.equal(formatCell(ms("2026-11-05T03:02:49Z"), "Asia/Kolkata"), "Nov 5, 08:32 AM");
  assert.equal(formatCell(ms("2026-11-05T03:02:49Z"), "Pacific/Chatham"), "Nov 5, 04:47 PM");
});

test("daylight saving time follows the date of each row, not today's", () => {
  assert.equal(formatCell(ms("2026-07-05T03:02:49Z"), LA), "Jul 4, 08:02 PM"); // PDT, UTC-7
  assert.equal(formatCell(ms("2026-11-05T03:02:49Z"), LA), "Nov 4, 07:02 PM"); // PST, UTC-8
});

test("the tooltip is the full local time with the zone's name", () => {
  assert.equal(formatTitle(ms("2026-11-05T03:02:49Z"), HK), "Nov 5, 2026, 11:02:49 AM GMT+8");
  assert.equal(formatTitle(ms("2026-07-05T03:02:49Z"), LA), "Jul 4, 2026, 08:02:49 PM PDT");
  assert.equal(formatTitle(ms("2026-11-05T03:02:49Z"), LA), "Nov 4, 2026, 07:02:49 PM PST");
});

test("the tooltip does not parse as a UTC title again, except in UTC itself", () => {
  const t = ms("2026-11-05T03:02:49Z");
  assert.equal(parseUtcTitle(formatTitle(t, HK)), null);
  assert.equal(parseUtcTitle(formatTitle(t, LA)), null);
  assert.equal(parseUtcTitle(formatTitle(t, "UTC")), t); // converting is then a no-op: same text, same title
});

test("the header says how far the zone is from UTC", () => {
  const t = ms("2026-11-05T03:02:49Z");
  assert.equal(offsetLabel(t, HK), "UTC+8");
  assert.equal(offsetLabel(t, LA), "UTC-8");
  assert.equal(offsetLabel(ms("2026-07-05T03:02:49Z"), LA), "UTC-7");
  assert.equal(offsetLabel(t, "Asia/Kolkata"), "UTC+5:30");
  assert.equal(offsetLabel(t, "Pacific/Chatham"), "UTC+13:45");
  assert.equal(offsetLabel(t, "UTC"), "UTC");
});

test("no output contains a no-break space", () => {
  const t = ms("2026-11-05T03:02:49Z");
  for (const text of [formatCell(t, HK), formatTitle(t, HK), formatCell(t, LA), formatTitle(t, LA)]) {
    assert.doesNotMatch(text, /[\u202f\u00a0]/);
  }
});
