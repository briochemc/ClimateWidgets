// Builds src/climate-funds/data/climate-funds.json: what every country has paid into the six
// multilateral climate funds the World Bank holds in trust for the UNFCCC, fiscal year by
// fiscal year since the World Bank's open data begins (FY2012, which starts in July 2011),
// with each country's population and its GDP summed over the same years, so the widget can
// show the money in all, per person, or as a share of national income. Run it by hand from
// the repo root when the data should be refreshed (`node scripts/climate-funds.mjs`); it is
// never run by the site. Node 18 or later, no dependencies. `--cache <dir>` keeps the
// downloads for the next run.
//
// Sources, all CC BY 4.0:
//  - World Bank Finances One dataset DS00073, "Contributions (Receipts) to Trust Funds": cash
//    received from each donor by each trust fund, by World Bank fiscal year (July to June), in
//    US dollars at the exchange rate of the day. Refreshed quarterly. Receipts, not pledges.
//  - World Development Indicators SP.POP.TOTL (population) and NY.GDP.MKTP.CD (GDP in
//    current US dollars), by calendar year.
//  - Our World in Data's CO₂ dataset (the file the CO₂-per-capita widgets are built from),
//    for its `gdp` column: the Maddison Project's GDP in international dollars at 2011
//    prices, by calendar year since 1820, so the payments can be set against everything a
//    country has produced since 1850, the year the CO₂ widgets' cumulative view starts
//    from. The series has gaps in its early decades and ends a few years ago: a gap is
//    filled by interpolating the growth rate between the years either side, the years after
//    the end with the last value there is, and a country whose record begins after 1850
//    (most of the smaller ones, in 1950) is summed from where it begins.
//
// The six funds: the Green Climate Fund, the Global Environment Facility's trust fund (all
// of it, not only its climate work: the GEF also pays for biodiversity, chemicals and land),
// the Least Developed Countries Fund and the Special Climate Change Fund (both run by the
// GEF), the Adaptation Fund, and the Fund for responding to Loss and Damage set up at COP28.
//
// Donors that are not countries (the European Union, development banks, the UNFCCC
// secretariat, the proceeds of the Adaptation Fund's carbon credits, private donors) and the
// unattributed rows go into `other`, each with its name, and get no population or GDP.
//
// Output: `funds`; `years` (fiscal years); `countries`, each with `pop` (millions, the latest
// year), `gdp` (billions of US dollars summed over the calendar years the fiscal years span,
// a missing year filled with the nearest one there is), `gdp1850` (trillions of 2011
// international dollars summed from 1850, or from `gdp1850From` where the record begins
// later; null where there is no record) and `paid`, one array per fund of millions of US
// dollars received each fiscal year (null for none); and `other`.

import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/climate-funds/data/climate-funds.json");

const FONE = "https://datacatalogapi.worldbank.org/dexapps/fone/api/apiservice?datasetId=DS00073&resourceId=RS00074&type=json&top=1000&skip=";
const FONE_META = "https://datacatalogapi.worldbank.org/dexapps/fone/api/metadata?assetId=DS00073";
const WDI = ind => `https://api.worldbank.org/v2/country/all/indicator/${ind}?format=json&per_page=20000&date=2000:2030`;
const WDI_COUNTRIES = "https://api.worldbank.org/v2/country?format=json&per_page=400";
const OWID = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv";
const GDP1850_FIRST = 1850;

const FUNDS = [
  {id: "gcf", short: "GCF", name: "Green Climate Fund", wb: "Green Climate Fund"},
  {id: "gef", short: "GEF", name: "Global Environment Facility", wb: "Global Environment Facility"},
  {id: "ldcf", short: "LDCF", name: "Least Developed Countries Fund", wb: "Least Developed Countries Fund"},
  {id: "sccf", short: "SCCF", name: "Special Climate Change Fund", wb: "Special Climate Change Fund"},
  {id: "af", short: "AF", name: "Adaptation Fund", wb: "Adaptation Fund"},
  {id: "frld", short: "FRLD", name: "Fund for responding to Loss and Damage", wb: "Fund for responding to Loss and Damage"},
];
const fundByWb = new Map(FUNDS.map(f => [f.wb, f]));

