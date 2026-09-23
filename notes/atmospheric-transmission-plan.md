# Atmospheric transmission widget — quick plan

*Written 2026-09-22. Status: first prototype built 2026-09-23 along option C with RADIS (`scripts/atmospheric-transmission.py`, `src/atmospheric-transmission/`). What was decided on the way: 26 layers 0–60 km, 0.01 cm⁻¹ grid, 3,000 bins; CO₂ at 278/428/856 ppm by rescaling one optical depth; ozone UV from the Serdyuchenko 223 K cross-sections; below 0.2 μm opaque; no continuum yet. Read-outs with everything on: 73% of sunlight reaches the ground, 28% of the surface glow escapes (Rohde: 70–75% and 15–30%; the continuum would bring the second down). RADIS runs 20 layers of the 15 μm band in about a second, 200× faster than HAPI; on an Intel Mac it needs Python 3.11 and numba 0.60 pinned. No log/linear morph in the prototype. Revised the same day: the middle panel shows the absorbed fraction instead of the transmitted one, the gas colours are the composition widget's, the Sun and Earth curves are fills (no lines) with the black-body widget's spectrum and axis title, a slider moves the surface temperature over 210–310 K, the tour walks six presets (none, CO₂ only, water only, all but water, all but CO₂, all) instead of adding gases one by one, and the Rayleigh column below 0.2 μm was recomputed as λ⁻⁴ because the Bodhaine fit has a pole at 0.118 μm and went transparent below it.*

## Concept

An interactive version of Robert Rohde's [Atmospheric Transmission](https://commons.wikimedia.org/wiki/File:Atmospheric_Transmission-en.svg) figure (Global Warming Art; English SVG is CC0): the Sun's and the Earth's Planck curves on the black-body widget's logarithmic wavelength axis, with the part of each that gets through the atmosphere shaded, and one absorption row per atmospheric constituent that can be switched on and off. Switching a gas off removes its bands from the total and the shaded areas grow. Sun and Earth's surface only; no slider.

## What Rohde did, and the options for making the bands

Rohde's data came from GATS's Spectral Calculator: the open HITRAN line list (positions, strengths and widths of every absorption line of every gas) run through GATS's proprietary LINEPAK code, which broadens each line for pressure and temperature, sums them into an absorption coefficient and applies Beer–Lambert through the column. Spectral Calculator is a subscription tool, but the code half is a standard calculation with several open-source equivalents, and the data half (HITRAN) is free. Nothing downloadable exists per gas over 0.2–70 μm for a sea-level column: astronomy transmission tables (Gemini, ESO SkyCalc, ATRAN) are for dry high sites and stop at 0.9 μm; the [UChicago MODTRAN app](https://climatemodels.uchicago.edu/modtran/) gives only the total upgoing radiance over 100–1500 cm⁻¹.

Four ways to get the bands, cheapest first:

