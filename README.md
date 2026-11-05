# cursor-usage-localtime

A tiny Chrome (Manifest V3) extension that shows the usage table on the Cursor dashboard
(`https://cursor.com/dashboard/usage`) in your browser's time zone instead of UTC.

在 Cursor 控制台的用量页里，把表格里的 UTC 时间改成浏览器当前时区显示。

```
Before                          After (browser in Hong Kong)
Date (UTC)                      Date (UTC+8)
Nov 5, 03:02 AM                 Nov 5, 11:02 AM
```

- The date column of the usage table is replaced in place: local time only, same look as the page.
- The tooltip on a date shows the full local time with seconds and the zone, e.g. `Nov 5, 2026, 11:02:49 AM GMT+8`.
- The column header says how far your zone is from UTC: `Date (UTC+8)`.
- Nothing else on the page is touched, no permissions are requested, nothing is sent anywhere
  (the extension has no network code at all; the whole thing is one small file, `extension/content.js`).

## Install

Chrome has no store listing for this, so load it unpacked, in the Chrome profile that can open the dashboard:

1. Get the `extension/` folder somewhere on disk (clone this repo, or download it as a zip).
   On WSL, `scripts/sync-to-windows.sh` copies it to `%USERPROFILE%\chrome-extensions\cursor-usage-localtime`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. **Load unpacked**, pick the folder that contains `manifest.json`.
4. Reload the usage page.

After changing the code, press the reload button of the extension on `chrome://extensions`.

## What it can and cannot do

It changes how times are *displayed*. The server still works in UTC, so:

- The date filter (`?from=2026-11-05&to=2026-11-05`) selects UTC days. In Hong Kong, "Nov 5" in the URL
  is Nov 5 08:00 to Nov 6 08:00 local time.
- Daily totals and charts are summed per UTC day.
- Only the usage table's date column is converted; other tables and charts keep UTC.

Daylight saving time is handled per row: a row from July shows July's offset, a row from November shows
November's, whatever today's offset is. The header shows the offset as of now.

## How it works

The usage table is made of `div`s with ARIA roles. The header is `role="columnheader" aria-label="Date (UTC)"`, and a
date cell is

```html
<div role="cell"><span title="Nov 5, 2026, 03:02:49 AM UTC">Nov 5, 03:02 AM</span></div>
```

The `title` holds the complete UTC time, so the extension parses it (exactly; anything that does not match
is ignored), formats it with `Intl.DateTimeFormat` in the browser's zone, and writes the cell text and the title back.
A converted title no longer ends in ` UTC`, which is what makes the conversion idempotent. A
`MutationObserver` converts again whenever the page changes: new data, another page of rows, a client-side navigation.

Details that matter on a React page: the existing text node is edited, not replaced; the observer runs inside the
mutation callback, before the browser paints, so UTC never flashes; and only tables that have a `Date (UTC…)`
column header are touched, so the rest of the site is not affected.

The dashboard's markup is not a public API. If Cursor changes it, the extension simply stops converting (it does
nothing to anything it does not recognize), and `test/fixtures/usage-table.html` is where to start fixing it.

## Development

```
npm install
npm test            # node:test + jsdom, no browser needed
```

- `extension/content.js` is the whole extension; in Chrome it runs, under `node` it exports its functions for the tests.
- `test/core.test.js`: parsing and formatting, including midnight, New Year, half-hour zones and daylight saving time.
- `test/dom.test.js`: the real table structure (`test/fixtures/usage-table.html`, invented values), idempotency,
  untouched neighbours, and the observer.

## License

MIT
