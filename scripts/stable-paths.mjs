// Runs after `observable build` (see the build script in package.json) and gives every
// widget module and data file a stable, unhashed URL under dist/lib/, mirroring src/:
//
//   dist/_import/co2-latitude/widget.11dc718e.js   -> dist/lib/co2-latitude/widget.js
//   dist/_file/co2-latitude/data/x.2516c915.json   -> dist/lib/co2-latitude/data/x.json
//
// The script-tag embed snippets (src/components/embed-snippet.js) point at these. Framework
// fingerprints everything it builds, so the real paths change whenever a file changes and
// cannot be pasted into somebody else's page; and the raw source in the repo cannot be
// loaded by a browser either, since its `npm:` imports only mean something to the build.
//
// Modules are one-line re-exports of the hashed module, which keeps a single copy of the
// code and lets the hashed module's own relative imports (../../_npm/..., ../other/widget)
// resolve as they do on the site's pages. Data files are copied, since fetch() cannot
// follow a re-export. Thumbnails are not data and are skipped.

import {copyFileSync, mkdirSync, readdirSync, writeFileSync} from "node:fs";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const DIST = join(ROOT, "dist");
const LIB = join(DIST, "lib");
const HASH = /\.[0-9a-f]{8}(\.[a-z0-9]+)$/i;

function* walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

function unhash(path) {
  if (!HASH.test(path)) throw new Error(`no fingerprint in ${path}`);
  return path.replace(HASH, "$1");
}

let modules = 0, files = 0;

for (const hashed of walk(join(DIST, "_import"))) {
  const rel = relative(join(DIST, "_import"), hashed);
  if (rel.startsWith("components/")) continue; // site chrome, not a widget
  const out = join(LIB, unhash(rel));
  mkdirSync(dirname(out), {recursive: true});
  const target = relative(dirname(out), hashed).split("\\").join("/");
  writeFileSync(out, `export * from "./${target}";\n`);
  modules++;
}

for (const hashed of walk(join(DIST, "_file"))) {
  const rel = relative(join(DIST, "_file"), hashed);
  if (rel.startsWith("assets/")) continue;
  const out = join(LIB, unhash(rel));
  mkdirSync(dirname(out), {recursive: true});
  copyFileSync(hashed, out);
  files++;
}

console.log(`stable-paths: ${modules} modules re-exported and ${files} data files copied to dist/lib/`);
