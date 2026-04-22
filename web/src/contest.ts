// Contest tier rankings for R/S/E Pokémon Contests. These reflect community
// consensus (GameFAQs contest guides, Bulbapedia/Serebii contest writeups,
// Smogon Gen 3 in-game threads) weighted toward what wins Master Rank: easy
// access to a combo move, a strong appeal engine (Recover/Sing/Rain Dance/etc.),
// and a type/stat that matches the judge category.

import { lookupMove, type MoveInfo } from "./data";

export type ContestCategory = "Cool" | "Beauty" | "Cute" | "Smart" | "Tough";
export type ContestTier = "S" | "A" | "B" | "C" | "D";

export const CONTEST_TIERS: ContestTier[] = ["S", "A", "B", "C", "D"];

export type ContestEntry = {
  /** Primary contest category this species is usually built for. */
  category: ContestCategory;
  tier: ContestTier;
  /** 1-line why — what combo or engine carries it. */
  note: string;
  /** Other categories this mon is also viable in (for secondary tags). */
  alts?: ContestCategory[];
};

// Keyed by National Dex number. Curated from community contest guides — not
// every mon is listed; anything missing falls through to `defaultContestEntry`.
export const CONTEST_ENTRIES: Record<number, ContestEntry> = {
  // --- S Tier: consensus top picks, Master-Rank staples ------------------
  350: { category: "Beauty", tier: "S", note: "Milotic — Recover loops + Ice Beam combos; the iconic Beauty queen." },
  349: { category: "Beauty", tier: "S", note: "Feebas — evolve for Milotic; Recover-lock holds Beauty forever." },
  257: { category: "Cool", tier: "S", note: "Blaziken — Mirror Move + Blaze Kick / Sky Uppercut repeat combos." },
  334: { category: "Beauty", tier: "S", note: "Altaria — Dragon Dance + Perish Song; high-appeal Dragon chain." },
  260: { category: "Tough", tier: "S", note: "Swampert — Muddy Water + Mud Sport + Earthquake; Tough powerhouse." },
  254: { category: "Cool", tier: "S", note: "Sceptile — Leaf Blade spam + Dragon Claw; Cool combo engine." },
  321: { category: "Tough", tier: "S", note: "Wailord — Water Spout + Amnesia; enormous Tough appeal." },
  235: { category: "Smart", tier: "S", note: "Smeargle — Sketches any four moves; BYO combo in any category." },
  282: { category: "Cute", tier: "S", note: "Gardevoir — Calm Mind + Psychic chain; Cute/Smart dual threat.", alts: ["Smart"] },
  359: { category: "Smart", tier: "S", note: "Absol — Perish Song + Feint Attack; judge-excite machine." },
  351: { category: "Beauty", tier: "S", note: "Castform — Rain Dance/Sunny Day + Weather Ball in any cat.", alts: ["Cool", "Cute", "Smart", "Tough"] },
  385: { category: "Cute", tier: "S", note: "Jirachi — Doom Desire + Cosmic Power; any-cat event mon.", alts: ["Smart", "Cool"] },

  // --- A Tier: strong specialists, easy to build ------------------------
  301: { category: "Cute", tier: "A", note: "Delcatty — Assist + Attract; combo-heavy Cute standard." },
  308: { category: "Cool", tier: "A", note: "Medicham — Hi Jump Kick + Bulk Up; Fighting Cool backbone." },
  38: { category: "Beauty", tier: "A", note: "Ninetales — Fire Spin + Confuse Ray; classic Beauty build." },
  315: { category: "Beauty", tier: "A", note: "Roselia — Petal Dance + Grass Whistle; pure Beauty appeal." },
  284: { category: "Beauty", tier: "A", note: "Masquerain — Silver Wind + Ice Beam; Beauty combo juggler." },
  302: { category: "Smart", tier: "A", note: "Sableye — Confuse Ray + Shadow Ball; Smart Ghost chain." },
  344: { category: "Smart", tier: "A", note: "Claydol — Cosmic Power + Psychic; safe Smart scorer." },
  330: { category: "Cool", tier: "A", note: "Flygon — Dragon Dance + Dragon Claw; Cool Dragon combo." },
  373: { category: "Cool", tier: "A", note: "Salamence — Dragon Dance + Dragon Claw; Cool raw appeal." },
  376: { category: "Tough", tier: "A", note: "Metagross — Meteor Mash + Iron Defense; Tough Steel combo.", alts: ["Cool"] },
  382: { category: "Beauty", tier: "A", note: "Kyogre — Water Spout + Rain Dance; Beauty/Tough legend.", alts: ["Tough"] },
  383: { category: "Tough", tier: "A", note: "Groudon — Earthquake + Sunny Day; Tough Ground powerhouse." },
  384: { category: "Cool", tier: "A", note: "Rayquaza — Dragon Dance + Outrage; Cool combo ceiling." },
  380: { category: "Smart", tier: "A", note: "Latias — Calm Mind + Psychic; Smart Eon.", alts: ["Cute"] },
  381: { category: "Cool", tier: "A", note: "Latios — Calm Mind + Dragon Claw; Cool Eon." },
  310: { category: "Cool", tier: "A", note: "Manectric — Thunder Wave + Thunder; Cool Electric combo." },
  277: { category: "Cool", tier: "A", note: "Swellow — Agility + Aerial Ace; Cool speed combo." },
  272: { category: "Cute", tier: "A", note: "Ludicolo — Rain Dance + Hydro Pump; Cute dancer." },
  275: { category: "Smart", tier: "A", note: "Shiftry — Swagger + Extrasensory; Smart Dark combo." },
  286: { category: "Smart", tier: "A", note: "Breloom — Spore + Sky Uppercut; Smart status chain." },
  306: { category: "Tough", tier: "A", note: "Aggron — Iron Defense + Rock Slide; Tough wall." },
  365: { category: "Beauty", tier: "A", note: "Walrein — Sheer Cold + Ice Ball combo loops.", alts: ["Tough"] },
  346: { category: "Tough", tier: "A", note: "Cradily — Ingrain + Giga Drain; Tough fossil combo." },
  348: { category: "Tough", tier: "A", note: "Armaldo — Swords Dance + Rock Blast; Tough fossil." },
  303: { category: "Tough", tier: "A", note: "Mawile — Iron Defense + Crunch; Tough Steel." },

  // --- B Tier: usable with effort, weaker movepools --------------------
  26: { category: "Cool", tier: "B", note: "Raichu — Agility + Thunderbolt; solid Cool Electric." },
  40: { category: "Cute", tier: "B", note: "Wigglytuff — Sing + DoubleSlap; classic Cute loops." },
  65: { category: "Smart", tier: "B", note: "Alakazam — Calm Mind + Psychic; Smart Psychic." },
  94: { category: "Smart", tier: "B", note: "Gengar — Hypnosis + Shadow Ball; Smart Ghost." },
  242: { category: "Cute", tier: "B", note: "Blissey — Soft-Boiled + Sing; Cute healer." },
  248: { category: "Smart", tier: "B", note: "Tyranitar — Sandstorm + Crunch; Smart Rock." },
  279: { category: "Cute", tier: "B", note: "Pelipper — Rain Dance + Hydro Pump; Cute Water/Flying." },
  288: { category: "Cute", tier: "B", note: "Vigoroth — Slack Off + Focus Punch." },
  289: { category: "Tough", tier: "B", note: "Slaking — Yawn + Hyper Beam; Tough brute." },
  291: { category: "Cool", tier: "B", note: "Ninjask — Swords Dance + Silver Wind; Cool speed." },
  292: { category: "Smart", tier: "B", note: "Shedinja — Shadow Ball + Confuse Ray; Smart Ghost." },
  295: { category: "Tough", tier: "B", note: "Exploud — Screech + Hyper Voice; Tough Normal." },
  297: { category: "Tough", tier: "B", note: "Hariyama — Bulk Up + Cross Chop; Tough Fighting." },
  319: { category: "Tough", tier: "B", note: "Sharpedo — Taunt + Crunch; Tough Dark." },
  326: { category: "Cute", tier: "B", note: "Grumpig — Psych Up + Psychic; Cute Psychic." },
  332: { category: "Smart", tier: "B", note: "Cacturne — Spikes + Needle Arm; Smart Grass." },
  340: { category: "Tough", tier: "B", note: "Whiscash — Amnesia + Earthquake; Tough ground-water." },
  342: { category: "Tough", tier: "B", note: "Crawdaunt — Swords Dance + Crabhammer; Tough Water." },
  354: { category: "Smart", tier: "B", note: "Banette — Will-o-Wisp + Shadow Ball; Smart Ghost." },
  356: { category: "Smart", tier: "B", note: "Dusclops — Will-o-Wisp + Pain Split; Smart Ghost wall." },
  375: { category: "Cool", tier: "B", note: "Metang — Metal Claw + Take Down; stepping stone to Metagross." },
  335: { category: "Cool", tier: "B", note: "Zangoose — Swords Dance + Crush Claw; Cool Normal." },
  336: { category: "Smart", tier: "B", note: "Seviper — Glare + Crunch; Smart Poison." },
  357: { category: "Cute", tier: "B", note: "Tropius — Sunny Day + Solarbeam; Cute Grass/Flying." },
  362: { category: "Beauty", tier: "B", note: "Glalie — Ice Beam + Hail; Beauty Ice." },
  367: { category: "Tough", tier: "B", note: "Huntail — Dive + Crunch; Tough Water." },
  368: { category: "Beauty", tier: "B", note: "Gorebyss — Amnesia + Psychic; Beauty Water." },
  369: { category: "Tough", tier: "B", note: "Relicanth — Rock Tomb + Yawn; Tough fossil." },
  311: { category: "Cute", tier: "B", note: "Plusle — Fake Tears + Thunderbolt; Cute Electric." },
  312: { category: "Cute", tier: "B", note: "Minun — Charm + Thunderbolt; Cute Electric." },
  313: { category: "Smart", tier: "B", note: "Volbeat — Tail Glow + Signal Beam; Smart Bug." },
  314: { category: "Beauty", tier: "B", note: "Illumise — Moonlight + Silver Wind; Beauty Bug." },
  196: { category: "Smart", tier: "B", note: "Espeon — Calm Mind + Psychic; Smart Psychic." },
  197: { category: "Smart", tier: "B", note: "Umbreon — Mean Look + Confuse Ray; Smart Dark." },
  361: { category: "Beauty", tier: "B", note: "Snorunt — Ice Beam + Hail; pre-Glalie Beauty." },

  // --- D Tier: early-game / limited movepool ----------------------------
  263: { category: "Cute", tier: "D", note: "Zigzagoon — limited coverage, rarely built for contests." },
  265: { category: "Cute", tier: "D", note: "Wurmple — bug line; better after evolution." },
  276: { category: "Cool", tier: "D", note: "Taillow — limited until Swellow." },
  261: { category: "Cool", tier: "D", note: "Poochyena — thin movepool." },
  293: { category: "Tough", tier: "D", note: "Whismur — pre-evo, limited movepool." },
};

