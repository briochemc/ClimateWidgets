// Builds src/co2-per-capita/data/co2-per-capita.json: every country's CO₂ emissions (fossil
// fuels, cement and land-use change together, as in the carbon-budget widget) and population
// for every year since 1850, plus which of seven groups it belongs to. Run it by hand from
// the repo root when the data should be refreshed (`node scripts/co2-per-capita.mjs`); it is
// never run by the site. Node 18 or later, no dependencies. `--cache <dir>` keeps the two
// downloads (the OWID file is 14 MB) for the next run.
//
// Sources: Our World in Data's CO₂ dataset (https://github.com/owid/co2-data, CC BY 4.0),
// which carries the Global Carbon Budget's national emissions and OWID's population series
// (HYDE and the UN); and the ISO 3166 regional codes table (lukes/ISO-3166-Countries-with-
// Regional-Codes, the UN M49 regions), from which the groups are made.
//
// Output: `years` (1850 to the last year), and `countries`, each with `pop` (millions) and
// `co2` (MtCO₂), one value per year, null where there is none, both to three figures.

import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/co2-per-capita/data/co2-per-capita.json");
const OWID = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv";
const ISO = "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv";
const FIRST_YEAR = 1850;

// The seven groups. The Middle East is the UN's Western Asia less the Caucasus and Cyprus
// (which go with Europe), plus Iran; Australia and New Zealand, and Russia, are their own.
const GROUPS = [
  {id: "americas", name: "Americas"},
  {id: "europe", name: "Europe"},
  {id: "russia", name: "Russia"},
  {id: "mideast", name: "Middle East"},
  {id: "asia", name: "Asia and Oceania"},
  {id: "australia", name: "Australia and New Zealand"},
  {id: "africa", name: "Africa"},
];
const TO_EUROPE = new Set(["ARM", "AZE", "GEO", "CYP"]);
function groupOf(iso, region, subRegion) {
  if (iso === "RUS") return "russia";
  if (iso === "AUS" || iso === "NZL") return "australia";
  if (iso === "IRN") return "mideast";
  if (iso === "TWN") return "asia";   // the ISO table leaves Taiwan's region blank
  if (TO_EUROPE.has(iso)) return "europe";
  if (subRegion === "Western Asia") return "mideast";
  if (region === "Americas") return "americas";
  if (region === "Europe") return "europe";
  if (region === "Africa") return "africa";
  if (region === "Asia" || region === "Oceania") return "asia";
  return null;
}

// ---- fetching ---------------------------------------------------------------------------

const cacheDir = (() => {
  const i = process.argv.indexOf("--cache");
  return i >= 0 ? process.argv[i + 1] : null;
})();

async function fetchText(url) {
  const key = cacheDir && join(cacheDir, url.replace(/[^\w.-]+/g, "_").slice(-150));
  if (key && existsSync(key)) return readFileSync(key, "utf8");
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  if (key) { mkdirSync(cacheDir, {recursive: true}); writeFileSync(key, text); }
  return text;
}

// A CSV parser that copes with quoted fields (country names with commas).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const sig3 = v => Number(Number(v).toPrecision(3));

// ---- main -------------------------------------------------------------------------------

const iso = parseCsv(await fetchText(ISO));
const isoHead = iso[0];
const isoCol = name => isoHead.indexOf(name);
const regionByIso = new Map();
for (const r of iso.slice(1)) {
  if (!r[isoCol("alpha-3")]) continue;
  regionByIso.set(r[isoCol("alpha-3")], {region: r[isoCol("region")], subRegion: r[isoCol("sub-region")]});
}

const owid = parseCsv(await fetchText(OWID));
const head = owid[0];
const col = name => {
  const i = head.indexOf(name);
  if (i < 0) throw new Error(`OWID file has no column ${name}`);
  return i;
};
const C = {country: col("country"), year: col("year"), iso: col("iso_code"), pop: col("population"),
  co2: col("co2"), luc: col("land_use_change_co2"), total: col("co2_including_luc")};

let lastYear = FIRST_YEAR;
const byIso = new Map();
const missingGroup = new Set();
for (const r of owid.slice(1)) {
  const code = r[C.iso];
  // Aggregates have no ISO code or an OWID_ one; Kosovo's OWID_KOS is the one worth keeping.
  if (!code || (code.startsWith("OWID_") && code !== "OWID_KOS")) continue;
  const year = Number(r[C.year]);
  if (!(year >= FIRST_YEAR)) continue;
  const pop = Number(r[C.pop]);
  const total = r[C.total] !== "" ? Number(r[C.total]) : (r[C.co2] !== "" ? Number(r[C.co2]) + (Number(r[C.luc]) || 0) : NaN);
  if (!(pop > 0) || !Number.isFinite(total)) continue;
  const key = code === "OWID_KOS" ? "XKX" : code;
  if (!byIso.has(key)) {
    const reg = regionByIso.get(key) ?? (key === "XKX" ? {region: "Europe", subRegion: "Southern Europe"} : null);
    const group = reg ? groupOf(key, reg.region, reg.subRegion) : null;
    if (!group) { missingGroup.add(`${key} ${r[C.country]}`); continue; }
    byIso.set(key, {code: key, name: r[C.country], group, rows: new Map()});
  }
  byIso.get(key).rows.set(year, [pop, total]);
  if (year > lastYear) lastYear = year;
}
if (missingGroup.size) process.stderr.write(`no group, dropped: ${[...missingGroup].join(", ")}\n`);

const years = [];
for (let y = FIRST_YEAR; y <= lastYear; y++) years.push(y);
const countries = [...byIso.values()]
  .map(c => ({
    code: c.code, name: c.name, group: c.group,
    pop: years.map(y => c.rows.has(y) ? sig3(c.rows.get(y)[0] / 1e6) : null),
    co2: years.map(y => c.rows.has(y) ? sig3(c.rows.get(y)[1]) : null),
  }))
  .filter(c => c.pop.some(v => v !== null))
  .sort((a, b) => a.name.localeCompare(b.name));

const data = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    source: "Our World in Data, CO₂ and Greenhouse Gas Emissions dataset (Global Carbon Budget national emissions; OWID population from HYDE and the UN), https://github.com/owid/co2-data, CC BY 4.0",
    regions: "UN M49 regions via lukes/ISO-3166-Countries-with-Regional-Codes",
    units: {pop: "millions", co2: "MtCO2, fossil fuels and cement plus land-use change"},
  },
  years,
  groups: GROUPS,
  countries,
};
mkdirSync(dirname(OUT), {recursive: true});
const json = JSON.stringify(data);
writeFileSync(OUT, json);
const withData = y => countries.filter(c => c.pop[y - FIRST_YEAR] !== null).length;
process.stderr.write(`wrote ${OUT} (${Math.round(json.length / 1024)} kB): ${countries.length} countries, ${FIRST_YEAR}–${lastYear}; ` +
  `with data in 1850: ${withData(1850)}, 1950: ${withData(1950)}, ${lastYear}: ${withData(lastYear)}\n`);
for (const g of GROUPS) process.stderr.write(`  ${g.name}: ${countries.filter(c => c.group === g.id).map(c => c.code).join(" ")}\n`);