// Donor names in Finances One that the World Development Indicators spell otherwise.
const DONOR_TO_ISO = {"Korea, Republic of": "KOR"};
// Country names as the widget should write them, where the World Bank's are not the usual ones.
const NAMES = {KOR: "South Korea", RUS: "Russia", VNM: "Vietnam", TUR: "Türkiye", CIV: "Côte d'Ivoire", SVK: "Slovakia"};
// Non-country donors, as the widget should name them.
const OTHER_NAMES = {
  "EU-Commission of the European Communities": "European Union",
  "Cassa Depositi e Prestiti (CDP)": "Cassa Depositi e Prestiti (Italy's development bank)",
  "CER Monetization": "Sale of carbon credits (Adaptation Fund)",
  "United Nations Framework Convention Climate Change (UNFCCC) Secretariat": "UNFCCC secretariat",
  "CAF Development Bank Latin America": "CAF, the development bank of Latin America",
  "Private Citizens Miscellaneous": "Private donors",
};

// ---- fetching ---------------------------------------------------------------------------

const cacheDir = (() => {
  const i = process.argv.indexOf("--cache");
  return i >= 0 ? process.argv[i + 1] : null;
})();

async function fetchText(url) {
  const key = cacheDir && join(cacheDir, url.replace(/[^\w.-]+/g, "_").slice(-150));
  if (key && existsSync(key)) return readFileSync(key, "utf8");
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url, {headers: {"user-agent": "ClimateWidgets/1.0 (scripts/climate-funds.mjs)"}});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  if (key) { mkdirSync(cacheDir, {recursive: true}); writeFileSync(key, text); }
  return text;
}
const fetchJson = async url => JSON.parse(await fetchText(url));

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

const sig4 = v => Number(Number(v).toPrecision(4));

// ---- the receipts -----------------------------------------------------------------------

const meta = await fetchJson(FONE_META);
const dataAsOf = meta.data_as_of;   // "2026-09-30"
if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAsOf)) throw new Error(`unexpected data_as_of ${dataAsOf}`);

const rows = [];
for (let skip = 0; ; skip += 1000) {
  const page = await fetchJson(FONE + skip);
  rows.push(...page.data);
  if (rows.length >= page.count || page.data.length === 0) break;
}
const receipts = rows.filter(r => fundByWb.has(r.trust_fund_name));
process.stderr.write(`${rows.length} receipts in all, ${receipts.length} for the six funds, as of ${dataAsOf}\n`);

const firstYear = Math.min(...receipts.map(r => r.fiscal_year));
const lastYear = Math.max(...receipts.map(r => r.fiscal_year));
const years = [];
for (let y = firstYear; y <= lastYear; y++) years.push(y);
const yearIndex = y => y - firstYear;

// ---- countries --------------------------------------------------------------------------

const wbCountries = (await fetchJson(WDI_COUNTRIES))[1].filter(c => c.region?.value !== "Aggregates");
const isoByName = new Map(wbCountries.map(c => [c.name, c.id]));
const nameByIso = new Map(wbCountries.map(c => [c.id, c.name]));
const regionByIso = new Map(wbCountries.map(c => [c.id, c.region.value]));

function series(indicatorRows) {
  const by = new Map();
  for (const d of indicatorRows) {
    if (d.value === null || !d.countryiso3code) continue;
    if (!by.has(d.countryiso3code)) by.set(d.countryiso3code, new Map());
    by.get(d.countryiso3code).set(Number(d.date), d.value);
  }
  return by;
}
const pop = series((await fetchJson(WDI("SP.POP.TOTL")))[1]);
const gdp = series((await fetchJson(WDI("NY.GDP.MKTP.CD")))[1]);