| | Method | Effort | Fidelity |
|---|---|---|---|
| A | **Schematic bands from a table** of band centres and widths (CO₂ 2.7, 4.3, 15 μm; H₂O 0.94, 1.1, 1.4, 1.9, 2.7, 6.3 μm and the rotational band beyond 20 μm; O₃ 9.6 μm and the UV; CH₄ 3.3, 7.7 μm; N₂O 4.5, 7.8, 17 μm; O₂ 0.76, 1.27 μm), drawn as smooth dips | hours | cartoon, must be labelled schematic |
| B | **Trace Rohde's figure.** The CC0 SVG is itself a hand tracing of his PNG (the water-vapour curve is 44 straight segments and 31 Béziers), so this is A with his shapes | hours | cartoon, but his cartoon |
| C | **Open line-by-line code on HITRAN**, the open equivalent of Spectral Calculator: [HAPI](https://hitran.org/hapi/) (HITRAN's own single-file Python), [RADIS](https://radis.readthedocs.io/) (Python, faster), [Bytran](https://www.bytran.org/) (open-source app), [LBLRTM](https://github.com/AER-RC/LBLRTM) (AER's Fortran reference code), HITRAN.jl (Julia, maturity unchecked). Layered atmosphere, UV cross-sections and Rayleigh are ours to add | a day or two | real spectra at any resolution, any CO₂ amount |
| D | **A full open radiative-transfer package**: [libRadtran](https://www.libradtran.org/) (C, open source) has the standard atmospheres, the water continuum, O₃ UV cross-sections and Rayleigh built in, computes direct transmittance for the solar and thermal ranges at 1 cm⁻¹, and `mol_modify` zeroes any gas for the per-gas rows | a day, mostly compiling it | real, and the physics is already assembled |

**Feasibility check (2026-09-22), option C with HAPI:** downloading the CO₂ lines for 550–800 cm⁻¹ and computing the 15 μm band for a single-layer column (1 atm, 288 K, 424 ppm, 8 km) took 17 s on this laptop. Mean transmittance came out 0.88 at 12.5–13 μm, 0.38 at 13–13.5, 0.02 at 13.5–14, 0.00 from 14 to 16, 0.06 at 16–17 and 0.71 at 17–18 μm, which is Rohde's carbon-dioxide row. The whole test (needs only `numpy` and `hapi.py` from hitran.org):

```python
from hapi import db_begin, fetch, absorptionCoefficient_Voigt, transmittanceSpectrum
db_begin("hapi_data")
fetch("CO2", 2, 1, 550, 800)                      # molecule 2, isotopologue 1, 12.5–18 µm
nu, coef = absorptionCoefficient_Voigt(SourceTables="CO2", Diluent={"air": 1.0},
    Environment={"p": 1.0, "T": 288.0}, WavenumberStep=0.05, HITRAN_units=False)
nu, trans = transmittanceSpectrum(nu, coef * 424e-6, Environment={"l": 8e5})  # 424 ppm, 8 km in cm
```

The real run replaces the single layer with ~30 layers of the US Standard Atmosphere, each at its own p, T and mixing ratio, and sums the optical depths.

**Layering test (2026-09-23), same CO₂ band, HAPI, 21 runs in 193 s.** One layer at 1 atm and 288 K versus 20 layers of 2 km on the US Standard 1976 profile, same column:

| Bin (μm) | 1 layer, 1 atm | 20 layers |
|---|---|---|
| 12.5–13 | 0.88 | 0.94 |
| 13–13.5 | 0.38 | 0.56 |
| 13.5–14 | 0.02 | 0.12 |
| 14–16 | 0.00 | 0.00 |
| 16–16.5 | 0.01 | 0.10 |
| 16.5–17 | 0.10 | 0.28 |
| 17–17.5 | 0.53 | 0.72 |
| Planck-weighted (288 K), 12.5–18 μm | 0.28 | 0.35 |

The single surface-pressure layer makes the band about 0.5 μm too wide at each edge, because pressure broadening at 1 atm is applied to the whole column. The band holds ~30% of the surface emission, so the error on the "escaping to space" read-out from CO₂ alone is ~2 points. A single layer at a mean pressure (0.5 atm, 250 K) overshoots the other way (0.43). Layering is one `for` loop and 20× the compute; do it from the start. Ozone must be given its own p, T anyway (it lives at 25 km, 25 hPa).

**Recommendation: C**, with HAPI or RADIS, because it is the only route that also gives a CO₂ picker (278 / 424 / 850 ppm), and the pieces are small. D is the fallback if the layering turns out fiddly. A or B only if the widget is wanted this week.

**Precompute once, offline, with a line-by-line code**, and ship the result as a data file:

- Lines: HITRAN via [RADIS](https://radis.readthedocs.io/) (`calc_spectrum(molecule, pressure, Tgas, mole_fraction, path_length, databank="hitran")`, ~2 s per spectrum, downloads lines without an account) or [HAPI](https://hitran.org/hapi/) (slower). A Julia route exists (HITRAN.jl) but check its maturity first; RADIS is the safe bet.
- Gases: H₂O, CO₂, O₃, O₂, CH₄, N₂O, plus Rayleigh scattering (analytic, τ ≈ 0.0084 λ⁻⁴ with λ in μm for a vertical column; Bodhaine et al. 1999 for the exact form).
- Profiles: AFGL US Standard 1976 (Anderson et al. 1986) for T, p and the H₂O and O₃ vertical profiles; scale CO₂/CH₄/N₂O to today's NOAA values (428 ppm, 1939 ppb, 340 ppb) and H₂O to the global mean 25 kg m⁻². ~30 layers, 0–60 km.
- Per layer and gas: absorption coefficient on a 0.05 cm⁻¹ grid over 100–50,000 cm⁻¹ (100 to 0.2 μm), optical depth summed over layers, per-gas column transmittance T_g(ν) = exp(−τ_g).
- UV: HITRAN lines do not cover the O₃ Hartley/Huggins/Chappuis bands or the O₂ Schumann–Runge bands. Use HITRAN's absorption cross-section files for O₃ (Serdyuchenko et al. 2014, 213–1100 nm) and treat everything below 0.2 μm as opaque (O₂, N₂), with a note.
- Water vapour continuum (MT_CKD, [AER GitHub](https://github.com/AER-RC/MT_CKD_H2O)): without it the 8–13 μm window comes out cleaner than it is. Skip in version 1, flag in "About the figure", add later.
- Output: bin each T_g to ~3,000 log-spaced wavelengths from 0.05 to 100 μm (mean of the transmittance across the bin, which is the right average for transmitted power), 3 decimals, one JSON with a `gases` array ≈ 150 kB. Script in `scripts/` like the other data-prep scripts.

## Figure

Three stacked panels sharing the wavelength axis, as in Rohde, but on the black-body widget's axis (0.05–100 μm log, with the same log/linear morph if it is cheap to keep):

1. **Sun and Earth.** The 5772 K and 288 K Planck curves, each normalised to its own peak (Rohde's choice; the honest alternative, λB_λ with the Sun diluted by (R☉/1 AU)²/4, makes the two areas comparable and could be a later toggle). Under each curve the transmitted part is filled: curve × total transmittance. Two read-outs: "% of sunlight reaching the ground" and "% of the surface's glow escaping straight to space", both ∫B·T dλ / ∫B dλ over the axis.
2. **Total.** The total transmittance as a filled area, 0 to 100%, with the visible band marked.
3. **One row per constituent**, each a small filled absorption spectrum (1 − T_g) with a checkbox: H₂O, CO₂, O₃, O₂, CH₄, N₂O, Rayleigh. Unchecking removes the row's contribution from panels 1 and 2 (total = product of the checked T_g). Presets: *All*, *None*, *CO₂ only*, *Water vapour only*, and if the precompute is done at three CO₂ levels (278 / 428 / 856 ppm), a CO₂ amount picker, which is the cleanest demonstration that the 15 μm band widens rather than "saturates".

Hover anywhere: a vertical rule with the wavelength and the transmittance of each gas at that point. The tour: start with no atmosphere, add gases one at a time, ending with all, then take CO₂ from pre-industrial to doubled.

## Implementation

- `src/atmospheric-transmission/{index.md, embed.md, widget.js, data/transmission.json}`.
- Start from a copy of `src/blackbody-radiation/widget.js`: keep `planck`, the log/linear axis and morph, the tick logic and the tour scaffolding; drop the slider, the colour model and the reference objects. Or extract the 30 lines of Planck physics to `src/components/planck.js` and import it from both widgets (relative imports work on jsDelivr, but the blackbody file is self-contained on purpose, so decide once).
- Rendering: 3,000 points × 8 curves as SVG paths is fine; recompute the products on toggle (3,000 multiplications, trivial).
- Height: about 600 px at 640 px width.

## Gotchas and decisions

1. **Product of band means ≠ band mean of product.** Multiplying binned per-gas transmittances is exact only where bands do not overlap; H₂O and CO₂ overlap around 15 μm and 2.7 μm. Fine for teaching, must be disclosed. If it bothers, precompute the total for all 2⁷ gas subsets (128 × 3,000 floats ≈ 1 MB as float32); not for version 1.
2. **Clear sky, vertical path, no re-emission.** The "escaping straight to space" number is surface emission transmitted directly; the real outgoing flux includes emission by the atmosphere itself. This is a transmission widget, not an energy budget; say so, and point at the "Earth from space, 255 K" curve in the black-body widget.
3. **Sun's path is slant.** Rohde used vertical; the day-averaged airmass is larger. Keep vertical for comparability, note it.
4. **Below 0.2 μm** the line data is not there; shade opaque. **Above 70 μm** HITRAN H₂O rotational lines exist, so the axis can run to 100 μm as in the black-body widget.
5. **H₂O amount dominates everything.** The US Standard profile is dry (14 kg m⁻²); scale to the global mean or offer dry/mean/tropical presets later (needs three H₂O precomputes).
6. **Resolution.** Surface Voigt widths are ~0.1 cm⁻¹, so 0.05 cm⁻¹ sampling near 100 cm⁻¹ over 50,000 cm⁻¹ is 10⁶ points × 6 gases × 30 layers: minutes to an hour in RADIS, once. Coarsen the grid above 5,000 cm⁻¹ where nothing narrow matters.

## Prior art to credit

- Rohde, R. A., Global Warming Art, *Atmospheric Transmission* (original PNG on Commons; English SVG by Wikkiwonkk, CC0).
- Archer, D., [MODTRAN Infrared Light in the Atmosphere](https://climatemodels.uchicago.edu/modtran/), University of Chicago.
- Gordon, I. E. et al., HITRAN2020; Kochanov et al. 2016 (HAPI); van den Bekerom & Pannier 2021 (RADIS).
