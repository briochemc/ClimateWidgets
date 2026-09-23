"""Precomputes the per-gas clear-sky transmittance of the atmosphere for the
atmospheric-transmission widget, and writes src/atmospheric-transmission/data/transmission.json.

What is computed. For each of H2O, CO2, O3, N2O, CH4 and O2 the vertical column optical
depth tau_g(nu) of a layered atmosphere (0 to 60 km, 26 layers) is summed from the HITRAN
line list, broadened for each layer's pressure and temperature by RADIS (Voigt lines, no
continuum, no line mixing). The transmittance exp(-tau_g) is then averaged over 3,000
wavelength bins, log-spaced from 0.05 to 100 um (the black-body widget's axis), and written
to 3 decimals. CO2, CH4 and N2O are each done at three amounts (1750, today, doubled), which
is a rescaling of the same optical depth. Two things HITRAN lines do not cover are added: the
ozone Hartley, Huggins and Chappuis bands, from the Serdyuchenko et al. (2014) cross-sections
at 223 K (213 to 1100 nm); and, as a rule, everything below 0.2 um is opaque (O2's
Schumann-Runge bands and continuum). Rayleigh scattering is the Bodhaine et al. (1999) formula
down to 0.2 um and lambda^-4 below that.

Profiles. Temperature and pressure are the US Standard Atmosphere 1976. The water vapour
and ozone mixing-ratio profiles approximate the AFGL US Standard tables (Anderson et al.
1986) and are then scaled to a 25 kg/m^2 water column (the global mean) and a 300 DU ozone
column. CO2, CH4 and N2O are today's NOAA global means, well mixed (CH4 and N2O fall off
above the tropopause).

Known limits, all disclosed on the widget's page: no water-vapour continuum (MT_CKD), so the
8-13 um window is too clean; the product of binned per-gas transmittances is not the binned
product where bands overlap; vertical path, not the Sun's slant path; the top layers' narrow
lines are undersampled on the 0.01 cm^-1 grid (RADIS conserves their area).

Run once, offline (it takes a few minutes and downloads the HITRAN lines on first use):

    uv venv --python 3.11 .venv-radis
    uv pip install --python .venv-radis/bin/python "numba==0.60.0" "llvmlite==0.43.0" "numpy<2.1" radis
    .venv-radis/bin/python scripts/atmospheric-transmission.py

(The numba pin is for an Intel Mac, where newer llvmlite has no prebuilt wheel.)
"""

import json
import os
import sys
import time
import urllib.request
from datetime import date

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "atmospheric-transmission", "data", "transmission.json")
O3_XSEC_URL = ("https://uv-vis-spectral-atlas-mainz.org/uvvis_data/cross_sections/Ozone/"
               "O3_Serdyuchenko(2014)_223K_213-1100nm(2013%20version).txt")
O3_XSEC_FILE = os.path.join(ROOT, "data", "O3_Serdyuchenko2014_223K_213-1100nm.txt")

# ---- the output grid ----------------------------------------------------------------------
LAMBDA_MIN, LAMBDA_MAX, BINS = 0.05, 100.0, 3000   # um; same axis as the black-body widget
LOG_SPAN = np.log(LAMBDA_MAX / LAMBDA_MIN)
def bin_index(lam_um):
    return np.floor(BINS * np.log(lam_um / LAMBDA_MIN) / LOG_SPAN).astype(int)
bin_centres = LAMBDA_MIN * np.exp((np.arange(BINS) + 0.5) / BINS * LOG_SPAN)

# ---- the line-by-line grid -----------------------------------------------------------------
NU_MIN = 1e4 / LAMBDA_MAX * 0.99      # just past the long-wavelength edge of the axis
WSTEP = 0.01                          # cm^-1; surface Voigt widths are ~0.05-0.1 cm^-1
CHUNK = 500.0                         # cm^-1 per RADIS call, to bound memory (ozone's line
                                      # list is dense: 2000 cm^-1 chunks took 6 GB and swapped)
# Where each gas's HITRAN2020 line list ends (cm^-1). Beyond it the gas is transparent, bar the
# ozone cross-sections and the sub-0.2 um rule.
LINE_LIMIT = {"H2O": 25711, "CO2": 14076, "O3": 6997, "N2O": 7797, "CH4": 11502, "O2": 17273}

# ---- atmosphere -----------------------------------------------------------------------------
KB = 1.380649e-23
DU = 2.6867e16          # molecules per cm^2 in one Dobson unit
M_H2O = 18.015e-3 / 6.02214076e23  # kg per molecule