// The calendar years the fiscal years span: FY2012 starts in July 2011, and the last fiscal
// year, barely begun, is left out of the GDP sum, as there is no GDP for it yet.
const gdpFirst = firstYear - 1;
const gdpLast = Math.max(...[...gdp.values()].flatMap(m => [...m.keys()]));
const gdpYears = [];
for (let y = gdpFirst; y <= gdpLast; y++) gdpYears.push(y);

function cumulativeGdp(iso) {
  const m = gdp.get(iso);
  if (!m) return null;
  const have = [...m.keys()].filter(y => y >= gdpFirst && y <= gdpLast).sort((a, b) => a - b);
  if (!have.length) return null;
  let sum = 0, filled = 0;
  for (const y of gdpYears) {
    if (m.has(y)) sum += m.get(y);
    else { const near = have.reduce((p, q) => Math.abs(q - y) < Math.abs(p - y) ? q : p); sum += m.get(near); filled++; }
  }
  return {sum, filled, years: have.length};
}
// GDP since 1850 from the Maddison series in the OWID file, summed to the last year of the
// WDI GDP so that the two long sums end in the same year.
const owid = parseCsv(await fetchText(OWID));
const owidHead = owid[0];
const owidCol = name => { const i = owidHead.indexOf(name); if (i < 0) throw new Error(`OWID file has no column ${name}`); return i; };
const O = {iso: owidCol("iso_code"), year: owidCol("year"), gdp: owidCol("gdp")};
const maddison = new Map();   // iso → Map(year → GDP, 2011 international $)
for (const r of owid.slice(1)) {
  const code = r[O.iso];
  if (!code || code.startsWith("OWID_") || r[O.gdp] === "") continue;
  const year = Number(r[O.year]);
  if (!(year >= GDP1850_FIRST)) continue;
  if (!maddison.has(code)) maddison.set(code, new Map());
  maddison.get(code).set(year, Number(r[O.gdp]));
}
function cumulativeGdp1850(iso) {
  const m = maddison.get(iso);
  if (!m) return null;
  const have = [...m.keys()].sort((a, b) => a - b);
  const first = have[0], last = have[have.length - 1];
  let sum = 0;
  for (let y = first; y <= gdpLast; y++) {
    if (m.has(y)) { sum += m.get(y); continue; }
    if (y > last) { sum += m.get(last); continue; }
    // A gap: grow from the year before at the steady rate that reaches the year after.
    const a = have.filter(h => h < y).pop(), b = have.find(h => h > y);
    sum += m.get(a) * Math.pow(m.get(b) / m.get(a), (y - a) / (b - a));
  }
  return {sum, from: first, last};
}
function latestPop(iso) {
  const m = pop.get(iso);
  if (!m) return null;
  const y = Math.max(...m.keys());
  return {value: m.get(y), year: y};
}

// ---- aggregate --------------------------------------------------------------------------

const countries = new Map();   // iso → {code, name, paid: {fundId: number[]}}
const other = new Map();       // donor name → {name, paid}
const emptyPaid = () => Object.fromEntries(FUNDS.map(f => [f.id, years.map(() => null)]));
function add(target, fundId, year, usd) {
  const arr = target.paid[fundId];
  arr[yearIndex(year)] = (arr[yearIndex(year)] ?? 0) + usd;
}
for (const r of receipts) {
  const fund = fundByWb.get(r.trust_fund_name);
  const donor = r.reporting_donor;
  const usd = Number(r.net_contribution_usd) || 0;
  const iso = donor && (DONOR_TO_ISO[donor] ?? isoByName.get(donor));
  if (iso && r.donor_agency_group === "Sovereign governments") {
    if (!countries.has(iso)) countries.set(iso, {code: iso, name: NAMES[iso] ?? nameByIso.get(iso), paid: emptyPaid()});
    add(countries.get(iso), fund.id, r.fiscal_year, usd);
  } else {
    const name = donor ? (OTHER_NAMES[donor] ?? donor) : "Unattributed";
    if (!other.has(name)) other.set(name, {name, paid: emptyPaid()});
    add(other.get(name), fund.id, r.fiscal_year, usd);
  }
}

