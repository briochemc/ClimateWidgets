# Extreme events widget — quick plan

*Written 2026-10-07. Status: implemented the same day in `src/extreme-events/`.*

## Concept

One panel: the probability density of a climate quantity (temperature, rainfall, wind…), drawn
twice. A gray curve is the distribution as it was; a black curve is the same family after the
reader has changed its mean, spread, skewness or tail weight. A threshold handle sits under the
x-axis; everything under the black curve beyond it is painted vivid red, and the same tail of the
gray curve stays gray, so the *change* in how often extremes happen is the thing that jumps out.
This is the picture in IPCC SREX (2012) Fig. SPM.3 / AR5 WGI Fig. 1.8 (shift the mean, widen the
spread, change the symmetry) and in the Economist's 11 Feb 2023 version (graphic STC954), minus
that one's vertical line and arrows.

Format follows the Economist, on the #f2f2f2 plate the survey widgets use: no y-axis, no ticks,
just the x spine with three words (*cold / average / hot*, or *dry / average / wet* …). Numbers
are hidden by default and come back with a *Show numbers* box: the two tail fractions, their
ratio, the slider read-outs and a tick scale in standard deviations of the original.

## What Observable offers (checked 2026-10-07)

Nothing to reuse. Observable Plot has no parametric distributions (its `density` mark is a 2-D
KDE of data). d3-random, which Framework bundles with d3, has *samplers* only — uniform, normal,
logNormal, bates, irwinHall, exponential, pareto, bernoulli, geometric, binomial, gamma, beta,
weibull, cauchy, logistic, poisson — no pdf/cdf functions. Notebooks on observablehq.com reach
for jStat or @stdlib for pdfs, neither of which this site depends on, and the script-tag embeds
import nothing but the widget module. So the densities, cdfs and the three special functions
they need (log-gamma, the regularized incomplete gamma and beta functions, erfc) are written
into the widget, Numerical Recipes style, and checked once against numerical integration.

## Families and which moments they expose

The controls are always the same four — mean, spread (standard deviation), skewness, excess
kurtosis — and a family greys out the ones it does not have, showing the value the others imply.
Everything is in units of the original distribution's standard deviation, with the original
mean at 0 (unbounded families) or at 2 (families bounded at zero, so the bound is in view).

| Family | Free | Implied | Mapping | Climate use |
|---|---|---|---|---|
| Normal | mean, sd | skew 0, kurt 0 | direct | temperature, pressure |
| Skewed (Pearson III = shifted gamma) | mean, sd, skew | kurt = 1.5 γ² | k = 4/γ², θ = σ\|γ\|/2, shift = μ ∓ kθ, mirrored for γ < 0 | temperature with a skew; the classic hydrology family |
| Heavy-tailed (scaled Student t) | mean, sd, kurt | skew 0 | ν = 4 + 6/κ, scale σ√((ν−2)/ν) | fat tails |
| Gamma from zero | mean, sd | skew 2σ/μ | k = (μ/σ)², θ = σ²/μ | rainfall |
| Lognormal | mean, sd | skew (e^{s²}+2)√(e^{s²}−1) | s² = ln(1+σ²/μ²), m = ln μ − s²/2 | rainfall, wind |
| Weibull | mean, sd | skew from Γ(1+3/k) | k from the CV by bisection, λ = μ/Γ(1+1/k) | wind speed |

Left out: GEV (a distribution *of* extremes, which would muddle a widget about the extremes of a
distribution), skew-normal (skewness capped at 0.995 and ugly near it; Pearson III does the job
with any skew and passes through the normal at 0), the full Pearson system (all four moments,
but their valid region is strongly coupled — kurtosis ≥ skew² − 2 and more for a bell shape — so
the four sliders could never be independent).

Slider ranges: mean ±2σ of the original (0.5 to 4 for the bounded families), sd 0.5–2, skew
±1.5 (Pearson III is still bell-shaped there; at ±2 it is an exponential), kurtosis 0–6 (t with
ν from ∞ down to 5). The y-scale is fixed at twice the original peak and only stretches when a
curve would overflow, so the gray curve stays put while the reader works.

## Interaction

- Threshold handle on a track under the axis, draggable, arrow keys with the figure focused,
  default at +2σ (2.3% of a normal). One upper threshold only, as asked; a lower-tail option
  can come later.
- Distribution menu, *Show numbers* box and *Reset* above the figure; the four sliders below.
- Opens with the mean already up by 0.5σ (`shift` option) so the black curve is not hidden on
  the gray one and the red wedge is visible at once; *Reset* puts the two curves together.
- Switching family resets to that family's defaults (the gray curve is always the family at its
  defaults) and keeps the threshold where it was relative to the original mean.
- `value`: family, the four moments, threshold, the two tail fractions and their ratio.
