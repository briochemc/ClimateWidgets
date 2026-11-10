// Builds src/nem-generation/data/nem-generation.json: electricity generation by fuel technology
// in Australia's National Electricity Market (the NEM as a whole and each of its five regions)
// and in Western Australia's SWIS (the WEM), from Open Electricity (The Superpower Institute,
// formerly OpenNEM), CC BY-NC 4.0, https://platform.openelectricity.org.au/license. Run it by
// hand from the repo root (`node scripts/nem-generation.mjs`) or let the monthly GitHub Action
// (.github/workflows/refresh-nem-generation.yml) do it; the site never runs it. Node 18 or
// later, no npm dependencies. `--cache <dir>` keeps the downloads for the next run.
//
// Two sources, both public and both current:
//
//  - Monthly history, December 1998 to the last complete month, from Open Electricity's
//    static v4 files, data.openelectricity.org.au/v4/stats/au/NEM/energy/all.json and the
//    same for each region (NEM/NSW1/...) and for WEM. These are regenerated daily (the
//    `created_at` field says when) and carry every fuel technology's energy in GWh per month,
//    with emissions and market value alongside, which are not used here. Their v3 ancestor
//    stopped in November 2024; the v4 ones are the files Open Electricity's own site reads.
//  - The last 52 weeks, week by week, from the Open Electricity API v4
//    (api.openelectricity.org.au/v4/data/network/NEM?metrics=energy&interval=7d...), which
//    anonymous "community" access answers for the last two years, one call per network with
//    the regions as a grouping. An Academic or other key in OPENELECTRICITY_API_KEY is sent
//    if present but is not needed. The API's weeks start on Sunday; the running week is dropped.
//
// Fuel technologies are kept as Open Electricity names them, with its colours, in its stacking
// order (loads first, then sources from the bottom of the stack up), and each is tagged as a
// source, a load (pumping, battery charging, exports: energy drawn from the grid, which the
// widget draws below zero and leaves out of the shares) or imports (a source for the region but
// not generation, so also left out of the shares), and as renewable or not. The widget's
// "simple" grouping (coal, gas, hydro, wind, solar, batteries, other) is in `group`.
//
// Output: `fuelTechs` (the table above), and `regions`, each with `monthly` ({start: "YYYY-MM",
// values: {fuelTech: [GWh per month, null before the record begins]}}) and `weekly` ({start:
// "YYYY-MM-DD" of the first week's Sunday, values: {fuelTech: [GWh per week]}}).

import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/nem-generation/data/nem-generation.json");

const STATS = "https://data.openelectricity.org.au/v4/stats/au";
const API = "https://api.openelectricity.org.au/v4/data/network";
const LICENCE = "https://platform.openelectricity.org.au/license";
const KEY = process.env.OPENELECTRICITY_API_KEY;

const cacheArg = process.argv.indexOf("--cache");
const CACHE = cacheArg > 0 ? process.argv[cacheArg + 1] : null;

// The regions: the NEM as a whole, its five regions, and the WEM. `stats` is the history file,
// `weekly` says which API call the region's weeks come from and under which region column.
export const REGIONS = [
  {id: "NEM", name: "National Electricity Market", short: "NEM", network: "NEM", stats: `${STATS}/NEM/energy/all.json`},
  {id: "NSW1", name: "New South Wales", short: "NSW", network: "NEM", stats: `${STATS}/NEM/NSW1/energy/all.json`},
  {id: "QLD1", name: "Queensland", short: "QLD", network: "NEM", stats: `${STATS}/NEM/QLD1/energy/all.json`},
  {id: "SA1", name: "South Australia", short: "SA", network: "NEM", stats: `${STATS}/NEM/SA1/energy/all.json`},
  {id: "TAS1", name: "Tasmania", short: "TAS", network: "NEM", stats: `${STATS}/NEM/TAS1/energy/all.json`},
  {id: "VIC1", name: "Victoria", short: "VIC", network: "NEM", stats: `${STATS}/NEM/VIC1/energy/all.json`},
  {id: "WEM", name: "Western Australia (SWIS)", short: "WA", network: "WEM", stats: `${STATS}/WEM/energy/all.json`},
];

// Open Electricity's fuel technologies, colours and order (src/lib/fuel_techs.js in
// github.com/opennem/openelectricity): loads first, then the sources from the bottom of the
// stack to the top.
export const FUEL_TECHS = [
  {id: "battery_charging", label: "Battery (charging)", colour: "#4F5FD7", kind: "load", group: "batteries"},
  {id: "pumps", label: "Pumped hydro (pumping)", colour: "#00A5F1", kind: "load", group: "hydro"},
  {id: "exports", label: "Exports", colour: "#722AF7", kind: "load", group: "exchange"},
  {id: "imports", label: "Imports", colour: "#CFA7FF", kind: "imports", group: "exchange"},
  {id: "coal_brown", label: "Coal (brown)", colour: "#675B42", kind: "source", group: "coal", renewable: false},
  {id: "coal_black", label: "Coal (black)", colour: "#251C00", kind: "source", group: "coal", renewable: false},
  {id: "bioenergy_biogas", label: "Bioenergy (biogas)", colour: "#069FAF", kind: "source", group: "other", renewable: true},
  {id: "bioenergy_biomass", label: "Bioenergy (biomass)", colour: "#0B757C", kind: "source", group: "other", renewable: true},
  {id: "distillate", label: "Distillate", colour: "#E46E56", kind: "source", group: "other", renewable: false},
  {id: "gas_steam", label: "Gas (steam)", colour: "#E78114", kind: "source", group: "gas", renewable: false},
  {id: "gas_ccgt", label: "Gas (combined cycle)", colour: "#ED9C2C", kind: "source", group: "gas", renewable: false},
  {id: "gas_ocgt", label: "Gas (open cycle)", colour: "#F0AC4A", kind: "source", group: "gas", renewable: false},
  {id: "gas_recip", label: "Gas (reciprocating)", colour: "#F4C379", kind: "source", group: "gas", renewable: false},
  {id: "gas_wcmg", label: "Gas (waste coal mine)", colour: "#DA630E", kind: "source", group: "gas", renewable: false},
  {id: "battery_discharging", label: "Battery (discharging)", colour: "#3145CE", kind: "source", group: "batteries", renewable: null},
  {id: "hydro", label: "Hydro", colour: "#ACE9FE", kind: "source", group: "hydro", renewable: true},
  {id: "wind", label: "Wind", colour: "#2A7E3F", kind: "source", group: "wind", renewable: true},
  {id: "solar_utility", label: "Solar (utility)", colour: "#FECE00", kind: "source", group: "solar", renewable: true},
  {id: "solar_rooftop", label: "Solar (rooftop)", colour: "#FFEB5C", kind: "source", group: "solar", renewable: true},
];
const KNOWN = new Set(FUEL_TECHS.map(f => f.id));

