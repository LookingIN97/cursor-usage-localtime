# cursor-usage-localtime

Chrome extension that shows the usage table on the Cursor dashboard
(`https://cursor.com/dashboard/usage`) in **your browser's time zone** instead of UTC.

在 Cursor 控制台的用量页里，把表格里的 UTC 时间改成浏览器当前时区显示。

```
Before                  After (browser in Hong Kong)
Date (UTC)              Date (UTC+8)
Nov 5, 03:02 AM         Nov 5, 11:02 AM
```

No permissions, no network access, nothing is sent anywhere. The whole extension is one small file.

## Install

1. Download this repo: **Code → Download ZIP** on GitHub, then unzip it (or `git clone` it).
2. In Chrome, open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and select the **`extension`** folder (the one that contains `manifest.json`).
4. Reload the usage page. The header now reads `Date (UTC+8)` (your own offset), and the times are local.

Use the Chrome profile you sign in to Cursor with: extensions are installed per profile.
Keep the folder where it is, Chrome reads the extension from it. Remove it any time from `chrome://extensions`.

### 安装

1. 在 GitHub 点 **Code → Download ZIP**，解压。
2. Chrome 打开 `chrome://extensions`，右上角打开「开发者模式」。
3. 点「加载已解压的扩展程序」，选择解压出来的 **`extension`** 文件夹（里面有 `manifest.json`）。
4. 刷新用量页，表头变成 `Date (UTC+8)`，时间即为本地时间。

请在登录 Cursor 的那个 Chrome 用户（profile）里安装；安装后不要移动或删除该文件夹。

## Good to know

This only changes how times are *displayed*; the server still works in UTC.

- The date filter (`?from=2026-11-05&to=2026-11-05`) selects a UTC day. In Hong Kong that is
  Nov 5 08:00 to Nov 6 08:00 local time.
- Daily totals and charts are still per UTC day. Only the usage table's date column is converted.
- Hover a date to see the full local time with seconds, e.g. `Nov 5, 2026, 11:02:49 AM GMT+8`.
- Daylight saving time is applied per row, by the row's own date. The header shows today's offset.

## How it works

The usage table is made of `div`s with ARIA roles; a date cell is

```html
<div role="cell"><span title="Nov 5, 2026, 03:02:49 AM UTC">Nov 5, 03:02 AM</span></div>
```

The `title` has the complete UTC time. The extension parses it (strictly: anything that does not match is ignored),
formats it with `Intl.DateTimeFormat` in the browser's zone, and rewrites the cell text and the title. A converted
title no longer ends in ` UTC`, so a cell is never converted twice. A `MutationObserver` converts again when the
page changes (new data, another page of rows, client-side navigation), before the browser paints, so UTC never
flashes. The existing text node is edited rather than replaced, which keeps the page's React happy. Only tables with
a `Date (UTC…)` column header are touched.

The dashboard's markup is not a public API. If Cursor changes it, the extension stops converting and leaves the
page as it is; `test/fixtures/usage-table.html` is where to start fixing it.

## Development

```
npm install
npm test        # node:test + jsdom, no browser needed
```

`extension/content.js` is the whole extension; under `node` it exports its functions for the tests.
On WSL, `scripts/sync-to-windows.sh` copies `extension/` to `%USERPROFILE%\chrome-extensions\cursor-usage-localtime`
so Chrome can load it from a Windows path; run it again after a change and press reload on `chrome://extensions`.

## License

MIT
