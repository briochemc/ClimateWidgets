// Choropleth of support for climate policy by country — Fig. 4B ("Policy support") of
// Vlasceanu et al., Science Advances (2024), from Table S6 of the supplementary materials.
// https://www.science.org/doi/10.1126/sciadv.adj5778
//
// The map itself lives in ../components/choropleth-map.js, shared with the belief-map
// widget (Fig. 4A); this module only fixes the wording. The export names are frozen:
// script-tag embeds pasted into other people's pages import them from this exact path.
import {createChoroplethWidget, parseCountryStats} from "../components/choropleth-map.js";

export const parseTabS6 = parseCountryStats;

export function createPolicySupportMapWidget({data, world, width}) {
  return createChoroplethWidget({
    data, world, width,
    name: "policy-support-map",
    noun: "policy support",
    barLabel: "Policy support (%)",
  });
}
