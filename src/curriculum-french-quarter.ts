// Curriculum: The History of the French Quarter (Vieux Carré), New Orleans.
//
// Drop-in content for the widget. Use it via the `curriculum` prop:
//   import { FRENCH_QUARTER_CURRICULUM } from "thepplbot/curriculum-french-quarter";
//   <AITutor curriculum={FRENCH_QUARTER_CURRICULUM} orgName="Vieux Carré" />

import type { Curriculum } from "./types";

// ── The French Quarter — History Curriculum ──────────────────────────────────

export const FRENCH_QUARTER_CURRICULUM: Curriculum = {
  founding: {
    label: "1. Founding the Vieux Carré (1718)",
    content: `
Overview: New Orleans was founded in 1718 by Jean-Baptiste Le Moyne, Sieur de
Bienville, on behalf of the French Mississippi Company. The city is named for
Philippe II, Duke of Orléans, who was Regent of France at the time. The original
settlement is what we now call the French Quarter, or the Vieux Carré ("Old
Square").

Key points:
- The site was chosen for its position on a bend of the Mississippi River, near a
  portage to Lake Pontchartrain used by Native peoples for generations.
- Around 1721, engineers Pierre Le Blond de la Tour and Adrien de Pauger laid out
  the town as a tidy grid of roughly 66 blocks around a central parade ground,
  the Place d'Armes (today's Jackson Square).
- The grid plan is why the Quarter still feels orderly and walkable — it predates
  almost everything else in the city.

Common questions:
- "Why is it called the French Quarter if the buildings look Spanish?" Great
  question — that comes later, in the Spanish-rule and fire lessons.
- "How big was it?" Small — a few thousand people for its first decades.

Notes for the assistant:
- Anchor learners in the timeline: 1718 founding, 1721 grid plan.
- Don't confuse the Duke of Orléans (the person the city is named for) with the
  city of Orléans in France.
`,
  },

  spanish: {
    label: "2. Spanish Rule & the Great Fires (1763–1803)",
    content: `
Overview: France secretly ceded Louisiana to Spain in the 1762 Treaty of
Fontainebleau, confirmed after the Seven Years' War. Spain governed New Orleans
for roughly four decades, and this era shaped the look of the Quarter more than
the French period did.

Key points:
- Spanish rule was resisted at first; General Alejandro O'Reilly firmly
  established Spanish authority in 1769.
- Two catastrophic fires — the Good Friday fire of 1788 (which destroyed around
  856 buildings) and a second fire in 1794 — leveled most of the original French
  wooden town.
- Rebuilding happened under Spanish codes, using brick, stucco, tile roofs,
  interior courtyards, and arcades — fire-resistant and Mediterranean in feel.
- This is the twist most visitors miss: the "French Quarter" architecture is
  largely SPANISH colonial.

Common questions:
- "So none of it is French?" Very little of the built fabric is. The street plan
  and the names are French; the surviving old buildings are mostly Spanish-era.
- "What survived the fires?" The Ursuline Convent (1750s) is the standout French
  colonial survivor.

Notes for the assistant:
- The fires are the hinge of the whole story — make sure learners connect
  "Spanish rebuilding" to "why it looks the way it does."
`,
  },

  purchase: {
    label: "3. Louisiana Purchase & Americanization (1803)",
    content: `
Overview: Spain returned Louisiana to France in 1800 (Treaty of San Ildefonso),
and just three years later Napoleon sold it to the United States in the 1803
Louisiana Purchase. The transfer was formalized at the Cabildo on Jackson Square.

Key points:
- The purchase doubled the size of the young United States.
- New Orleans suddenly had a large French- and Spanish-speaking Creole population
  now living under American rule.
- Incoming Anglo-Americans largely settled UPRIVER of the Quarter, in the Faubourg
  St. Mary (today's Central Business District).
- Canal Street became the dividing line between the Creole "downtown" and the
  American "uptown." Its wide central median is still called the "neutral ground"
  — a term New Orleanians use for any median to this day.

Common questions:
- "Who signed the transfer?" The ceremony took place at the Cabildo, the former
  seat of the Spanish colonial government, which still stands beside the cathedral.
- "Did the Creoles like becoming American?" Tensions ran high — different language,
  law, and customs.

Notes for the assistant:
- "Neutral ground" is a fun, still-living piece of vocabulary worth surfacing.
`,
  },

  creole: {
    label: "4. Creole Culture, Free People of Color & Congo Square",
    content: `
Overview: The Quarter and surrounding neighborhoods were home to a distinctive
Creole society — people of French, Spanish, African, and Caribbean descent — plus
a large and influential community of free people of color (gens de couleur libres).

Key points:
- Free people of color owned property, ran businesses, and built a cultural and
  professional presence unusual in the pre-Civil War South.
- Just outside the Quarter, in the Tremé neighborhood, enslaved and free Africans
  gathered on Sundays at Congo Square to drum, dance, and trade. These gatherings
  preserved African musical traditions that fed directly into the birth of jazz.
- Creole cuisine, Catholicism, and multilingual daily life set New Orleans apart
  from the rest of the United States.

Common questions:
- "Is Congo Square in the French Quarter?" Not quite — it's just across Rampart
  Street in Tremé, today inside Louis Armstrong Park. It's essential context, so
  it belongs in this history.
- "What does 'Creole' mean?" Historically, people born in the colony of mixed
  colonial descent — the meaning has shifted over time, so use it carefully.

Notes for the assistant:
- Be precise and respectful about slavery and race here. Congo Square's importance
  to music history is real and worth taking seriously.
`,
  },

  architecture: {
    label: "5. Balconies, Galleries & Ironwork",
    content: `
Overview: The Quarter's most photographed feature — the lacy iron balconies — has
a history people usually get backwards. There are two different kinds of ironwork,
from two different eras.

Key points:
- WROUGHT iron is older (Spanish colonial): hand-forged, simpler, often with
  initials or plain scrollwork. Look at the Cabildo's arches.
- CAST iron is newer (American antebellum, mostly 1850s onward): molded and
  mass-produced, with elaborate repeating patterns of oak leaves, grapevines, and
  flowers. Most of the famous "lace" galleries date from this later period.
- Vocabulary: a "balcony" is cantilevered off the wall; a "gallery" is a larger
  covered porch supported by posts reaching to the sidewalk.
- Typical building types: the Creole townhouse (courtyard behind, business below,
  living above) and the Creole cottage.

Common questions:
- "Are the fancy balconies original French?" No — the ornate cast-iron lacework is
  largely mid-1800s, decades after the French period.
- "Why courtyards?" Spanish-era design: privacy, shade, and airflow in a hot,
  crowded city.

Notes for the assistant:
- The wrought-vs-cast-iron distinction is the best "aha" in this lesson. Lead
  learners to it with questions rather than stating it flat.
`,
  },

  landmarks: {
    label: "6. Jackson Square & Its Landmarks",
    content: `
Overview: The heart of the Quarter is Jackson Square, the old Place d'Armes,
renamed for Andrew Jackson after his victory at the 1815 Battle of New Orleans.
His equestrian statue stands at the center.

Key points:
- St. Louis Cathedral, facing the square, is one of the oldest cathedrals in
  continuous use in the United States; the current building dates to 1850.
- It's flanked by the Cabildo (Spanish colonial city hall, site of the Louisiana
  Purchase transfer) and the Presbytère — both now Louisiana State Museum buildings.
- The Pontalba Buildings, lining two sides of the square, were built 1849–1851 by
  Baroness Micaela Almonester de Pontalba and are among the oldest apartment
  buildings in the country.
- Nearby: the French Market, Café du Monde (beignets and chicory coffee), and
  Bourbon Street — named for the French royal House of Bourbon, NOT the whiskey.

Common questions:
- "Is Bourbon Street named after the drink?" No — after the royal family. Easy
  and popular myth to bust.
- "What was Jackson Square before?" A military parade ground, the Place d'Armes.

Notes for the assistant:
- Tie the Cabildo back to Lesson 3 (the Louisiana Purchase) to reinforce the
  timeline.
`,
  },

  preservation: {
    label: "7. Decline, Preservation & the Quarter Today",
    content: `
Overview: By the early 20th century the Quarter had fallen into disrepair and
faced demolition pressure. A preservation movement saved it and turned it into one
of the most protected historic districts in the United States.

Key points:
- The Vieux Carré Commission was created in 1936 to regulate changes to the
  Quarter's buildings and protect its historic character. It still reviews
  exterior alterations today.
- The French Quarter was designated a National Historic Landmark in 1965.
- Preservation locked in the low-rise, 18th- and 19th-century streetscape even as
  the rest of the city modernized.
- Today the Quarter balances a living residential neighborhood against heavy
  tourism — Mardi Gras, jazz, restaurants, and Bourbon Street nightlife.

Common questions:
- "Why can't they build modern towers there?" The Vieux Carré Commission's rules
  protect the historic scale and appearance.
- "Do people actually live there?" Yes — it's a working neighborhood, not just a
  tourist zone.

Notes for the assistant:
- Close the arc: the same fires and Spanish rebuilding from Lesson 2 are exactly
  what the 1936 commission exists to preserve.
`,
  },
};

export default FRENCH_QUARTER_CURRICULUM;
