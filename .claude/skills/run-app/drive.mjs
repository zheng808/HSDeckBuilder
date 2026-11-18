#!/usr/bin/env node
/**
 * Headless-Chrome UI smoke drive for the deck builder. No dependencies: talks the
 * DevTools protocol over Node's built-in WebSocket.
 *
 *   DECK_ID=<published deck id> node .claude/skills/run-app/drive.mjs
 *
 * Env: CHROME (binary path), BASE_URL (default http://localhost:5173),
 *      OUT_DIR (screenshots, default /tmp/hs-deck-builder-shots), DECK_ID (optional).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = process.env.OUT_DIR ?? '/tmp/hs-deck-builder-shots';
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${OUT}/chrome-profile`,
    '--window-size=1400,900',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let nextId = 0;
const pending = new Map();
const events = [];

async function waitForChrome() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const page = (await res.json()).find((t) => t.type === 'page');
        if (page) return page;
      }
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not expose a page target');
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect(page) {
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  }
  return r.result.value;
}

async function waitFor(expr, label = expr, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(`Boolean(${expr})`)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
const waitForText = (text) =>
  waitFor(
    `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
    `text "${text}"`,
  );
const waitForSelector = (sel) =>
  waitFor(`document.querySelector(${JSON.stringify(sel)})`, `selector ${sel}`);

async function nav(path) {
  await send('Page.navigate', { url: BASE + path });
  await waitFor(`document.readyState === 'complete'`, 'load');
}

async function clickButtonWithText(text, within = 'body') {
  const ok = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(within)});
    const el = root && [...root.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
  if (!ok) throw new Error(`No button with text "${text}" inside ${within}`);
}

async function clickNth(selector, index) {
  const ok = await evaluate(`(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
  if (!ok) throw new Error(`No element ${selector}[${index}]`);
}

/** Sets a React-controlled input's value so onChange fires. */
async function fill(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
}

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`screenshot ${file}`);
}

function consoleErrors() {
  return events
    .filter(
      (e) =>
        e.method === 'Runtime.exceptionThrown' ||
        (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'),
    )
    .map((e) =>
      e.method === 'Runtime.exceptionThrown'
        ? (e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text)
        : e.params.args.map((a) => a.value ?? a.description).join(' '),
    );
}

try {
  await connect(await waitForChrome());

  await nav('/');
  await waitForSelector('section[aria-label="Browse published decks"]');
  await sleep(1200);
  await screenshot('01-home');

  await nav('/build');
  await waitForSelector('[aria-label="Choose a class"]');
  await screenshot('02-class-picker');
  await clickButtonWithText('Mage', '[aria-label="Choose a class"]');
  await clickButtonWithText('Start building');
  await waitForSelector('ul[aria-label="Card results"] li button');
  await sleep(2500); // let card art load
  await screenshot('03-builder-mage');

  for (let i = 0; i < 4; i++) await clickNth('ul[aria-label="Card results"] li button', i);
  await waitForText('4/30 cards');
  await fill('#deck-name', 'Headless Mage');
  await clickButtonWithText('Save draft', 'aside[aria-label="Your deck"]');
  await waitForText('Deck saved.');
  await waitFor(`/\\/build\\/[A-Za-z0-9_-]+$/.test(location.pathname)`, 'navigation to /build/:id');
  await sleep(600);
  await screenshot('04-builder-saved');
  console.log('saved draft at', await evaluate('location.pathname'));

  if (process.env.DECK_ID) {
    await nav(`/decks/${process.env.DECK_ID}`);
    await waitForText('Copy deck code');
    await sleep(2000);
    await screenshot('05-deck-page');
  }

  await nav('/my');
  await waitForText('Headless Mage');
  await sleep(500);
  await screenshot('06-my-decks');

  // Pro lists → pro deck page → remix in builder with Compare → save → remix page shows the diff.
  await nav('/');
  await waitForSelector('section[aria-label="Browse published decks"]');
  await clickButtonWithText('Pro lists');
  await waitForText('Masters Tour');
  await sleep(800);
  await screenshot('07-pro-lists');
  const proHref = await evaluate(`(() => {
    const a = document.querySelector('section[aria-label="Browse published decks"] a[href^="/decks/"]');
    return a ? a.getAttribute('href') : null; })()`);
  if (!proHref)
    throw new Error('No pro deck link on the Pro lists tab (run npm run import:pro-decks)');
  await nav(proHref);
  await waitForText('Played by');
  await sleep(1500);
  await screenshot('08-pro-deck-page');
  await clickButtonWithText('Open in builder');
  await waitFor(`location.pathname === '/build'`, 'builder route');
  await waitForSelector('aside[aria-label="Your deck"]');
  await waitForText('Based on');
  await clickButtonWithText('Compare', 'aside[aria-label="Your deck"]');
  await clickNth('aside[aria-label="Your deck"] button[aria-label^="Remove one"]', 0);
  await waitForText('card changed');
  await sleep(400);
  await screenshot('09-remix-compare');
  await fill('#deck-name', 'Headless Remix');
  await clickButtonWithText('Save draft', 'aside[aria-label="Your deck"]');
  await waitForText('Deck saved.');
  await waitFor(`/\\/build\\/[A-Za-z0-9_-]+$/.test(location.pathname)`, 'navigation to /build/:id');
  const remixId = (await evaluate('location.pathname')).split('/').pop();
  await nav(`/decks/${remixId}`);
  await waitForText('Based on');
  await sleep(1200);
  await screenshot('10-remix-deck-page');
  console.log('remix saved as', remixId);

  const errors = consoleErrors();
  console.log('console errors:', errors.length ? errors : 'none');
  if (errors.length) process.exitCode = 1;
} catch (err) {
  console.error('DRIVE FAILED:', err.message);
  try {
    await screenshot('99-failure');
  } catch {}
  process.exitCode = 1;
} finally {
  chrome.kill();
}
