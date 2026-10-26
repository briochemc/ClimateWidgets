// Builds src/climate-funds/data/climate-funds.json: what every country has pledged to and paid
// into the six multilateral climate funds the World Bank holds in trust for the UNFCCC, with
// each country's population and GDP, so the widget can show the money in all, per person, or
// as a share of national income. Run it by hand from the repo root when the data should be
// refreshed (`node scripts/climate-funds.mjs`); it is never run by the site. Node 18 or later,
// no npm dependencies, but it shells out to poppler's `pdftotext` for the three PDF reports
// (`brew install poppler`). `--cache <dir>` keeps the downloads for the next run.
//
// Three funds publish their own donor tables, and those are used, found afresh each run:
//  - The Green Climate Fund's "Status of Pledges" PDF (linked from its landing page): per
//    contributor and fundraising round, the pledge and the cash disbursed plus promissory
//    notes deposited, in the contributor's currency and in US dollars at the round's fixed
//    reference exchange rate. Those US dollar figures are used as the Fund reports them.
//  - The Adaptation Fund's quarterly trustee report (the newest on the World Bank trustee
//    site): per donor, the pledge and what was received, with receipts in actual US dollars;
//    the pledge is converted at the same rate as the receipts.
//  - The Fund for responding to Loss and Damage's trustee report, likewise: the pledge in
//    US dollars, and cash received plus promissory notes deposited.
// The other three (the Global Environment Facility's trust fund, all of it, not only its
// climate work; and the Least Developed Countries Fund and Special Climate Change Fund the
// GEF runs) publish their donor tables only as pictures, so for them the cash received comes
// from the World Bank's open record of receipts to every trust fund it holds, Finances One
// dataset DS00073 (cash and encashed promissory notes, at the exchange rate of the day, from
// fiscal year 2012, which began in July 2011; refreshed quarterly), and they have no pledges.
//
// Population and GDP are the World Development Indicators (SP.POP.TOTL, NY.GDP.MKTP.CD in
// current US dollars), and GDP since 1850 is the Maddison Project series carried in Our World
// in Data's CO₂ file, the one the CO₂-per-capita widgets are built from: a gap is filled at
// the growth rate between the years either side, the years after the series ends repeat its
// last value, and a country whose record begins after 1850 is summed from where it begins.
//
// Donors that are not countries (the European Union, development banks, the UNFCCC
// secretariat, private donors) and the receipts the World Bank does not attribute go into
// `other`, each with its name, and get no population or GDP.
//
// Output: `funds`, each with its source (title, link, date) and whether it reports pledges;
// `countries`, each with `pop` (millions, the latest year), `gdp` (billions of US dollars
// summed over `gdpYears`), `gdp1850` (trillions of 2011 international dollars summed from 1850
// or from `gdp1850From`), `received` and `pledged` (millions of US dollars per fund id, pledged
// null for the funds without pledges); and `other`.

import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/climate-funds/data/climate-funds.json");

const GCF_PAGE = "https://www.greenclimate.fund/document/status-pledges-all-cycles";
const TRUSTEE = code => `https://fiftrustee.worldbank.org/en/about/unit/pim/fiftrustee/reports?fundName=${code}&folderName=Trustee%20Reports`;
const FONE_PAGE = "https://financesone.worldbank.org/api-explorer?id=DS00073";
const FONE = "https://datacatalogapi.worldbank.org/dexapps/fone/api/apiservice?datasetId=DS00073&resourceId=RS00074&type=json&top=1000&skip=";
const FONE_META = "https://datacatalogapi.worldbank.org/dexapps/fone/api/metadata?assetId=DS00073";
const WDI = ind => `https://api.worldbank.org/v2/country/all/indicator/${ind}?format=json&per_page=20000&date=2000:2030`;
const WDI_COUNTRIES = "https://api.worldbank.org/v2/country?format=json&per_page=400";
const OWID = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv";
const GDP1850_FIRST = 1850;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const FUNDS = [
  {id: "gcf", short: "GCF", name: "Green Climate Fund"},
  {id: "gef", short: "GEF", name: "Global Environment Facility", wb: "Global Environment Facility"},
  {id: "ldcf", short: "LDCF", name: "Least Developed Countries Fund", wb: "Least Developed Countries Fund"},
  {id: "sccf", short: "SCCF", name: "Special Climate Change Fund", wb: "Special Climate Change Fund"},
  {id: "af", short: "AF", name: "Adaptation Fund"},
  {id: "frld", short: "FRLD", name: "Fund for responding to Loss and Damage"},
];
const fundByWb = new Map(FUNDS.filter(f => f.wb).map(f => [f.wb, f]));

