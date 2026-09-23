// Renders each widget's embed page in headless Chrome and writes the homepage card
// thumbnails to src/assets/thumbnails/. Uses playwright-core, which Observable Framework
// already installs, to drive the Google Chrome on this machine.
//
// The PNGs it writes are committed, and the homepage crops them to the card's aspect ratio
// in CSS. This is a manual tool, not part of the build: run `npm run build && npm run
// thumbnails` when a widget's appearance changes, then commit the updated images.
//
// It serves dist/, so the site must be built first, with the default base "/". Pages are
// requested by their built filename (embed.html): the static server does no extensionless
// URL rewriting.
//
// Why playwright rather than Chrome's own --screenshot flag, which this script once used:
// that flag races the widget's first paint (a blank PNG needed retries), clamps the window
// to a minimum width on macOS, and silently hands the URL to an already-open desktop Chrome
// and exits with nothing. Playwright launches its own instance on a throwaway profile,
// waits for the figure element to exist, and only then captures the frame.
//
// Determinism: the context asks for reduced motion, so the widgets skip their self-playing
// tours (they already check for it) and every capture is the same canonical initial frame.
//
// A page that renders no figure — or shows the SST widget's data-unavailable notice —
// keeps the committed thumbnail instead of overwriting it with a broken image; that only
// warns, but a missing thumbnail at the end fails the script, since the homepage build
// would then reference a file that does not exist.

import {createServer} from "node:http";
import {createReadStream, existsSync, renameSync, statSync, unlinkSync} from "node:fs";
import {mkdir} from "node:fs/promises";
import {extname, join, normalize, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "src/assets/thumbnails");
const PORT = Number(process.env.THUMBNAIL_PORT ?? 8123);

// Captured square at the widgets' own 640 px cap, so the PNGs are already card-shaped and
// the homepage does not have to crop them. Anything past 640 px of height is simply out of
// frame: for the tall widgets that trims the bottom of the figure, which a thumbnail does
// not need. Rendered at 2x for sharp cards on high-density screens.
const SIZE = 640;
const SCALE = 2;

// The three plotting widgets render a canvas; the rest are hand-built SVG that carries the
// widget's name as a class. Either marker is set by the widget itself, so a page whose
// module failed to load has neither. `mustNot` is text whose presence means the widget
// gave up and drew its error notice instead of a figure.
const WIDGETS = [
  {name: "draw-the-future", figure: "canvas"},
  {name: "temperature-trend", figure: "canvas"},
  {name: "sst-daily", figure: "canvas", mustNot: "Could not load the daily sea surface temperature"},
  {name: "vlasceanu-etal-2024"},
  {name: "andre-etal-2024"},
  {name: "leiserowitz-etal-2026"},
  {name: "hickman-etal-2021"},
  {name: "consensus-studies"},
  {name: "leviston-etal-2013"},
  {name: "probability-words"},
  {name: "blackbody-radiation"},
  // Zoomed in one level: argon, the first carbon dioxide, and the strip of oxygen's big
  // squares around them say more than the first grid's plain nitrogen and oxygen.
  {name: "atmospheric-composition", query: "?level=2"},
  {name: "atmospheric-transmission"},
].map(w => ({figure: `.${w.name}`, ...w}));

// A blank 640x640 capture comes out near 7 kB, a real one 150 kB and up. Playwright waits
// for the figure before shooting, so this should never trip; it is kept as a last guard
// against overwriting a good image with an empty one.
const MIN_BYTES = 20000;

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".csv": "text/csv", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".wasm": "application/wasm", ".arrow": "application/octet-stream", ".parquet": "application/octet-stream",
};

function serveDist() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(DIST, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {"content-type": TYPES[extname(file)] ?? "application/octet-stream"});
    createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(PORT, "127.0.0.1", () => ok(server));
  });
}

// `query` is appended to the embed page's URL, for widgets whose opening frame is not
// their best one; the server ignores it and the page reads it.
async function shoot(page, {name, figure, mustNot, query = ""}) {
  const url = `http://127.0.0.1:${PORT}/${name}/embed.html${query}`;
  try {
    await page.goto(url, {waitUntil: "load"});
    await page.waitForSelector(figure, {timeout: 30000});
  } catch {
    console.warn(`WARN: ${name} rendered no figure — keeping the existing thumbnail`);
    return;
  }
  // The figure exists; give data fetches and web fonts a moment to settle so the frame is
  // the finished one, not the first paint.
  await page.waitForLoadState("networkidle", {timeout: 15000}).catch(() => {});
  await page.waitForTimeout(300);

  if (mustNot && (await page.getByText(mustNot).count()) > 0) {
    console.warn(`WARN: ${name} shows its error notice — keeping the existing thumbnail`);
    return;
  }

  // Shoot to a temporary file and only then replace the committed thumbnail, so a bad
  // capture costs a warning rather than a good image.
  const tmp = join(OUT, `.${name}.tmp.png`);
  await page.screenshot({path: tmp, clip: {x: 0, y: 0, width: SIZE, height: SIZE}});
  if (statSync(tmp).size < MIN_BYTES) {
    unlinkSync(tmp);
    console.warn(`WARN: ${name} captured blank — keeping the existing thumbnail`);
    return;
  }
  renameSync(tmp, join(OUT, `${name}.png`));
  console.log(`wrote src/assets/thumbnails/${name}.png`);
}

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/ is not built — run npm run build first");
  process.exit(1);
}
await mkdir(OUT, {recursive: true});

const server = await serveDist();
// "chrome" is the Google Chrome installed on the machine; nothing is downloaded.
const browser = await chromium.launch({channel: "chrome", headless: true});
try {
  const context = await browser.newContext({
    viewport: {width: SIZE, height: SIZE},
    deviceScaleFactor: SCALE,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  for (const widget of WIDGETS) await shoot(page, widget);
} finally {
  await browser.close();
  server.close();
}

let status = 0;
for (const {name} of WIDGETS) {
  if (!existsSync(join(OUT, `${name}.png`))) {
    console.error(`ERROR: src/assets/thumbnails/${name}.png does not exist and could not be generated`);
    status = 1;
  }
}
process.exit(status);