def us76(z_km):
    """US Standard Atmosphere 1976: (T in K, p in hPa) at geopotential height z."""
    bases = [(0, 288.15, 1013.25, -6.5), (11, 216.65, 226.32, 0.0), (20, 216.65, 54.749, 1.0),
             (32, 228.65, 8.6802, 2.8), (47, 270.65, 1.1091, 0.0), (51, 270.65, 0.66939, -2.8),
             (71, 214.65, 0.039564, -2.0)]
    g0, R, M = 9.80665, 8.31446, 0.0289644
    for zb, Tb, pb, L in reversed(bases):
        if z_km >= zb:
            dz = (z_km - zb) * 1000
            if L == 0:
                return Tb, pb * np.exp(-g0 * M * dz / (R * Tb))
            T = Tb + L / 1000 * dz
            return T, pb * (T / Tb) ** (-g0 * M / (R * L / 1000))
    raise ValueError(z_km)

# Approximations to the AFGL US Standard (1976) profiles of Anderson et al. (1986), ppmv by
# height in km; interpolated in log. The columns are rescaled below, so only the shape counts.
AFGL_Z = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 60]
AFGL_H2O = [7745, 6071, 4631, 3182, 2158, 1397, 925.4, 572.0, 366.7, 158.3, 69.96, 36.13,
            19.06, 10.85, 5.927, 5.000, 3.950, 3.850, 3.825, 3.850, 3.900, 3.975, 4.065,
            4.200, 4.300, 4.425, 4.600, 4.900, 5.200, 5.500, 5.900, 6.0]
AFGL_O3 = [0.0266, 0.0293, 0.0324, 0.0332, 0.0339, 0.0377, 0.0411, 0.0501, 0.0581, 0.0729,
           0.0900, 0.1319, 0.2001, 0.2622, 0.3364, 0.4596, 0.6007, 0.7719, 1.020, 1.394,
           1.822, 2.313, 2.917, 3.514, 4.019, 4.499, 6.0, 7.6, 6.9, 4.5, 2.6, 0.6]
def profile(table, z):
    return np.exp(np.interp(z, AFGL_Z, np.log(table))) * 1e-6

# Today's global means (NOAA GML, 2025), dry-air mole fractions.
CO2_TODAY, CH4_TODAY, N2O_TODAY = 428e-6, 1939e-9, 340e-9
# The three amounts each long-lived greenhouse gas is offered at: 1750 (IPCC AR6, the same
# values as the composition widget), today, and twice today. The line-by-line run is done
# at today's amount and the optical depth rescaled, since it is linear in the amount.
LEVELS = {
    "CO2": ("ppm", CO2_TODAY * 1e6, [(278, "1750"), (428, "today"), (856, "doubled")]),
    "CH4": ("ppb", CH4_TODAY * 1e9, [(729, "1750"), (1939, "today"), (3878, "doubled")]),
    "N2O": ("ppb", N2O_TODAY * 1e9, [(270, "1750"), (340, "today"), (680, "doubled")]),
}
O2 = 0.20946
H2O_COLUMN_KG = 25.0    # kg per m^2, the global mean
O3_COLUMN_DU = 300.0

# Layer edges, km: 1 km steps in the troposphere, 2 km to 30 km, coarser above.
EDGES = list(range(0, 13)) + list(range(14, 31, 2)) + [35, 40, 45, 50, 60]

def build_layers():
    layers = []
    for lo, hi in zip(EDGES[:-1], EDGES[1:]):
        z = (lo + hi) / 2
        T, p = us76(z)
        n = p * 100 / (KB * T)               # molecules per m^3 of air
        dz = (hi - lo) * 1000                # m
        x = {
            "H2O": profile(AFGL_H2O, z),
            "O3": profile(AFGL_O3, z),
            "CO2": CO2_TODAY,
            "CH4": CH4_TODAY * (1 if z < 15 else np.exp(-(z - 15) / 12)),
            "N2O": N2O_TODAY * (1 if z < 15 else np.exp(-(z - 15) / 8)),
            "O2": O2,
        }
        layers.append({"z": z, "T": T, "p_bar": p / 1000, "dz_cm": dz * 100, "n_dz": n * dz, "x": x})
    # Rescale the two variable gases to the columns wanted.
    h2o = sum(L["x"]["H2O"] * L["n_dz"] for L in layers) * M_H2O
    o3 = sum(L["x"]["O3"] * L["n_dz"] for L in layers) * 1e-4 / DU
    for L in layers:
        L["x"]["H2O"] *= H2O_COLUMN_KG / h2o
        L["x"]["O3"] *= O3_COLUMN_DU / o3
    print(f"{len(layers)} layers; unscaled columns: H2O {h2o:.1f} kg/m2, O3 {o3:.0f} DU; "
          f"surface H2O now {layers[0]['x']['H2O'] * 1e6:.0f} ppmv", flush=True)
    return layers