// Country names as the widget should write them, where the World Bank's are not the usual ones.
const NAMES = {KOR: "South Korea", RUS: "Russia", VNM: "Vietnam", TUR: "Türkiye", CIV: "Côte d'Ivoire", SVK: "Slovakia"};
// Donor names, as the reports and the receipts spell them, that the WDI spells otherwise.
const ALIASES = {"Korea, Republic of": "KOR", "Republic of Korea": "KOR", "Korea": "KOR", "Slovakia": "SVK", "Czech Republic": "CZE", "Vietnam": "VNM"};
// Non-country donors, as the widget should name them.
const OTHER_NAMES = {
  "EU-Commission of the European Communities": "European Union", "European Commission": "European Union", "EU Member States": null,
  "Cassa Depositi e Prestiti (CDP)": "Cassa Depositi e Prestiti (Italy's development bank)",
  "CER Monetization": "Sale of carbon credits (Adaptation Fund)",
  "United Nations Framework Convention Climate Change (UNFCCC) Secretariat": "UNFCCC secretariat", "UNFCCC Secretariat": "UNFCCC secretariat",
  "CAF Development Bank Latin America": "CAF, the development bank of Latin America", "Corporacion Andina de Fomento": "CAF, the development bank of Latin America",
  "Private Citizens Miscellaneous": "Private donors", "Others": "Private donors",
  "United Nations Foundation": "UN Foundation",
};

// ---- fetching ---------------------------------------------------------------------------

const cacheDir = (() => {
  const i = process.argv.indexOf("--cache");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const cacheKey = url => cacheDir && join(cacheDir, url.replace(/[^\w.-]+/g, "_").slice(-150));

async function fetchBytes(url) {
  const key = cacheKey(url);
  if (key && existsSync(key)) return readFileSync(key);
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url, {headers: {"user-agent": UA}});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (key) { mkdirSync(cacheDir, {recursive: true}); writeFileSync(key, bytes); }
  return bytes;
}
const fetchText = async url => (await fetchBytes(url)).toString("utf8");
const fetchJson = async url => JSON.parse(await fetchText(url));

// The text of a PDF with its columns kept, through poppler's pdftotext.
async function fetchPdfText(url) {
  const bytes = await fetchBytes(url);
  const file = join(tmpdir(), `climate-funds-${Date.now()}.pdf`);
  writeFileSync(file, bytes);
  try {
    return execFileSync("pdftotext", ["-layout", file, "-"], {encoding: "utf8", maxBuffer: 1 << 26});
  } catch (e) {
    throw new Error(`pdftotext failed (is poppler installed? brew install poppler): ${e.message}`);
  }
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

const sig4 = v => Number(Number(v).toPrecision(4));
const num = s => s === "-" ? 0 : Number(s.replace(/,/g, ""));
const MONTHS = {january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12};
// "30 September 2026", "June 30, 2026" or "December 31, 2025" as an ISO date.
function isoDate(text) {
  let m = text.match(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/);
  if (m) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}),? (\d{4})/);
  if (m) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  throw new Error(`no date in "${text.slice(0, 80)}"`);
}

// ---- countries --------------------------------------------------------------------------

const wbCountries = (await fetchJson(WDI_COUNTRIES))[1].filter(c => c.region?.value !== "Aggregates");
const isoByName = new Map(wbCountries.map(c => [c.name, c.id]));
const nameByIso = new Map(wbCountries.map(c => [c.id, c.name]));
const regionByIso = new Map(wbCountries.map(c => [c.id, c.region.value]));

