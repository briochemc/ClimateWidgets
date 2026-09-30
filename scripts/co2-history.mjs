// Builds src/co2-history/data/co2-history.json, the one data file behind the CO₂ history
// widget: 800,000 years of Antarctic ice cores down to this year's weekly Mauna Loa values,
// plus NOAA's marine boundary layer reference and the flask network for the latitude panel.
// Run it by hand from the repo root when the data should be refreshed (`node
// scripts/co2-history.mjs`); it is never run by the site. Node 18 or later, no dependencies.
//
// Every source is fetched from its publisher (URLs and citations in SOURCES below) except
// the 34 Siple Station samples, which live in a tarball on ESS-DIVE and are typed in here
// instead. `--cache <dir>` keeps the downloads in a folder and reuses them on the next run.
//
// Conventions in the output: times are decimal years CE (ice-core ages, given as years
// before 1950, are converted, so 800 kyr BP comes out as -798050); values are ppm, rounded
// to 0.01 for the Mauna Loa, South Pole and global series and to 0.1 for the flask sites
// and the boundary-layer surface, which are only ever drawn as dots and a curve. Monthly series
// are stored as a first month plus one value per consecutive month, null where a month is
// missing, which is a third of the size of (time, value) pairs.

import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/co2-history/data/co2-history.json");
const LAND = join(ROOT, "src/data/countries-110m.json");

const NOAA_TRENDS = "https://gml.noaa.gov/webdata/ccgg/trends/co2/";
const NOAA_FLASK = "https://gml.noaa.gov/aftp/data/trace_gases/co2/flask/surface/co2_surface-flask_ccgg_text.tar.gz";
const NOAA_MBL = "https://gml.noaa.gov/ccgg/mbl/";
const SCRIPPS = "https://keelinglabsites.ucsd.edu/websitedataco2/";
const NCEI = "https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/";

// Listed in the order the widget's page cites them.
const SOURCES = [
  {id: "noaa-mlo", name: "NOAA GML Mauna Loa in situ record", url: NOAA_TRENDS,
    cite: "Lan, X., Tans, P. and Thoning, K., NOAA GML, doi:10.15138/9N0H-ZH07", licence: "CC0"},
  {id: "scripps", name: "Scripps CO₂ Program (Keeling record and flask stations)", url: "https://scrippsco2.ucsd.edu/",
    cite: "Keeling, C.D. et al. (2001), SIO Reference Series 01-06", licence: "CC BY 4.0"},
  {id: "noaa-flask", name: "NOAA GML Carbon Cycle Cooperative Global Air Sampling Network", url: "https://gml.noaa.gov/ccgg/flask.html",
    cite: "Lan, X. et al., NOAA GML, doi:10.15138/wkgj-f215", licence: "CC0"},
  {id: "noaa-mbl", name: "NOAA GML Marine Boundary Layer Reference", url: NOAA_MBL,
    cite: "Lan, X., Tans, P., Thoning, K. and NOAA GML (2024), doi:10.15138/DVNP-F961", licence: "CC0"},
  {id: "law-dome", name: "Law Dome ice core and firn", url: NCEI + "law/law2018co2.txt",
    cite: "Rubino, M. et al. (2019), Earth Syst. Sci. Data 11, 473–492, doi:10.5194/essd-11-473-2019; " +
      "MacFarling Meure, C. et al. (2006), Geophys. Res. Lett. 33, L14810"},
  {id: "siple", name: "Siple Station ice core", url: "https://doi.org/10.3334/CDIAC/ATG.010",
    cite: "Neftel, A. et al. (1985), Nature 315, 45–47; Friedli, H. et al. (1986), Nature 324, 237–238", licence: "CC BY 4.0"},
  {id: "composite", name: "Antarctic ice core composite, 0–800 kyr", url: NCEI + "antarctica2015co2composite.txt",
    cite: "Bereiter, B. et al. (2015), Geophys. Res. Lett. 42, 542–549, doi:10.1002/2014GL061957, " +
      "from Petit, J.R. et al. (1999), Nature 399; Siegenthaler, U. et al. (2005), Science 310; " +
      "Lüthi, D. et al. (2008), Nature 453; and the records listed in the file"},
];