# ---- line-by-line ---------------------------------------------------------------------------
def column_transmittance(molecule, layers):
    """Bin-averaged transmittance, or for a gas in LEVELS one per amount (the optical depth
    rescaled before averaging)."""
    from radis import SpectrumFactory
    from radis.misc.warning import EmptyDatabaseError
    sums = np.zeros(BINS); counts = np.zeros(BINS)
    if molecule in LEVELS:
        _, today, amounts = LEVELS[molecule]
        tau_sums = {lvl: np.zeros(BINS) for lvl, _ in amounts}
    else:
        tau_sums = None
    lo = NU_MIN
    while lo < LINE_LIMIT[molecule]:
        hi = min(lo + CHUNK, LINE_LIMIT[molecule] + 50)
        t0 = time.time()
        try:
            sf = SpectrumFactory(wavenum_min=lo, wavenum_max=hi, molecule=molecule, isotope="1,2,3",
                                 wstep=WSTEP, truncation=50, neighbour_lines=50, pressure=1.0,
                                 verbose=0, warnings={"AccuracyWarning": "ignore", "AccuracyError": "ignore"})
            sf.fetch_databank("hitran")
            tau = None
            for L in layers:
                s = sf.eq_spectrum(Tgas=L["T"], pressure=L["p_bar"], mole_fraction=L["x"][molecule],
                                   path_length=L["dz_cm"])
                nu, A = s.get("absorbance", wunit="cm-1")
                tau = A if tau is None else tau + A
        except EmptyDatabaseError:
            print(f"  {molecule} {lo:.0f}-{hi:.0f}: no lines", flush=True)
            lo = hi
            continue
        idx = bin_index(1e4 / nu)
        ok = (idx >= 0) & (idx < BINS)
        idx = idx[ok]; tau = tau[ok]
        if tau_sums is not None:
            for lvl in tau_sums:
                tau_sums[lvl] += np.bincount(idx, weights=np.exp(-tau * lvl / today), minlength=BINS)
        sums += np.bincount(idx, weights=np.exp(-tau), minlength=BINS)
        counts += np.bincount(idx, minlength=BINS)
        print(f"  {molecule} {lo:.0f}-{hi:.0f} cm-1: {len(nu)} points, {time.time() - t0:.1f} s", flush=True)
        lo = hi
    with np.errstate(invalid="ignore"):
        T = np.where(counts > 0, sums / np.maximum(counts, 1), 1.0)
        if tau_sums is None:
            return T
        return {lvl: np.where(counts > 0, tau_sums[lvl] / np.maximum(counts, 1), 1.0) for lvl in tau_sums}

def ozone_uv(T_o3):
    """Multiply in the Hartley, Huggins and Chappuis bands from the cross-sections."""
    if not os.path.exists(O3_XSEC_FILE):
        print("downloading the ozone cross-sections", flush=True)
        os.makedirs(os.path.dirname(O3_XSEC_FILE), exist_ok=True)
        urllib.request.urlretrieve(O3_XSEC_URL, O3_XSEC_FILE)
    nm, sigma = np.loadtxt(O3_XSEC_FILE, unpack=True)   # nm, cm^2 per molecule
    N = O3_COLUMN_DU * DU
    idx = bin_index(nm / 1000)
    ok = (idx >= 0) & (idx < BINS)
    sums = np.bincount(idx[ok], weights=np.exp(-sigma[ok] * N), minlength=BINS)
    counts = np.bincount(idx[ok], minlength=BINS)
    T = T_o3.copy()
    covered = counts > 0
    T[covered] *= sums[covered] / counts[covered]
    T[bin_centres < nm[0] / 1000] = 0.0   # the Hartley band goes on below 213 nm
    return T

RAYLEIGH_FIT_MIN = 0.2   # um; the fit below is for the near-UV to the near-IR

