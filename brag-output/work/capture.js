// Usage: node capture.js stills 1.0 2.5 ...   -> stills/t_<t>.png
//        node capture.js frames <fps> <dur>   -> frames/f_00000.png ...
const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const CHROME = path.join(
  process.env.LOCALAPPDATA,
  "ms-playwright/chromium-1234/chrome-win64/chrome.exe",
);

(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("file://" + path.join(__dirname, "video.html").replace(/\\/g, "/"));
  await page.evaluate(() => window.ready);

  const shoot = async (t, file) => {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: file, type: "png" });
  };

  if (mode === "stills") {
    fs.mkdirSync(path.join(__dirname, "stills"), { recursive: true });
    for (const s of args)
      await shoot(Number(s), path.join(__dirname, "stills", `t_${s}.png`));
  } else {
    const fps = Number(args[0]),
      dur = Number(args[1]);
    const dir = path.join(__dirname, "frames");
    fs.mkdirSync(dir, { recursive: true });
    const n = Math.round(fps * dur);
    for (let i = 0; i < n; i++) {
      await shoot(i / fps, path.join(dir, `f_${String(i).padStart(5, "0")}.png`));
      if (i % 60 === 0) console.log(`frame ${i}/${n}`);
    }
  }
  await browser.close();
})();