// Scripps flask stations: the CSVs carry no coordinates, so these are from the program's
// station list. Station P and Fanning ended in the early 1980s; they matter for the
// latitude panel before 1979, when NOAA's network was still small.
const SCRIPPS_STATIONS = [
  ["alt", "monthly_flask_co2_alt.csv", "Alert, Nunavut", 82.45, -62.51],
  ["ptb", "monthly_merge_co2_ptb.csv", "Point Barrow, Alaska", 71.32, -156.60],
  ["stp", "monthly_flask_co2_stp.csv", "Ocean Station P", 50.00, -145.00],
  ["ljo", "monthly_merge_co2_ljo.csv", "La Jolla, California", 32.87, -117.26],
  ["bcs", "monthly_flask_co2_bcs.csv", "Baja California Sur", 23.30, -110.20],
  ["mlo", "monthly_in_situ_co2_mlo.csv", "Mauna Loa, Hawaii", 19.54, -155.58],
  ["kum", "monthly_flask_co2_kum.csv", "Cape Kumukahi, Hawaii", 19.52, -154.82],
  ["chr", "monthly_flask_co2_chr.csv", "Christmas Island", 2.00, -157.30],
  ["fan", "monthly_flask_co2_fan.csv", "Fanning Island", 3.90, -159.40],
  ["sam", "monthly_flask_co2_sam.csv", "American Samoa", -14.25, -170.57],
  ["ker", "monthly_flask_co2_ker.csv", "Kermadec Islands", -29.20, -177.90],
  ["nzd", "monthly_flask_co2_nzd.csv", "Baring Head, New Zealand", -41.40, 174.90],
  ["spo", "monthly_merge_co2_spo.csv", "South Pole", -90.00, 0.00],
];

// Siple Station, from trends/co2/siple2.013 in the CDIAC archive now on ESS-DIVE
// (doi:10.3334/CDIAC/ATG.010, CC BY 4.0). Neftel et al. 1985 give the air-enclosure date
// as a range; Friedli et al. 1986 give a single gas age.
const SIPLE_NEFTEL = [
  [1734, 1756, 279], [1754, 1776, 279], [1794, 1819, 280], [1814, 1836, 284], [1842, 1864, 288],
  [1883, 1905, 297], [1903, 1925, 300], [1921, 1943, 306], [1938, 1960, 311], [1947, 1969, 312],
  [1954, 1976, 318], [1962, 1983, 328],
];
const SIPLE_FRIEDLI = [
  [1744, 276.8], [1764, 276.7], [1791, 279.7], [1816, 283.8], [1839, 283.1], [1843, 287.4],
  [1847, 286.8], [1854, 288.2], [1869, 289.3], [1874, 289.5], [1878, 290.3], [1887, 292.3],
  [1899, 295.8], [1903, 294.8], [1905, 296.9], [1909, 299.2], [1915, 300.5], [1921, 301.6],
  [1927, 305.5], [1935, 306.6], [1943, 307.9], [1953, 312.7],
];

// The Bereiter composite is stitched from these records (its own header lists them). The
// per-core files are matched row by row to label each composite point with its core; this
// table is the fallback for rows that match nothing, keyed by upper age bound in kyr BP.
const CORES = [
  {name: "Law Dome", file: "antarctica2015co2law.txt", until: 2, plus: "antarctica2015co2lawsp.txt"},
  {name: "EPICA Dome C", file: "antarctica2015co2domec.txt", until: 11, plus: "antarctica2015co2edc.txt"},
  {name: "WAIS Divide", file: "antarctica2015co2wais.txt", until: 22},
  {name: "Siple Dome", file: "antarctica2015co2siple.txt", until: 40},
  {name: "Talos Dome", file: "antarctica2015co2talos.txt", until: 60},
  {name: "EDML", file: "antarctica2015co2edml.txt", until: 110},
  {name: "EPICA Dome C", until: 155},
  {name: "Vostok", file: "antarctica2015co2vostok.txt", until: 393},
  {name: "EPICA Dome C", until: Infinity},
];

// ---- fetching ---------------------------------------------------------------------------

const cacheDir = (() => {
  const i = process.argv.indexOf("--cache");
  return i >= 0 ? process.argv[i + 1] : null;
})();

async function fetchBytes(url) {
  const key = cacheDir && join(cacheDir, url.replace(/[^\w.-]+/g, "_").slice(-150));
  if (key && existsSync(key)) return readFileSync(key);
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (key) { mkdirSync(cacheDir, {recursive: true}); writeFileSync(key, bytes); }
  return bytes;
}

// The older NCEI files are Latin-1; decoding everything that way is harmless for ASCII data.
// Some carry a UTF-8 byte-order mark, which would hide the first line's `#`.
const fetchText = async (url, encoding = "utf8") =>
  (await fetchBytes(url)).toString(encoding).replace(/^(﻿|ï»¿)/, "");

