// Choropleth of belief in climate change by country — Fig. 4A ("Belief") of Vlasceanu
// et al., Science Advances (2024), from Table S5 of the supplementary materials.
// https://www.science.org/doi/10.1126/sciadv.adj5778
//
// The map itself lives in ../components/choropleth-map.js, shared with the policy-support-map
// widget (Fig. 4B); this module only fixes the wording. The export names are frozen:
// script-tag embeds pasted into other people's pages import them from this exact path.
import {createChoroplethWidget, parseCountryStats} from "../components/choropleth-map.js";

export const parseTabS5 = parseCountryStats;

export function createBeliefMapWidget({data, world, width}) {
  return createChoroplethWidget({
    data, world, width,
    name: "belief-map",
    noun: "belief",
    barLabel: "Belief (%)",
  });
}