export const CONTEST_TIER_STYLE: Record<ContestTier, { bg: string; fg: string; ring: string }> = {
  S: { bg: "linear-gradient(135deg,#fde68a,#f59e0b)", fg: "#3f2d04", ring: "#f59e0b" },
  A: { bg: "linear-gradient(135deg,#fce7f3,#ec4899)", fg: "#4a0e2a", ring: "#ec4899" },
  B: { bg: "linear-gradient(135deg,#bfdbfe,#3b82f6)", fg: "#0b1f44", ring: "#3b82f6" },
  C: { bg: "linear-gradient(135deg,#e5e7eb,#9ca3af)", fg: "#1f2937", ring: "#9ca3af" },
  D: { bg: "linear-gradient(135deg,#fed7aa,#f97316)", fg: "#3b1d05", ring: "#f97316" },
};

// In-game contest judges reward visuals keyed to five categories. Using the
// same palette as the regional contest hall banners.
export const CATEGORY_STYLE: Record<ContestCategory, { color: string; icon: string }> = {
  Cool: { color: "#e11d48", icon: "★" },
  Beauty: { color: "#3b82f6", icon: "✦" },
  Cute: { color: "#ec4899", icon: "♥" },
  Smart: { color: "#16a34a", icon: "✶" },
  Tough: { color: "#f59e0b", icon: "◆" },
};

