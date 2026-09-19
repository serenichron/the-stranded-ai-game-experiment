import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage();
p.on('console', (m) => { if (m.text().startsWith('[sdf]')) console.log(m.text()); });
await p.addInitScript(() => { globalThis.__sdfLog = true; });
await p.goto('http://localhost:5190/src/world/models/dev/chars.html?still&set=npcs', { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await b.close();