def rayleigh():
    """Bodhaine et al. (1999) eq. 30: vertical optical depth at sea level, lambda in um.

    The fit is a ratio of two quadratics in 1/lambda^2 whose denominator has a pole at
    0.118 um: below it the ratio goes negative, so used as it stands it makes the air
    transparent again in the far ultraviolet. Below RAYLEIGH_FIT_MIN the fit is replaced by
    Rayleigh's own lambda^-4 law, continued from the fit's value there."""
    l = bin_centres
    def fit(l):
        return 0.0021520 * (1.0455996 - 341.29061 / l**2 - 0.90230850 * l**2) / (1 + 0.0027059889 / l**2 - 85.968563 * l**2)
    tau = np.where(l >= RAYLEIGH_FIT_MIN, fit(np.maximum(l, RAYLEIGH_FIT_MIN)), fit(RAYLEIGH_FIT_MIN) * (RAYLEIGH_FIT_MIN / l) ** 4)
    return np.exp(-np.maximum(tau, 0))

# ---- main -------------------------------------------------------------------------------------
def main():
    import radis
    layers = build_layers()
    gases = []
    order = [
        ("H2O", "h2o", "Water vapour", "H₂O", f"{H2O_COLUMN_KG:.0f} kg m⁻² column (global mean)"),
        ("CO2", "co2", "Carbon dioxide", "CO₂", None),
        ("O3", "o3", "Ozone", "O₃", f"{O3_COLUMN_DU:.0f} Dobson units, mostly at 15–35 km"),
        ("CH4", "ch4", "Methane", "CH₄", None),
        ("N2O", "n2o", "Nitrous oxide", "N₂O", None),
        ("O2", "o2", "Oxygen", "O₂", "20.9%"),
    ]
    t_all = time.time()
    for molecule, key, name, formula, amount in order:
        print(f"{molecule}:", flush=True)
        t0 = time.time()
        result = column_transmittance(molecule, layers)
        entry = {"key": key, "name": name, "formula": formula}
        if molecule in LEVELS:
            unit, _, amounts = LEVELS[molecule]
            entry["variants"] = [
                {"label": f"{lvl} {unit}", "note": note, "transmittance": result[lvl]} for lvl, note in amounts
            ]
            entry["default"] = 1
        else:
            T = result
            if molecule == "O3":
                T = ozone_uv(T)
            if molecule == "O2":
                T[bin_centres < 0.2] = 0.0
            entry["amount"] = amount
            entry["transmittance"] = T
        gases.append(entry)
        print(f"  done in {time.time() - t0:.0f} s", flush=True)
    gases.append({"key": "rayleigh", "name": "Rayleigh scattering", "formula": "Rayleigh",
                  "amount": "sea-level column, all molecules", "transmittance": rayleigh()})

    def rounded(a):
        return [float(f"{v:.3f}") for v in a]
    for g in gases:
        if "variants" in g:
            for v in g["variants"]:
                v["transmittance"] = rounded(v["transmittance"])
        else:
            g["transmittance"] = rounded(g["transmittance"])

    out = {
        "about": {
            "generated": date.today().isoformat(),
            "lines": f"HITRAN2020 via RADIS {radis.__version__}, Voigt lines, isotopologues 1–3, "
                     f"{WSTEP} cm⁻¹ grid, no continuum, no line mixing",
            "atmosphere": f"US Standard Atmosphere 1976, {len(layers)} layers from 0 to {EDGES[-1]} km; "
                          f"water vapour and ozone profiles after AFGL US Standard, scaled to "
                          f"{H2O_COLUMN_KG:.0f} kg m⁻² and {O3_COLUMN_DU:.0f} DU; CO₂ {CO2_TODAY*1e6:.0f} ppm, "
                          f"CH₄ {CH4_TODAY*1e9:.0f} ppb, N₂O {N2O_TODAY*1e9:.0f} ppb",
            "ultraviolet": "O₃ Hartley, Huggins and Chappuis bands from Serdyuchenko et al. (2014) "
                           "cross-sections at 223 K; below 0.2 μm O₂ and O₃ are set opaque",
            "rayleigh": f"Bodhaine et al. (1999) eq. 30 for a vertical column at sea level, extrapolated as λ⁻⁴ below {RAYLEIGH_FIT_MIN} μm",
            "binning": f"mean transmittance over {BINS} log-spaced wavelength bins, "
                       f"{LAMBDA_MIN} to {LAMBDA_MAX} μm, 3 decimals",
            "path": "vertical, clear sky, no re-emission",
        },
        "lambdaMin": LAMBDA_MIN, "lambdaMax": LAMBDA_MAX, "bins": BINS,
        "gases": gases,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1e3:.0f} kB) in {time.time() - t_all:.0f} s")

if __name__ == "__main__":
    main()