export function defaultContestEntry(): ContestEntry {
  return {
    category: "Cute",
    tier: "C",
    note: "No strong community consensus — viable with a custom combo but rarely a top pick.",
  };
}

export function getContestEntry(nationalDex: number): ContestEntry {
  return CONTEST_ENTRIES[nationalDex] ?? defaultContestEntry();
}

// Signature contest-combo moves. An owned mon carrying one of these gets a
// small annotation — it's built for its tier, not just sitting in the box.
const COMBO_MOVE_IDS: Record<ContestCategory, Set<number>> = {
  // Move IDs are 1:1 with Gen 3 internal move numbers (same as moves.json).
  Cool: new Set([68, 26, 97, 7, 9, 337, 53]), // counter, jump-kick, agility, fire-punch, thunder-punch, leaf-blade, flamethrower
  Beauty: new Set([105, 62, 58, 240, 57, 59, 47]), // recover, aurora-beam, ice-beam, rain-dance, surf, blizzard, sing
  Cute: new Set([186, 204, 213, 274, 445, 273, 150]), // attract, charm, attract, fake-tears (274), captivate N/A, wish, splash
  Smart: new Set([94, 109, 138, 248, 247, 50, 95]), // psychic, confuse-ray, dream-eater, future-sight, shadow-ball, disable, hypnosis
  Tough: new Set([89, 157, 63, 34, 182, 336, 446]), // earthquake, rock-slide, hyper-beam, body-slam, protect, howl
};

export function moveCategoryBonus(
  moveIds: (number | null | undefined)[],
  category: ContestCategory,
): { count: number; moves: MoveInfo[] } {
  const set = COMBO_MOVE_IDS[category];
  const hits: MoveInfo[] = [];
  for (const id of moveIds) {
    if (id == null || id === 0) continue;
    if (!set.has(id)) continue;
    const info = lookupMove(id);
    if (info) hits.push(info);
  }
  return { count: hits.length, moves: hits };
}