// A donor's name as a report writes it, to an ISO code, or null for a donor that is not a
// country: footnote marks ("Japan a/", "United Kingdom5"), the kind of money ("Canada (Grant)"),
// and sub-national donors ("Belgium (Flanders)", "France - City of Paris") all fold into the
// country.
function isoOf(name) {
  let n = name.replace(/\s+[a-z]\/$/, "").replace(/\d+$/, "").trim();
  n = n.replace(/\s*\((Grant|Loans?|Cushions?|Flanders|Quebec|Walloon Region.*|Brussels.*)\)\s*$/, "");
  n = n.replace(/\s*-\s*(Brussels-Capital Region|Flemish Region|Walloon Region.*|City of Paris)$/, "").trim();
  if (n in OTHER_NAMES) return null;
  return ALIASES[n] ?? isoByName.get(n) ?? null;
}
const otherName = name => {
  const n = name.replace(/\s+[a-z]\/$/, "").replace(/\s*\(.*\)\s*$/, "").trim();
  return OTHER_NAMES[n] === undefined ? n : OTHER_NAMES[n];
};

// ---- the three funds' own reports -------------------------------------------------------

// Each parser returns {asOf, url, title, rows: [{name, received, pledged}]} in millions of USD.

async function parseGcf() {
  const page = await fetchText(GCF_PAGE);
  const m = page.match(/\/sites\/default\/files\/[^"']*status-pledges[^"']*\.pdf/i);
  if (!m) throw new Error("no Status of Pledges PDF linked from the GCF page");
  const url = new URL(m[0], GCF_PAGE).href;
  const text = await fetchPdfText(url);
  // Names may end in a footnote digit ("United Kingdom5") or a numbered part ("Walloon Region (2)").
  const rowre = /^ (?<name>[A-Za-z][A-Za-z\d .'()\-–]+?)\s+(?<cur>[A-Z]{3})\s+(?<nums>(?:[\d,.]+|-)(?:\s+(?:[\d,.]+|-))+)\s*$/;
  let table = null, asOf = null;
  const rows = [];
  const totals = {IRM: [0, 0], "GCF-1": [0, 0], "GCF-2": [0, 0]};
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\f/g, "");
    if (/Status of pledges for the GCF/.test(line)) {
      table = /\(IRM\)/.test(line) ? "IRM" : /GCF-1/.test(line) ? "GCF-1" : "GCF-2";
      asOf ??= isoDate(line);
      continue;
    }
    if (/^Notes:/.test(line)) table = null;
    const r = table && rowre.exec(line);
    if (!r) continue;
    if (/Total/.test(r.groups.name)) continue;   // the EU subtotal
    const nums = r.groups.nums.split(/\s+/).map(num);
    // Columns: pledge (in currency, USD eq, and with credits from GCF-1 on), confirmed (in
    // currency, USD eq), unconfirmed likewise where the table has the column, then the cash
    // disbursed and notes deposited (in currency, USD eq). An unconfirmed-only pledge has
    // nothing deposited, whatever the layout puts in its empty cells.
    const pledged = nums[1];
    let received;
    if (table === "IRM") received = nums[2] === 0 ? 0 : nums[nums.length - 4];
    else if (table === "GCF-1") received = nums[6];
    else received = nums[4] === 0 ? 0 : nums[nums.length >= 12 ? 8 : 6];
    totals[table][0] += pledged;
    totals[table][1] += received;
    rows.push({name: r.groups.name.trim(), received, pledged});
  }
  for (const [t, [p, d]] of Object.entries(totals)) process.stderr.write(`  GCF ${t}: pledged ${p.toFixed(1)}, deposited ${d.toFixed(1)} (USD m at reference rates)\n`);
  if (!(totals.IRM[1] > 8000 && totals["GCF-1"][1] > 8000)) throw new Error("GCF tables did not parse as expected");
  return {asOf, url, title: "Green Climate Fund, Status of Pledges", basis: "cash received and promissory notes deposited, at each round's reference exchange rate", rows};
}

// The newest PDF a fund's trustee-report listing links to.
async function latestTrusteeReport(code) {
  const page = await fetchText(TRUSTEE(code));
  const paths = [...page.matchAll(/"(\/content\/dam\/[^"]*\.pdf)"/g)].map(m => m[1]);
  if (!paths.length) throw new Error(`no trustee report listed for ${code}`);
  return "https://fiftrustee.worldbank.org" + encodeURI(paths[0]);
}

async function parseAdaptationFund() {
  const url = await latestTrusteeReport("ADAPT");
  const text = await fetchPdfText(url);
  const asOf = isoDate(text.match(/financial information as of [^\n]+/)?.[0] ?? "");
  // DONATIONS table: donor, currency, pledge, signed, received (all in currency), receivable
  // (USD eq), receipts (USD). The pledge is converted at the rate the receipts were, or, for a
  // pledge nothing has been received against, counted as receipts plus receivable.
  const rowre = /^ (?<name>[A-Za-z][A-Za-z .'()\/-]+?)\s+(?<cur>[A-Z]{3})\s+(?<nums>(?:[\d,.]+|-)(?:\s+(?:[\d,.]+|-)){4})\s*$/;
  const rows = [];
  let inTable = false, total = 0;
  for (const line of text.split("\n")) {
    if (/^DONATIONS \(in millions\)/.test(line)) { inTable = true; continue; }
    if (inTable && /^Total\b/.test(line)) { total = num(line.trim().split(/\s+/).pop()); inTable = false; }
    const r = inTable && rowre.exec(line);
    if (!r) continue;
    const [pledgeCur, , receivedCur, receivableUsd, receivedUsd] = r.groups.nums.split(/\s+/).map(num);
    const rate = receivedCur > 0 ? receivedUsd / receivedCur : null;
    const pledged = rate !== null ? pledgeCur * rate : receivedUsd + receivableUsd;
    rows.push({name: r.groups.name.trim(), received: receivedUsd, pledged});
  }
  const sum = rows.reduce((s, r) => s + r.received, 0);
  process.stderr.write(`  Adaptation Fund: received ${sum.toFixed(1)} (table total ${total.toFixed(1)}), ${rows.length} donor rows\n`);
  if (!(Math.abs(sum - total) < 1)) throw new Error("Adaptation Fund table did not parse as expected");
  return {asOf, url, title: "Adaptation Fund, trustee report", basis: "cash received, in US dollars", rows};
}

async function parseLossAndDamage() {
  const url = await latestTrusteeReport("FRLD");
  const text = await fetchPdfText(url);
  const asOf = isoDate(text.match(/Pledges and Contributions as of [^\n]+/)?.[0] ?? "");
  // Columns: pledge (in currency, USD eq), signed (in currency), received (in currency), cash
  // received (USD), promissory notes deposited (USD eq), the two together, then what is
  // outstanding, in one or two columns.
  const rowre = /^ (?<name>[A-Za-z][A-Za-z .'()\/-]+?)\s+(?<cur>[A-Z]{3})\s+(?<nums>(?:[\d,.]+|-)(?:\s+(?:[\d,.]+|-)){7,8})\s*$/;
  const rows = [];
  let inTable = false, total = [0, 0];
  for (const line of text.split("\n")) {
    if (/Pledges and Contributions as of/.test(line) && !/\.{5}/.test(line)) { inTable = true; continue; }
    if (inTable && /^Total\b/.test(line)) { const t = line.trim().split(/\s+/).map(num); total = [t[1], t[4]]; inTable = false; }
    const r = inTable && rowre.exec(line);
    if (!r) continue;
    const nums = r.groups.nums.split(/\s+/).map(num);
    rows.push({name: r.groups.name.trim(), received: nums[6], pledged: nums[1]});
  }
  const sums = [rows.reduce((s, r) => s + r.pledged, 0), rows.reduce((s, r) => s + r.received, 0)];
  process.stderr.write(`  Loss and Damage: pledged ${sums[0].toFixed(1)} (table ${total[0].toFixed(1)}), received ${sums[1].toFixed(1)} (table ${total[1].toFixed(1)}), ${rows.length} donor rows\n`);
  // The table's total leaves out the USD 10 million Japan paid to the UNFCCC for the interim
  // secretariat before the trust fund existed, which Japan's own row includes.
  if (!(Math.abs(sums[0] - total[0]) < 1 && Math.abs(sums[1] - total[1]) < 11)) throw new Error("Loss and Damage table did not parse as expected");
  return {asOf, url, title: "Fund for responding to Loss and Damage, trustee report", basis: "cash received and promissory notes deposited, in US dollars", rows};
}

// ---- the World Bank's receipts, for the other three ---------------------------------------

async function parseWorldBank() {
  const meta = await fetchJson(FONE_META);
  const asOf = meta.data_as_of;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(`unexpected data_as_of ${asOf}`);
  const all = [];
  for (let skip = 0; ; skip += 1000) {
    const page = await fetchJson(FONE + skip);
    all.push(...page.data);
    if (all.length >= page.count || page.data.length === 0) break;
  }
  const rows = new Map();   // fund id → donor name → USD m
  let firstYear = Infinity;
  for (const r of all) {
    const fund = fundByWb.get(r.trust_fund_name);
    if (!fund) continue;
    firstYear = Math.min(firstYear, r.fiscal_year);
    const sovereign = r.donor_agency_group === "Sovereign governments";
    const name = r.reporting_donor ? (sovereign ? r.reporting_donor : OTHER_NAMES[r.reporting_donor] ?? r.reporting_donor) : "Unattributed";
    if (!rows.has(fund.id)) rows.set(fund.id, new Map());
    const m = rows.get(fund.id);
    m.set(name, (m.get(name) ?? 0) + (Number(r.net_contribution_usd) || 0) / 1e6);
  }
  process.stderr.write(`  World Bank receipts as of ${asOf}, from FY${firstYear}: ` +
    [...rows].map(([id, m]) => `${id} ${[...m.values()].reduce((s, v) => s + v, 0).toFixed(0)}`).join(", ") + " (USD m)\n");
  return {asOf, url: FONE_PAGE, title: "World Bank, Contributions (Receipts) to Trust Funds", basis: `cash received and promissory notes encashed since July ${firstYear - 1}, at the exchange rate of the day`, rows, firstYear};
}

// ---- population and GDP -----------------------------------------------------------------

function series(indicatorRows) {
  const by = new Map();
  for (const d of indicatorRows) {
    if (d.value === null || !d.countryiso3code) continue;
    if (!by.has(d.countryiso3code)) by.set(d.countryiso3code, new Map());
    by.get(d.countryiso3code).set(Number(d.date), d.value);
  }
  return by;
}

// ---- main -------------------------------------------------------------------------------

process.stderr.write("reports:\n");
const gcf = await parseGcf();
const af = await parseAdaptationFund();
const frld = await parseLossAndDamage();
const wb = await parseWorldBank();

const pop = series((await fetchJson(WDI("SP.POP.TOTL")))[1]);
const gdp = series((await fetchJson(WDI("NY.GDP.MKTP.CD")))[1]);
// The calendar years the receipts span: the World Bank's first fiscal year starts in July of
// the year before, and the GDP sum runs to the last year there is GDP for.
const gdpFirst = wb.firstYear - 1;
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
  return {sum, filled};
}
function latestPop(iso) {
  const m = pop.get(iso);
  if (!m) return null;
  const y = Math.max(...m.keys());
  return {value: m.get(y), year: y};
}

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
    const a = have.filter(h => h < y).pop(), b = have.find(h => h > y);
    sum += m.get(a) * Math.pow(m.get(b) / m.get(a), (y - a) / (b - a));
  }
  return {sum, from: first, last};
}

// ---- aggregate --------------------------------------------------------------------------

const countries = new Map();   // iso → {received: {fund: m}, pledged: {fund: m}}
const other = new Map();       // name → the same
const unmatched = new Set();
function add(fundId, name, received, pledged) {
  const iso = isoOf(name);
  let target;
  if (iso) {
    if (!countries.has(iso)) countries.set(iso, {code: iso, received: {}, pledged: {}});
    target = countries.get(iso);
  } else {
    const n = otherName(name);
    if (n === null) return;
    if (!isoByName.has(n) && !(name in OTHER_NAMES) && !(n in OTHER_NAMES) && n !== "Unattributed") unmatched.add(name);
    if (!other.has(n)) other.set(n, {name: n, received: {}, pledged: {}});
    target = other.get(n);
  }
  target.received[fundId] = (target.received[fundId] ?? 0) + received;
  if (pledged !== null) target.pledged[fundId] = (target.pledged[fundId] ?? 0) + pledged;
}
for (const r of gcf.rows) add("gcf", r.name, r.received, r.pledged);
for (const r of af.rows) add("af", r.name, r.received, r.pledged);
for (const r of frld.rows) add("frld", r.name, r.received, r.pledged);
for (const [fundId, m] of wb.rows) for (const [name, usd] of m) add(fundId, name, usd, null);
if (unmatched.size) process.stderr.write(`not matched to a country, kept as other donors: ${[...unmatched].join("; ")}\n`);

const round = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sig4(v)]));
const missing = [], missing1850 = [];
const countryList = [...countries.values()].map(c => {
  const p = latestPop(c.code), g = cumulativeGdp(c.code), g1850 = cumulativeGdp1850(c.code);
  if (!p || !g) missing.push(`${c.code}`);
  if (!g1850) missing1850.push(`${c.code}`);
  return {
    code: c.code, name: NAMES[c.code] ?? nameByIso.get(c.code), region: regionByIso.get(c.code),
    pop: p ? sig4(p.value / 1e6) : null, popYear: p?.year ?? null,
    gdp: g ? sig4(g.sum / 1e9) : null, gdpFilled: g?.filled ?? null,
    gdp1850: g1850 ? sig4(g1850.sum / 1e12) : null, gdp1850From: g1850?.from ?? null, gdp1850Last: g1850?.last ?? null,
    received: round(c.received), pledged: round(c.pledged),
  };
}).sort((a, b) => a.name.localeCompare(b.name));
if (missing.length) process.stderr.write(`no population or GDP: ${missing.join(", ")}\n`);
if (missing1850.length) process.stderr.write(`no GDP since 1850 (left out of that measure): ${missing1850.join(", ")}\n`);

