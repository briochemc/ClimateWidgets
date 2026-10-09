"""Data for the extreme-events-cities widget: ERA5 daily maximum temperature from the
Open-Meteo historical weather API for a shortlist of cities, keeping each city's three
hottest months of the year, one array per season, in tenths of °C.

    python3 scripts/fetch-hot-season-tmax.py src/extreme-events-cities/data/hot-season-tmax.json

The shortlist is the capitals of the countries that send the most students to Australia
(src/extreme-events-cities/data/the-number-of-internatio.csv, from education.gov.au) plus
the four largest Australian cities, less a few capitals that would sit on top of a neighbour
on the widget's small map (Singapore under Kuala Lumpur, Thimphu between Kathmandu and
Dhaka, Phnom Penh beside Bangkok), plus a few more so that the map has Europe, Russia, the
Middle East, North and sub-Saharan Africa, the US west coast, the Arctic and both sides of
Antarctica. The hot season is the three consecutive calendar months
with the highest mean daily maximum over the whole record, so it is Dec–Feb in Sydney and
Apr–Jun in Delhi; a season that straddles the new year is labelled by the year of its last
month, and a season with fewer than 85 days is dropped.

The site never runs this script; the JSON is committed. It paces itself to stay under the
free tier's rate limit (which still bites after twenty-odd long requests in an hour: rerun
it later and it resumes from the existing file)."""
import json, sys, time, datetime, urllib.request, urllib.error, urllib.parse
from pathlib import Path

CITIES = [
    # name, country, lat, lon, IANA time zone
    ("Sydney", "Australia", -33.87, 151.21, "Australia/Sydney"),
    ("Melbourne", "Australia", -37.81, 144.96, "Australia/Melbourne"),
    ("Brisbane", "Australia", -27.47, 153.03, "Australia/Brisbane"),
    ("Perth", "Australia", -31.95, 115.86, "Australia/Perth"),
    ("Beijing", "China", 39.90, 116.40, "Asia/Shanghai"),
    ("New Delhi", "India", 28.61, 77.21, "Asia/Kolkata"),
    ("Kathmandu", "Nepal", 27.72, 85.32, "Asia/Kathmandu"),
    ("Hanoi", "Vietnam", 21.03, 105.85, "Asia/Ho_Chi_Minh"),
    ("Dhaka", "Bangladesh", 23.81, 90.41, "Asia/Dhaka"),
    ("Jakarta", "Indonesia", -6.21, 106.85, "Asia/Jakarta"),
    ("Manila", "Philippines", 14.60, 120.98, "Asia/Manila"),
    ("Bogotá", "Colombia", 4.71, -74.07, "America/Bogota"),
    ("Islamabad", "Pakistan", 33.69, 73.04, "Asia/Karachi"),
    ("Colombo", "Sri Lanka", 6.93, 79.85, "Asia/Colombo"),
    ("Brasília", "Brazil", -15.79, -47.88, "America/Sao_Paulo"),
    ("Bangkok", "Thailand", 13.76, 100.50, "Asia/Bangkok"),
    ("Seoul", "South Korea", 37.57, 126.98, "Asia/Seoul"),
    ("Kuala Lumpur", "Malaysia", 3.14, 101.69, "Asia/Kuala_Lumpur"),
    ("Taipei", "Taiwan", 25.03, 121.57, "Asia/Taipei"),
    ("Hong Kong", "Hong Kong", 22.32, 114.17, "Asia/Hong_Kong"),
    ("Tokyo", "Japan", 35.68, 139.69, "Asia/Tokyo"),
    ("Nairobi", "Kenya", -1.29, 36.82, "Africa/Nairobi"),
    ("Washington", "United States", 38.91, -77.04, "America/New_York"),
    ("Ulaanbaatar", "Mongolia", 47.92, 106.92, "Asia/Ulaanbaatar"),
    ("Santiago", "Chile", -33.45, -70.67, "America/Santiago"),
    ("Ottawa", "Canada", 45.42, -75.70, "America/Toronto"),
    # Beyond the shortlist, for the map's sake: Europe, the Middle East, Africa, the US west
    # coast, and one station at each pole.
    ("London", "United Kingdom", 51.51, -0.13, "Europe/London"),
    ("Paris", "France", 48.86, 2.35, "Europe/Paris"),
    ("Madrid", "Spain", 40.42, -3.70, "Europe/Madrid"),
    ("Berlin", "Germany", 52.52, 13.41, "Europe/Berlin"),
    ("Stockholm", "Sweden", 59.33, 18.07, "Europe/Stockholm"),
    ("Moscow", "Russia", 55.76, 37.62, "Europe/Moscow"),
    ("Istanbul", "Turkey", 41.01, 28.98, "Europe/Istanbul"),
    ("Baghdad", "Iraq", 33.31, 44.37, "Asia/Baghdad"),
    ("Riyadh", "Saudi Arabia", 24.71, 46.68, "Asia/Riyadh"),
    ("Tehran", "Iran", 35.69, 51.39, "Asia/Tehran"),
    ("Cairo", "Egypt", 30.04, 31.24, "Africa/Cairo"),
    ("Marrakesh", "Morocco", 31.63, -8.01, "Africa/Casablanca"),
    ("Algiers", "Algeria", 36.75, 3.06, "Africa/Algiers"),
    ("Tripoli", "Libya", 32.90, 13.19, "Africa/Tripoli"),
    ("Abuja", "Nigeria", 9.06, 7.49, "Africa/Lagos"),
    ("Cape Town", "South Africa", -33.93, 18.42, "Africa/Johannesburg"),
    ("Los Angeles", "United States", 34.05, -118.24, "America/Los_Angeles"),
    ("Seattle", "United States", 47.61, -122.33, "America/Los_Angeles"),
    ("Longyearbyen", "Svalbard", 78.22, 15.63, "Arctic/Longyearbyen"),
    ("Nuuk", "Greenland", 64.18, -51.72, "America/Nuuk"),
    ("Casey Station", "Antarctica", -66.28, 110.53, "Antarctica/Casey"),
    # Inland West Antarctica, 1,530 m up on the ice sheet; no IANA zone of its own, so the
    # fixed offset nearest its longitude (the day boundary hardly matters in the polar day).
    ("Byrd Station", "Antarctica", -80.02, -119.53, "Etc/GMT+8"),
]
END = "2026-09-30"  # ERA5 lags a few days; the last season must be complete
MIN_DAYS = 85

