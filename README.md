# cursor-usage-localtime

Chrome extension: shows the usage table on the Cursor dashboard (`cursor.com/dashboard/usage`) in your
browser's time zone instead of UTC.

在 Cursor 控制台的用量页里，把表格里的 UTC 时间改成浏览器当前时区显示。

```
Date (UTC)         →   Date (UTC+8)
Nov 5, 03:02 AM        Nov 5, 11:02 AM
```

## Install / 安装

1. Download this repo (**Code → Download ZIP**) and unzip it. / 下载 ZIP 并解压。
2. Open `chrome://extensions` and turn on **Developer mode**. / 打开「开发者模式」。
3. **Load unpacked**, select the `extension` folder. / 点「加载已解压的扩展程序」，选 `extension` 文件夹。
4. Reload the usage page. / 刷新用量页。

## Notes

- Only the display changes. The date filter and the daily totals are still by UTC day.
- No permissions, no network access. The whole thing is `extension/content.js`.

MIT License