const otherList = [...other.values()].map(o => ({name: o.name, received: round(o.received), pledged: round(o.pledged)}))
  .sort((a, b) => a.name.localeCompare(b.name));

const sources = {gcf, af, frld, gef: wb, ldcf: wb, sccf: wb};
const data = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    units: {received: "millions of US dollars", pledged: "millions of US dollars, null where the fund publishes no pledge table", pop: "millions of people, latest year",
      gdp: "billions of current US dollars, summed over gdpYears", gdp1850: "trillions of international dollars at 2011 prices, summed over gdp1850Years or from gdp1850From where the record begins later"},
    licence: "GCF, World Bank trustee reports and Finances One, WDI, Maddison via Our World in Data; CC BY 4.0 for the World Bank and OWID data",
  },
  funds: FUNDS.map(({id, short, name}) => ({id, short, name, pledges: ["gcf", "af", "frld"].includes(id),
    source: {title: sources[id].title, url: sources[id].url, asOf: sources[id].asOf, basis: sources[id].basis}})),
  gdpYears: [gdpFirst, gdpLast],
  gdp1850Years: [GDP1850_FIRST, gdpLast],
  countries: countryList,
  other: otherList,
};
mkdirSync(dirname(OUT), {recursive: true});
const json = JSON.stringify(data);
writeFileSync(OUT, json);

const total = (list, key, fund) => list.reduce((s, c) => s + (c[key][fund] ?? 0), 0);
process.stderr.write(`wrote ${OUT} (${Math.round(json.length / 1024)} kB): ${countryList.length} countries and ${otherList.length} other donors; GDP summed over ${gdpFirst}–${gdpLast}\n`);
for (const f of FUNDS) {
  const all = [...countryList, ...otherList];
  process.stderr.write(`  ${f.short}: received USD ${(total(all, "received", f.id) / 1000).toFixed(2)} bn` +
    (f.id in {gcf: 1, af: 1, frld: 1} ? `, pledged ${(total(all, "pledged", f.id) / 1000).toFixed(2)} bn` : "") + ` (${sources[f.id].asOf})\n`);
}
for (const o of otherList) process.stderr.write(`  other: ${o.name}: received USD ${Object.values(o.received).reduce((a, v) => a + v, 0).toFixed(1)} m\n`);
