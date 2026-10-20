# Derives the temperature-history widget's data file from the spreadsheet behind Glen Fergus's
# figure "All palaeotemps" (CC BY-SA), the one on Wikimedia Commons:
#
#   https://commons.wikimedia.org/wiki/File:All_palaeotemps.svg
#   https://web.archive.org/web/20220830172205/http://gergs.net/wp-content/uploads/2015/06/All_palaeotemps.xlsx
#
# The workbook's "Data compilation" sheet holds every record already converted to a global
# temperature anomaly against the 1960-1990 average, with ages in thousands of years before
# 2015, and already scaled as the figure plots them: the two Antarctic and Greenland ice-core
# records halved for polar amplification ("x 0.5"), the Phanerozoic curves of Royer et al.
# doubled ("x 2.0"). This script just takes those columns as they are. The figure's
# description on Commons says what each record is and how it was treated; the widget's page
# points there rather than repeating it.
#
# The sheet also carries a Cretaceous record (Friedrich et al. 2012) that the figure does not
# draw, so it is left out here too.
#
# The one record that has moved on since 2015 is the thermometer one. The figure's Berkeley
# Earth decadal means (from a 2014 download) are replaced by Berkeley Earth's current global
# land-ocean monthly series, which runs to the latest month:
#
#   https://storage.googleapis.com/berkeley-earth-temperature-hr/global/Global_TAVG_monthly.txt
#
# the high-resolution (0.25°) product that Berkeley Earth now updates in place of the old
# 1° one, which stopped at December 2024. It is downloaded here unless a local copy is given
# (the file has no CORS headers, so the page cannot fetch it live the way the CO₂ widget
# fetches NOAA's). Its anomalies are against 1951-1980; the widget shifts them to the
# figure's 1960-1990 baseline itself, from the data, and derives the annual and decadal means.
#
# Needs openpyxl. From the repo root:
#   python3 -m venv .venv && .venv/bin/pip install openpyxl
#   .venv/bin/python scripts/temperature-history.py <All_palaeotemps.xlsx> [Global_TAVG_monthly.txt]
# which writes src/temperature-history/data/temperature-history.json.

import json
import os
import sys
import urllib.request

import openpyxl
from openpyxl.utils import column_index_from_string