out = Path(sys.argv[1])
done = {}
if out.exists():
    done = {c["name"]: c for c in json.loads(out.read_text())["cities"]}

def get(url):
    # The hourly quota, once hit, takes up to an hour to clear: keep trying every five minutes.
    for attempt in range(24):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            print(f"  429, waiting 300s (attempt {attempt + 1})", flush=True)
            time.sleep(300)
    raise RuntimeError("gave up")

# ---- the cities --------------------------------------------------------------------------------
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
cities = []

def save():
    # After every fetch, so that a run cut short by the rate limit keeps what it has.
    out.write_text(json.dumps({
        "source": "ERA5 via Open-Meteo historical weather API, daily temperature_2m_max",
        "fetched": datetime.date.today().isoformat(), "units": "tenths of °C",
        "cities": cities}, separators=(",", ":"), ensure_ascii=False))

for name, country, lat, lon, tz in CITIES:
    if name in done:
        cities.append(done[name]); continue
    url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
           f"&start_date=1940-01-01&end_date={END}&daily=temperature_2m_max&timezone={urllib.parse.quote(tz, safe='')}")
    print(name, flush=True)
    d = get(url)
    t, x = d["daily"]["time"], d["daily"]["temperature_2m_max"]
    days = [(int(ti[:4]), int(ti[5:7]), v) for ti, v in zip(t, x) if v is not None]
    # The three hottest consecutive months, by the mean daily maximum over the whole record.
    by_month = [[v for y, m, v in days if m == k] for k in range(1, 13)]
    clim = [sum(v) / len(v) for v in by_month]
    m0 = max(range(12), key=lambda k: clim[k] + clim[(k + 1) % 12] + clim[(k + 2) % 12])
    months = [(m0 + i) % 12 + 1 for i in range(3)]
    wraps = months[0] > months[-1]
    seasons = {}
    for y, m, v in days:
        if m not in months:
            continue
        sy = y + 1 if wraps and m >= months[0] else y
        seasons.setdefault(sy, []).append(round(v * 10))
    years = sorted(y for y, s in seasons.items() if len(s) >= MIN_DAYS)
    label = f"{MONTHS[months[0] - 1]}–{MONTHS[months[-1] - 1]}"
    cities.append({"name": name, "country": country, "lat": lat, "lon": lon, "elevation": d.get("elevation"),
                   "months": months, "season": label, "years": years, "days": [seasons[y] for y in years]})
    print(f"  {label}: {len(years)} seasons, {years[0]}–{years[-1]}", flush=True)
    save()
    time.sleep(12)
# Written once more at the end: the cities after the last one fetched (already in the file
# from an earlier run) are otherwise left out of it.
save()
print("done")