// Minimal ustar reader: 512-byte headers, name at 0, size in octal at 124, then the data
// padded to 512. Enough for NOAA's tarball; prefixes and long names are not used there.
function untar(bytes) {
  const files = new Map();
  let off = 0;
  while (off + 512 <= bytes.length) {
    const name = bytes.toString("utf8", off, off + 100).replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(bytes.toString("utf8", off + 124, off + 136).replace(/\0.*$/s, ""), 8);
    const type = bytes[off + 156];
    if (type === 0x30 || type === 0) files.set(name.replace(/^.*\//, ""), bytes.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

// ---- small helpers ----------------------------------------------------------------------

const dataLines = text => text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
const cols = line => line.trim().split(/\s+/);
const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const monthIndex = (year, month) => year * 12 + (month - 1);

// Packs {monthIndex → ppm} into the compact monthly layout described at the top.
function packMonthly(map, round = r2) {
  const keys = [...map.keys()].sort((a, b) => a - b);
  if (!keys.length) return null;
  const first = keys[0], last = keys[keys.length - 1];
  const v = [];
  for (let m = first; m <= last; m++) v.push(map.has(m) ? round(map.get(m)) : null);
  return {year: Math.floor(first / 12), month: (first % 12) + 1, v};
}

// ---- NOAA trends files ------------------------------------------------------------------

async function noaaMonthly(file) {
  // year month decimal average ...; a negative average marks a missing month.
  const map = new Map();
  for (const line of dataLines(await fetchText(NOAA_TRENDS + file))) {
    const [y, m, , avg] = cols(line).map(Number);
    if (avg > 0) map.set(monthIndex(y, m), avg);
  }
  return packMonthly(map);
}

async function noaaWeekly() {
  // year month day decimal ppm ndays ...; -999.99 marks a missing week.
  const out = [];
  for (const line of dataLines(await fetchText(NOAA_TRENDS + "co2_weekly_mlo.txt"))) {
    const c = cols(line).map(Number);
    if (c[4] > 0) out.push([Math.round(c[3] * 10000) / 10000, r2(c[4])]);
  }
  return out;
}

// ---- NOAA marine boundary layer reference -----------------------------------------------

async function noaaMbl(endYear) {
  // The form page returns HTML with a link to a freshly generated file under tmp/.
  const page = await fetchText(NOAA_MBL + "ghg.php?hidden=true&param=CO2&reference_type=surface" +
    `&reference=global&startyear=1979&startmonth=1&endyear=${endYear}&endmonth=12`);
  const m = page.match(/href=['"](tmp\/[^'"]+_surface\.txt)['"]/);
  if (!m) throw new Error("MBL page has no link to a surface file");
  const text = await fetchText(NOAA_MBL + m[1]);
  const stepsLine = text.split("\n").find(l => l.includes("Sine of latitude steps"));
  const sinlat = stepsLine.split(":")[1].trim().split(/\s+/).map(Number);
  const t = [], v = [];
  let i = 0;
  for (const line of dataLines(text)) {
    // 48 steps a year; every second one is enough for the panel and halves the file.
    if (i++ % 2) continue;
    const c = cols(line).map(Number);
    t.push(Math.round(c[0] * 10000) / 10000);
    // Value and uncertainty alternate after the time; keep the values only.
    v.push(sinlat.map((_, k) => r1(c[1 + 2 * k])));
  }
  return {sinlat, t, v};
}

// ---- NOAA flask network -----------------------------------------------------------------

async function noaaFlaskSites() {
  const files = untar(gunzipSync(await fetchBytes(NOAA_FLASK)));
  const sites = [];
  for (const [name, bytes] of files) {
    const mm = name.match(/^co2_(\w+)_surface-flask_1_ccgg_month\.txt$/);
    if (!mm) continue;
    const code = mm[1];
    const map = new Map();
    for (const line of dataLines(bytes.toString("utf8"))) {
      const [, y, m, val] = cols(line);
      map.set(monthIndex(+y, +m), +val);
    }
    if (map.size < 60) continue;
    const event = files.get(name.replace("_month.txt", "_event.txt"));
    const header = event ? event.toString("utf8", 0, 4000) : "";
    const field = key => (header.match(new RegExp(`^# ${key} : (.*)$`, "m")) || [])[1]?.trim();
    let siteName = field("site_name"), lat = +field("site_latitude"), lon = +field("site_longitude");
    // Ship tracks (Pacific Ocean cruises and the South China Sea) are binned by latitude and
    // have no event file: poc000, pocn05, pocs35, scsn12 ... The latitude is in the code.
    const ship = code.match(/^(poc|scs)([ns]?)(\d{2,3})$/);
    if (ship) {
      lat = (ship[2] === "s" ? -1 : 1) * +ship[3];
      lon = null;
      siteName = `${ship[1] === "poc" ? "Pacific Ocean" : "South China Sea"}, ${Math.abs(lat)}°${lat < 0 ? "S" : lat > 0 ? "N" : ""}`;
    } else if (!siteName || !Number.isFinite(lat)) continue;
    sites.push({code: code.toUpperCase(), name: siteName, lat: r2(lat), lon: lon === null ? null : r2(lon),
      source: "noaa-flask", ...packMonthly(map, r1)});
  }
  return sites;
}

// ---- Scripps ----------------------------------------------------------------------------

async function scrippsMonthly(file, round = r2) {
  // Quoted header block, then: Yr, Mn, Excel date, decimal date, CO2, ... Missing values are
  // -99.99 or NaN. Column 5 is the measured monthly mean (not the filled one).
  const map = new Map();
  for (const line of (await fetchText(SCRIPPS + file)).split(/\r?\n/)) {
    if (!/^\s*\d{4},/.test(line)) continue;
    const c = line.split(",").map(s => s.trim());
    const val = Number(c[4]);
    if (Number.isFinite(val) && val > 0) map.set(monthIndex(+c[0], +c[1]), val);
  }
  return packMonthly(map, round);
}

async function scrippsSites() {
  const sites = [];
  for (const [code, file, name, lat, lon] of SCRIPPS_STATIONS) {
    const packed = await scrippsMonthly(file, r1);
    if (packed) sites.push({code: code.toUpperCase(), name, lat, lon, source: "scripps", ...packed});
  }
  return sites;
}

// ---- ice cores --------------------------------------------------------------------------

async function lawDome() {
  // Rubino et al. 2019: SampleID, age_ice, age_CO2, CO2ppm, CO2err (tab-separated).
  const samples = [];
  for (const line of dataLines(await fetchText(NCEI + "law/law2018co2.txt", "latin1"))) {
    const c = line.split("\t");
    if (c[0] === "SampleID") continue;
    const [age, ppm, err] = [c[2], c[3], c[4]].map(Number);
    if (Number.isFinite(age) && Number.isFinite(ppm)) samples.push([age, r2(ppm), r2(err)]);
  }
  samples.sort((a, b) => a[0] - b[0]);
  // Their 20-year spline: age_CO2, CO2spl, CO2gr, then the other gases.
  const spline = [];
  for (const line of dataLines(await fetchText(NCEI + "law/law2018splines.txt", "latin1"))) {
    const c = line.split("\t");
    if (c[0] === "age_CO2") continue;
    spline.push([+c[0], r2(+c[1])]);
  }
  return {samples, spline};
}

function siple() {
  return {
    neftel: SIPLE_NEFTEL.map(([lo, hi, ppm]) => [Math.round((lo + hi) / 2), lo, hi, ppm]),
    friedli: SIPLE_FRIEDLI,
  };
}

async function composite() {
  // Per-core rows keyed by every age column they carry (original and AICC2012 scales), so a
  // composite row can be traced back to its core.
  const byAge = new Map();
  for (const core of CORES) {
    for (const file of [core.file, core.plus].filter(Boolean)) {
      const lines = dataLines(await fetchText(NCEI + file, "latin1"));
      const header = lines[0].split("\t");
      const ageCols = header.map((h, i) => h === "age_gas_calBP" ? i : -1).filter(i => i >= 0);
      for (const line of lines.slice(1)) {
        const c = line.split("\t");
        for (const i of ageCols) {
          const age = Number(c[i]);
          if (Number.isFinite(age)) byAge.set(age.toFixed(2), core.name);
        }
      }
    }
  }
  const names = [...new Set(CORES.map(c => c.name))];
  const rows = [];
  let fallbacks = 0;
  for (const line of dataLines(await fetchText(NCEI + "antarctica2015co2composite.txt", "latin1"))) {
    const c = line.split("\t");
    if (c[0] === "age_gas_calBP") continue;
    const [age, ppm, sigma] = c.map(Number);
    let name = byAge.get(age.toFixed(2));
    if (!name) { fallbacks++; name = CORES.find(k => age / 1000 < k.until).name; }
    rows.push([Math.round((1950 - age) * 100) / 100, r2(ppm), Number.isFinite(sigma) ? r2(sigma) : null, names.indexOf(name)]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  process.stderr.write(`composite: ${rows.length} rows, ${fallbacks} labelled by age range\n`);
  return {cores: names, rows};
}

// ---- land outline for the inset map -----------------------------------------------------

// Decodes the `land` object of the 110 m TopoJSON already in the repo into one SVG path in
// plate carrée coordinates (x = longitude + 180, y = 90 - latitude), so the widget draws the
// map with a scale transform and no topojson-client at runtime.
function landPath() {
  const topo = JSON.parse(readFileSync(LAND, "utf8"));
  const {scale, translate} = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => [(x += dx) * scale[0] + translate[0], (y += dy) * scale[1] + translate[1]]);
  });
  const ring = indices => {
    const pts = [];
    for (const i of indices) {
      const arc = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      for (const p of arc) if (!pts.length || pts[pts.length - 1][0] !== p[0] || pts[pts.length - 1][1] !== p[1]) pts.push(p);
    }
    return pts;
  };
  // `land` is a GeometryCollection holding one MultiPolygon in this file; the loop below
  // also accepts a bare Polygon or MultiPolygon in case the TopoJSON is ever regenerated.
  const land = topo.objects.land;
  const geometries = land.type === "GeometryCollection" ? land.geometries : [land];
  const polygons = geometries.flatMap(g => g.type === "MultiPolygon" ? g.arcs : [g.arcs]);
  let d = "";
  for (const poly of polygons) {
    for (const ringIdx of poly) {
      const pts = ring(ringIdx).map(([lon, lat]) => [r1(lon + 180), r1(90 - lat)]);
      // Drop points that would not move the pen by a tenth of a degree.
      const kept = pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) >= 0.1 || Math.abs(p[1] - pts[i - 1][1]) >= 0.1);
      if (kept.length < 3) continue;
      d += "M" + kept.map(p => `${p[0]} ${p[1]}`).join("L") + "Z";
    }
  }
  return d;
}

// ---- main -------------------------------------------------------------------------------

const now = new Date();
const mloMonthly = await noaaMonthly("co2_mm_mlo.txt");
const mloWeekly = await noaaWeekly();
const globalMonthly = await noaaMonthly("co2_mm_gl.txt");
const flaskSites = await noaaFlaskSites();
const scripps = await scrippsSites();
const mbl = await noaaMbl(now.getFullYear());

// South Pole as one series: Scripps from 1957, overwritten by NOAA's flasks wherever they
// exist (from 1975), so the record ends with NOAA's still-running programme.
const spoMap = new Map();
for (const site of [scripps.find(s => s.code === "SPO"), flaskSites.find(s => s.code === "SPO")]) {
  const start = monthIndex(site.year, site.month);
  site.v.forEach((val, i) => { if (val !== null) spoMap.set(start + i, val); });
}

const lastWeek = mloWeekly[mloWeekly.length - 1][0];

const data = {
  meta: {
    generated: now.toISOString().slice(0, 10),
    latestWeek: lastWeek,
    sources: SOURCES,
    acknowledgement: "Inspired by Andy Jacobson's animation “History of atmospheric carbon dioxide”, " +
      "NOAA Global Monitoring Laboratory, https://gml.noaa.gov/ccgg/trends/history.html",
  },
  mlo: {monthly: mloMonthly, weekly: mloWeekly},
  spo: {monthly: packMonthly(spoMap)},
  global: {monthly: globalMonthly},
  mbl,
  sites: [...flaskSites, ...scripps].sort((a, b) => b.lat - a.lat),
  lawDome: await lawDome(),
  siple: siple(),
  composite: await composite(),
  land: landPath(),
};

mkdirSync(dirname(OUT), {recursive: true});
const json = JSON.stringify(data);
writeFileSync(OUT, json);

const kb = n => `${Math.round(n / 1024)} kB`;
process.stderr.write(
  `wrote ${OUT} (${kb(json.length)})\n` +
  `  mlo monthly ${data.mlo.monthly.year}-${data.mlo.monthly.month} +${data.mlo.monthly.v.length} months, ` +
  `weekly ${mloWeekly.length} rows to ${lastWeek}\n` +
  `  spo monthly from ${data.spo.monthly.year}-${data.spo.monthly.month}, ${data.spo.monthly.v.length} months\n` +
  `  mbl ${mbl.t.length} steps × ${mbl.sinlat.length} bins, ${mbl.t[0]}–${mbl.t[mbl.t.length - 1]} (${kb(JSON.stringify(mbl).length)})\n` +
  `  sites ${data.sites.length} (${flaskSites.length} NOAA, ${scripps.length} Scripps; ${kb(JSON.stringify(data.sites).length)})\n` +
  `  law dome ${data.lawDome.samples.length} samples, spline ${data.lawDome.spline.length}; siple ${SIPLE_NEFTEL.length + SIPLE_FRIEDLI.length}\n` +
  `  composite ${data.composite.rows.length} rows (${kb(JSON.stringify(data.composite).length)}); land ${kb(data.land.length)}\n`);
