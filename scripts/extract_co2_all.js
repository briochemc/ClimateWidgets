import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SRC = "data/continuous_emissions_timeseries_1750_2500.csv";
const OUT = "docs/data/co2_all.json";
const YEAR_MIN = 1900;
const YEAR_MAX = 2150;

// Short code → CSV scenario string (from cmip7-scenariomip/scripts/plotting.py).
const SCENARIO_MAP = {
  VL: "SSP1 - Very Low Emissions",
  LN: "SSP2 - Low Overshoot_a",
  L:  "SSP2 - Low Emissions",
  ML: "SSP2 - Medium-Low Emissions",
  M:  "SSP2 - Medium Emissions",
  H:  "SSP3 - High Emissions",
  HL: "SSP5 - Medium-Low Emissions_a",
};
const VARIABLES = new Set([
  "Emissions|CO2|Energy and Industrial Processes",
  "Emissions|CO2|AFOLU",
]);

function parseCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && inQ) { cur += '"'; i++; }
    else if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const text = readFileSync(SRC, "utf8");
const [headerLine, ...rows] = text.split("\n").filter(Boolean);
const header = parseCsvLine(headerLine);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const yearCols = header
  .map((h, i) => ({ h, i }))
  .filter(({ h }) => /^\d+(\.\d+)?$/.test(h))
  .map(({ h, i }) => ({ year: Math.round(Number(h)), i }))
  .filter(({ year }) => year >= YEAR_MIN && year <= YEAR_MAX);

const scenarioLookup = new Map(
  Object.entries(SCENARIO_MAP).map(([code, csvName]) => [csvName, code]),
);
const sums = new Map(Object.keys(SCENARIO_MAP).map(code => [code, new Map()]));
const matchCount = new Map(Object.keys(SCENARIO_MAP).map(code => [code, 0]));

for (const line of rows) {
  const cols = parseCsvLine(line);
  const code = scenarioLookup.get(cols[idx.scenario]);
  if (!code) continue;
  if (!VARIABLES.has(cols[idx.variable])) continue;
  matchCount.set(code, matchCount.get(code) + 1);
  const bucket = sums.get(code);
  for (const { year, i } of yearCols) {
    const v = Number(cols[i]);
    if (!Number.isFinite(v)) continue;
    bucket.set(year, (bucket.get(year) ?? 0) + v);
  }
}

const result = {};
for (const code of Object.keys(SCENARIO_MAP)) {
  const bucket = sums.get(code);
  result[code] = [...bucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, mt]) => ({ year, gt: mt / 1000 }));
}

mkdirSync(dirname(resolve(OUT)), { recursive: true });
writeFileSync(OUT, JSON.stringify(result));
console.log(`Wrote ${OUT}`);
for (const code of Object.keys(SCENARIO_MAP)) {
  const s = result[code];
  const n = matchCount.get(code);
  console.log(`  ${code} (${n} rows): ${s.length} pts, ${s[0].year}=${s[0].gt.toFixed(2)} → ${s.at(-1).year}=${s.at(-1).gt.toFixed(2)} Gt`);
}