async function fetchJson(url, {auth = false} = {}) {
  const file = CACHE && join(CACHE, url.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_") + ".json");
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const headers = {accept: "application/json"};
  if (auth && KEY) headers.authorization = `Bearer ${KEY}`;
  const res = await fetch(url, {headers});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const json = await res.json();
  if (file) { mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, JSON.stringify(json)); }
  return json;
}

// "YYYY-MM" → months since year 0, and back.
const monthIndex = ym => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const monthLabel = i => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const round1 = v => (v === null || v === undefined || Number.isNaN(v)) ? null : Math.round(v * 10) / 10;

// The monthly history of one region from its static file: every known fuel technology's
// energy, laid on one month axis from the earliest record to the last complete month.
function monthly(stats) {
  const series = stats.data.filter(s => s.type === "energy" && KNOWN.has(s.fuel_tech));
  if (!series.length) throw new Error("no energy series in history file");
  const first = Math.min(...series.map(s => monthIndex(s.history.start)));
  const last = Math.max(...series.map(s => monthIndex(s.history.last)));
  const n = last - first + 1;
  const values = {};
  for (const s of series) {
    const arr = new Array(n).fill(null);
    const i0 = monthIndex(s.history.start) - first;
    s.history.data.forEach((v, i) => { arr[i0 + i] = round1(v); });
    values[s.fuel_tech] = arr;
  }
  return {start: monthLabel(first), values, createdAt: stats.created_at};
}

// The last 52 complete weeks from one API response, for the region whose column is given
// (none for the network as a whole). The API's weeks start on Sunday; a week that has not
// ended yet is dropped.
function weekly(api, regionColumn) {
  const block = api.data?.[0];
  if (!block) throw new Error("empty API response");
  const results = block.results.filter(r => KNOWN.has(r.columns.fueltech) && (!regionColumn || r.columns.region === regionColumn));
  const dates = [...new Set(results.flatMap(r => r.data.map(d => d[0].slice(0, 10))))].sort();
  const now = Date.now();
  const complete = dates.filter(d => Date.parse(d + "T00:00:00Z") + 7 * 86400e3 <= now + 86400e3 * 0.5);
  const index = new Map(complete.map((d, i) => [d, i]));
  const values = {};
  for (const r of results) {
    const arr = new Array(complete.length).fill(null);
    for (const [t, v] of r.data) {
      const i = index.get(t.slice(0, 10));
      if (i !== undefined) arr[i] = round1(v / 1000);   // MWh → GWh
    }
    values[r.columns.fueltech] = arr;
  }
  return {start: complete[0], values};
}

async function main() {
  // Weekly: 364 days back keeps inside the API's 366-day limit for 7d intervals.
  const since = new Date(Date.now() - 364 * 86400e3).toISOString().slice(0, 10);
  const weeklyUrl = (network, byRegion) =>
    `${API}/${network}?metrics=energy&interval=7d&date_start=${since}&secondary_grouping=fueltech` +
    (byRegion ? "&primary_grouping=network_region" : "");
  const [nemWeeks, nemRegionWeeks, wemWeeks] = await Promise.all([
    fetchJson(weeklyUrl("NEM", false), {auth: true}),
    fetchJson(weeklyUrl("NEM", true), {auth: true}),
    fetchJson(weeklyUrl("WEM", false), {auth: true}),
  ]);

  const regions = [];
  for (const r of REGIONS) {
    const stats = await fetchJson(r.stats);
    const m = monthly(stats);
    const w = r.id === "NEM" ? weekly(nemWeeks) : r.id === "WEM" ? weekly(wemWeeks) : weekly(nemRegionWeeks, r.id);
    const months = Object.values(m.values)[0].length;
    console.log(`${r.id.padEnd(5)} ${Object.keys(m.values).length} techs, ${months} months from ${m.start}, ${Object.values(w.values)[0].length} weeks from ${w.start}`);
    regions.push({id: r.id, name: r.name, short: r.short, network: r.network,
      monthly: {start: m.start, values: m.values}, weekly: {start: w.start, values: w.values}});
  }

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    source: {
      name: "Open Electricity (The Superpower Institute)",
      url: "https://openelectricity.org.au/",
      licence: "CC BY-NC 4.0",
      licenceUrl: LICENCE,
      history: `${STATS}/NEM/energy/all.json`,
      weekly: `${API}/NEM?metrics=energy&interval=7d`,
    },
    fuelTechs: FUEL_TECHS,
    regions,
  };
  mkdirSync(dirname(OUT), {recursive: true});
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} (${Math.round(JSON.stringify(out).length / 1024)} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