PRESENT = 2015   # the figure's "present": ages are thousands of years before this
BERKELEY_URL = "https://storage.googleapis.com/berkeley-earth-temperature-hr/global/Global_TAVG_monthly.txt"

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "temperature-history", "data",
                   "temperature-history.json")


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def main(path, berkeley_path=None):
    if berkeley_path:
        with open(berkeley_path, encoding="utf-8", errors="replace") as f:
            berkeley_text = f.read()
    else:
        print("downloading", BERKELEY_URL)
        with urllib.request.urlopen(BERKELEY_URL) as r:
            berkeley_text = r.read().decode("utf-8", errors="replace")

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Data compilation"]
    rows = list(ws.iter_rows(min_row=4, values_only=True))

    def col(letter):
        i = column_index_from_string(letter) - 1
        return [r[i] if i < len(r) else None for r in rows]

    # [age kyr, value...] rows, sorted by age, rounded; a row needs a numeric age and value.
    # The two ice cores open with a few rows at the very top of the core whose isotope cell
    # is blank, which the sheet's formula turns into an anomaly of exactly zero; those are
    # dropped, so the records start at their first real sample.
    def series(age_col, value_cols, age_scale=1, decimals=2, age_decimals=3, drop_leading_zeros=False):
        ages = col(age_col)
        values = [col(c) for c in value_cols]
        out = []
        for i, a in enumerate(ages):
            if not num(a):
                continue
            vs = [v[i] for v in values]
            if not num(vs[0]):
                continue
            out.append([round(a * age_scale, age_decimals)] +
                       [round(v, decimals) if num(v) else None for v in vs])
        out.sort(key=lambda r: r[0])
        if drop_leading_zeros:
            while out and out[0][1] == 0:
                out.pop(0)
        return out

    data = {
        "present": PRESENT,
        "units": "°C anomaly from the 1960–1990 average; ages in thousands of years before 2015",
        "source": "https://commons.wikimedia.org/wiki/File:All_palaeotemps.svg",
        # Royer et al. (2004): ages in Myr on a 10-Myr grid. Columns: the GEOCARB III + Horita
        # curve, the CO2-proxy curve, and the lower and upper bounds of the orange band (the
        # sheet stores the band as its lower bound and its height). All already doubled.
        "royer": {
            "columns": ["age kyr", "GEOCARB", "proxies", "band low", "band high"],
            "rows": royer(col),
        },
        # Zachos et al. (2008) as interpreted by Hansen et al. (2013): the Cenozoic.
        "zachos": series("P", ["T"]),
        # Lisiecki and Raymo (2005) benthic stack, Hansen et al. (2013) interpretation.
        "lisieckiRaymo": series("W", ["AA"]),
        # EPICA Dome C, Antarctica, halved.
        "epica": series("AC", ["AE"], drop_leading_zeros=True),
        # NGRIP, Greenland, halved.
        "ngrip": series("AG", ["AK"], drop_leading_zeros=True),
        # Marcott et al. (2013) Holocene stack: value and 1-sigma.
        "marcott": series("AM", ["AN", "AO"]),
        # Berkeley Earth global land-ocean, monthly anomalies against 1951-1980, packed as
        # {year, month, v: [...]} from the first month, null where a month is missing.
        "berkeley": berkeley(berkeley_text),
        # IPCC AR5 RCP8.5 projections, by year CE.
        "ipcc": {
            "columns": ["year CE", "T"],
            "rows": sorted({(r[0], round(r[1], 2)) for r in zip(col("AU"), col("AW")) if num(r[0]) and num(r[1])}),
        },
    }

    for k in ("zachos", "lisieckiRaymo", "epica", "ngrip", "marcott"):
        print(f"{k}: {len(data[k])} rows, {data[k][0][0]}–{data[k][-1][0]} kyr")
    b = data["berkeley"]
    last = b["year"] * 12 + b["month"] - 1 + len(b["v"]) - 1
    print(f"royer: {len(data['royer']['rows'])} rows; ipcc: {len(data['ipcc']['rows'])}; "
          f"berkeley: {len(b['v'])} months, {b['year']}-{b['month']:02d} to {last // 12}-{last % 12 + 1:02d}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print("wrote", os.path.normpath(OUT), os.path.getsize(OUT) // 1024, "KB")


def royer(col):
    ages, geocarb, proxies, low, height = (col(c) for c in "ABCDE")
    out = []
    for i, a in enumerate(ages):
        if not num(a):
            continue
        g, p, lo, h = geocarb[i], proxies[i], low[i], height[i]
        if not any(num(v) for v in (g, p, lo)):
            continue
        out.append([
            round(a * 1000, 3),
            round(g, 2) if num(g) else None,
            round(p, 2) if num(p) else None,
            round(lo, 2) if num(lo) else None,
            round(lo + h, 2) if num(lo) and num(h) else None,
        ])
    out.sort(key=lambda r: r[0])
    return out


def berkeley(text):
    # Data lines: year, month, monthly anomaly, uncertainty, then the moving averages. The
    # file has two sections (air and water temperature over sea ice); the first is the one
    # Berkeley Earth reports, and the second repeats the same months, so a month already
    # seen is left as it was.
    months = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("%"):
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        try:
            year, month, v = int(parts[0]), int(parts[1]), float(parts[2])
        except ValueError:
            continue
        key = year * 12 + month - 1
        if key not in months and v == v:   # not NaN
            months[key] = round(v, 3)
    first, last = min(months), max(months)
    return {
        "source": BERKELEY_URL,
        "baseline": "1951-1980",
        "year": first // 12,
        "month": first % 12 + 1,
        "v": [months.get(k) for k in range(first, last + 1)],
    }


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit("usage: temperature-history.py <All_palaeotemps.xlsx> [Global_TAVG_monthly.txt]")
    main(*sys.argv[1:])