const toMillions = paid => Object.fromEntries(Object.entries(paid).map(([k, arr]) => [k, arr.map(v => v === null ? null : sig4(v / 1e6))]));

const missing = [], missing1850 = [];
const countryList = [...countries.values()].map(c => {
  const p = latestPop(c.code), g = cumulativeGdp(c.code), g1850 = cumulativeGdp1850(c.code);
  if (!p || !g) missing.push(`${c.code} ${c.name}`);
  if (!g1850) missing1850.push(`${c.code} ${c.name}`);
  return {
    code: c.code, name: c.name, region: regionByIso.get(c.code),
    pop: p ? sig4(p.value / 1e6) : null, popYear: p?.year ?? null,
    gdp: g ? sig4(g.sum / 1e9) : null, gdpFilled: g?.filled ?? null,
    gdp1850: g1850 ? sig4(g1850.sum / 1e12) : null, gdp1850From: g1850?.from ?? null, gdp1850Last: g1850?.last ?? null,
    paid: toMillions(c.paid),
  };
}).sort((a, b) => a.name.localeCompare(b.name));
if (missing.length) process.stderr.write(`no population or GDP: ${missing.join(", ")}\n`);
if (missing1850.length) process.stderr.write(`no GDP since 1850 (left out of that measure): ${missing1850.join(", ")}\n`);
process.stderr.write(`GDP since 1850 begins after ${GDP1850_FIRST} for: ${countryList.filter(c => c.gdp1850From > GDP1850_FIRST).map(c => `${c.code} ${c.gdp1850From}`).join(", ")}\n`);

const otherList = [...other.values()].map(o => ({name: o.name, paid: toMillions(o.paid)}))
  .sort((a, b) => a.name.localeCompare(b.name));

const data = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    dataAsOf,
    source: "World Bank Finances One, Contributions (Receipts) to Trust Funds (DS00073); World Development Indicators SP.POP.TOTL and NY.GDP.MKTP.CD; Maddison Project GDP via Our World in Data's CO₂ dataset; all CC BY 4.0",
    units: {paid: "millions of US dollars received in the World Bank fiscal year (July to June), at the exchange rate of the day", pop: "millions of people, latest year", gdp: "billions of current US dollars, summed over gdpYears",
      gdp1850: "trillions of international dollars at 2011 prices, summed over gdp1850Years or from gdp1850From where the record begins later, the years after gdp1850Last repeating its value"},
    fiscalYearNote: "Fiscal year N runs from July N-1 to June N.",
  },
  funds: FUNDS.map(({id, short, name}) => ({id, short, name})),
  years,
  gdpYears: [gdpFirst, gdpLast],
  gdp1850Years: [GDP1850_FIRST, gdpLast],
  countries: countryList,
  other: otherList,
};
mkdirSync(dirname(OUT), {recursive: true});
const json = JSON.stringify(data);
writeFileSync(OUT, json);

const total = list => list.reduce((s, c) => s + Object.values(c.paid).flat().reduce((a, v) => a + (v ?? 0), 0), 0);
process.stderr.write(`wrote ${OUT} (${Math.round(json.length / 1024)} kB): ${countryList.length} countries and ${otherList.length} other donors, FY${firstYear}–FY${lastYear}, GDP summed over ${gdpFirst}–${gdpLast}\n`);
process.stderr.write(`  countries paid USD ${(total(countryList) / 1000).toFixed(2)} bn, other donors USD ${(total(otherList) / 1000).toFixed(2)} bn\n`);
for (const f of FUNDS) {
  const t = [...countryList, ...otherList].reduce((s, c) => s + c.paid[f.id].reduce((a, v) => a + (v ?? 0), 0), 0);
  process.stderr.write(`  ${f.short}: USD ${(t / 1000).toFixed(2)} bn\n`);
}
for (const o of otherList) process.stderr.write(`  other: ${o.name}: USD ${Object.values(o.paid).flat().reduce((a, v) => a + (v ?? 0), 0).toFixed(1)} m\n`);
