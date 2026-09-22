# Atmospheric composition widget — quick plan

*Written 2026-09-22. Status: implemented the same day in `src/atmospheric-composition/`. Two corrections found while building: water vapour (0.4%) is less abundant than argon (0.93%), so it lands after argon, inside grid 1's last square, and shows as 40 squares in grid 2; and the pre-industrial values were verified against AR6 WG1 Chapter 2 (278.3 ppm, 729.2 ppb, 270.1 ppb).*

## Concept

Replace the nested pie chart Wikipedia uses ([Atmosphere_gas_proportions.svg](https://en.wikipedia.org/wiki/File:Atmosphere_gas_proportions.svg)) with nested 10×10 grids in the manner of xkcd's [Money](https://www.explainxkcd.com/wiki/index.php/980:_Money): every square in one grid is exactly the whole of the next grid, blown up 100×. The first grid is almost all nitrogen and oxygen with one "?" square; clicking it (or the tour) opens the next grid, and so on down to methane and nitrous oxide.

## The numbers (dry air, mole fraction, ppm)

Decision (2026-09-22): Wikipedia values only. The [Atmosphere of Earth](https://en.wikipedia.org/wiki/Atmosphere_of_Earth) table (Allen's Astrophysical Quantities 2002, with CO₂ and CH₄ updated to 2024) for the main gases, the [Atmospheric chemistry](https://en.wikipedia.org/wiki/Atmospheric_chemistry) table for H₂, N₂O, Xe and O₃. NOAA's mid-2026 monthly means (CO₂ 427.6, CH₄ 1.939, N₂O 0.340) are within a square's rounding of these and are not used.

| Gas | ppm | Source |
|---|---|---|
| N₂ | 780,749 | **remainder**, see gotcha 1 (78.075%; Wikipedia says 780,840) |
| O₂ | 209,460 | Atmosphere of Earth table |
| Ar | 9,340 | same |
| CO₂ | 423.9 | same, 2024 value |
| Ne | 18.2 | same |
| He | 5.24 | same |
| CH₄ | 1.94 | same, 2024 value |
| Kr | 1.14 | same |
| H₂ | 0.53 | Atmospheric chemistry table |
| N₂O | 0.34 | same |
| Xe | 0.087 | same |
| O₃ | ~0.03 | same, given as 0.02 (winter) to 0.07 (summer) near the surface; see gotcha 3 |

Pre-industrial (1750) for the anthropogenic shading: CO₂ 278 ppm, CH₄ 729 ppb, N₂O 270 ppb (IPCC AR6 WG1 Table 2.2 values from memory; verify before use).

Water vapour, excluded from every "dry air" table: global mean ≈ 0.4% by mole (25 kg m⁻² of precipitable water over 10,330 kg m⁻² of air = 0.24% by mass, × 28.97/18.02), locally 0 to 4%.

## Grid arithmetic (verified with a script, 100× per level)

Fill the whole composition once in snake order, gases descending. Grid *k* is the last square of grid *k−1*, cropped exactly, so tails of the previous gas carry over, and that is a feature: the zoom is honest.

| Level | 1 square = | Contents (squares) |
|---|---|---|
| 1 | 1% = 10,000 ppm | N₂ 78.07, O₂ 20.95, **"?" 0.98** (Ar 0.93 + CO₂ 0.04 + rest) |
| 2 | 100 ppm | O₂ tail 2.09, Ar 93.4, CO₂ 4.24, **"?" 0.27** (Ne + He + CH₄ + …) |
| 3 | 1 ppm | CO₂ tail 72.5, Ne 18.2, He 5.2, CH₄ 1.9, Kr 1.1, **"?" ≈1** (H₂ + N₂O + Xe + O₃) |
| 4 | 10 ppb | Kr tail 1.3, H₂ 53, N₂O 34, Xe 8.7, O₃ 3 |

Anthropogenic shares, drawn as a second shade of the same colour: CO₂ 2.78 of its 4.24 squares in grid 2 are pre-industrial, so 1.46 squares are added; CH₄ 0.73 of 1.94 in grid 3; N₂O 27 of 34 in grid 4.

Three levels reach CH₄, as asked; the fourth adds N₂O, the third long-lived greenhouse gas, so I would build all four. The cost of exact cropping is that level 3 is 72% CO₂ tail. If that reads badly, the alternative is a rounded "everything else" bucket at each level (level 3 would then be Ne 66, He 19, CH₄ 7, Kr 4, rest 4 with 1 square = 0.28 ppm), which loses the clean units. Recommendation: exact cropping with clean units, and label the tails ("still O₂", "still CO₂").

Partial squares: draw the boundary inside a square as a vertical split at the fraction, so N₂ ends 7% of the way into square 79 rather than rounding.

## Interaction

- Start with grid 1 only. The last square is a "?" and pulses once. Click it, or let the tour, and grid 2 unfolds from that square (animate the square growing into the new grid, with the two xkcd-style guide lines from the parent square's corners). Repeat down to grid 4. Grids sit side by side (row on wide screens, column at phone width).
- Click any gas region or square: read-out with the exact mole fraction in %, ppm/ppb, "1 molecule in N", and one sentence (e.g. argon: "from potassium-40 decay in rocks", CO₂: "was 278 ppm in 1750").
- **Anthropogenic shading, always on:** the pre-industrial part of the CO₂, CH₄ and N₂O regions in the gas's base colour, the part added since 1750 in a slightly different shade of it (the read-out says "278 ppm in 1750, 424 ppm in 2024"). No toggle needed.
- **Add water vapour** toggle: switches from dry air to real air at the global mean, so a 0.4% square (nearly half a square) appears in grid 1 between O₂ and Ar, with the note that it is the biggest greenhouse gas and the one every table leaves out.
- Tour, in the house style (auto-plays until the first click; Play tour button): open the grids one by one, then flip the two toggles.
- Colours: greenhouse gases (H₂O, CO₂, CH₄, N₂O, O₃) in one warm family, the rest (N₂, O₂, Ar, Ne, He, Kr, Xe, H₂, CO) in cool greys/blues, so the point that the climate-active gases are the small squares is visible without reading.

## Implementation

- `src/atmospheric-composition/{index.md, embed.md, widget.js, data/composition.json}` in the usual pattern (see the blackbody widget for the factory/`value`/`"input"` conventions and the tour code, `src/blackbody-radiation/widget.js` around line 1076).
- No dependencies. SVG: one `<g>` per grid, 100 `<rect>` each, gas regions as `<path>` outlines drawn over the squares from the snake-order fill; text labels only for regions wider than ~2 squares, otherwise a leader line or the read-out.
- `data/composition.json`: `{gas, ppm, ppm1750?, greenhouse: bool, note, source}` per gas plus an `asOf` date; the widget computes the fills from it so updating NOAA values is a one-line edit.
- Height: four grids of ~180 px plus read-out ≈ 520 px at 640 px width; measure for the embed snippet.

## Gotchas and decisions

1. **The Wikipedia table does not add up.** Its 12 dry-air entries sum to 1,000,091 ppm: the 78.084% for N₂ dates from when CO₂ was ~330 ppm. Checked both fixes: scaling every gas by 10⁶/sum moves N₂ by 20 ppm (0.002 of a square) and CO₂ by 0.04 ppm; taking N₂ as the remainder moves only N₂. No visible difference, so **N₂ = 10⁶ − everything else = 780,749 ppm**. Say so in "About the figure".
2. **Rising CO₂ displaces O₂** in reality (O₂ falls ~4 ppm per decade); we ignore it, the table's O₂ is from Allen 2002.
3. **Ozone is a stratospheric gas.** Tables give the near-surface 0.02–0.07 ppm, but a 300 DU column is 0.37 ppm averaged over the whole atmosphere, more than N₂O. Decide: near-surface value with a note, or column mean. I lean to the column mean labelled "almost all of it above 15 km", since the widget is "the atmosphere", not "the air at your feet".
4. **O₃ is variable**; give it "≈" and Wikipedia's range in the read-out. CO (~0.1 ppm) is not in either Wikipedia table and is left out.
5. **Freeze an "as of" date** (Wikipedia's 2024 CO₂ and CH₄) rather than fetching live; the values move slower than the widget will be revised.
6. Tails: the grid 3 "?" square holds 0.99 ppm, so 0.013 ppm of krypton spills into it and shows as 1.3 squares at the top of grid 4. Read-outs must always quote a gas's full amount, never the cropped part.
