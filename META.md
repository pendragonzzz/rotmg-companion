# RotMG Meta Research — living doc (last full pass: 2026-10)

> Companion to `CONTEXT.md`. This is the **grind/meta intel layer** (how real players progress), distinct
> from the wiki "book smarts" the scraper pulls. Every claim is sourced from DECA patch notes, RealmEye
> pages, or the RealmEye drop tables already scraped into `dungeon-drops.json`. ⚠ = inferred / unverified.
> Drives: `dungeons.json`, `pot-routing.json`, `biomes.json`, `exaltation.json`, and the in-app **Meta** tab
> (`meta.json`). Replaces `META-2025.md` (renamed — git history keeps the old version).
>
> **Research note (2026-10):** this pass was done from a sandbox that could search the web but not open
> RealmEye/DECA pages directly, so facts come from search-indexed page text. Anything that needed a full
> page read (per-biome UT names, exact drop rates) is still flagged ⚠ for the next pass or the scraper.

## 0. TL;DR — what changed since the 2026-06 curation

**Corrections to our own data (these were wrong):**
- **Ice Cave ≠ exalt dungeon.** The SPD exalt belongs to its rebuild, the **Ice Citadel** (boss **Esben the
  Neurotic**, Runic Tundra, *Blizzard* frostbite mechanic). The Ice Cave's boss is Esben the *Unwilling*;
  our data had merged the two. → added `ice-citadel`, stripped the exalt off `ice-cave`.
- **The Void = Mana only.** The "Vial of Pure Darkness → Defense" exalt was bogus — the vial just opens it.
- **The Shatters = Attack only, ×2 per run** (Twilight Archmage *and* The Forgotten King each grant one).
  Not Life/Mana.
- **Ocean Trench drops Mana, not Life.** **Manor of the Immortals drops ATT, not WIS.** (Both from the
  scraped RealmEye drop tables.)
- **Crystal Cavern isn't an Easter seasonal** — the Crystal Worm Mother (Fungal Cavern) drops its entrance.
- The old version of this doc had **Kogbold ↔ Fungal swapped** (it's Kogbold → VIT, Fungal/Crystal → WIS).
  `exaltation.json` was already right; the doc wasn't.
- "Advanced Nest" is now the **Plagued Nest**; Advanced dungeons no longer add damage — you heal 50% less.

**New since the last pass (2026 seasons):** Druid class · Realm Legions + Legion Elite gear · Dungeon Mod
rework · Alien Invasion rework + Neo Wormholes (exalts!) · Mystic/Necromancer/Summoner reworks · six new
realm encounters · Time Chamber (classic dungeons) · Trials of Cronus rework · account-level onboarding.

---

## 1. The Realm: biomes, beacons, encounters  (→ `biomes.json`)

**Flow:** Rookie biomes (level 1→20) → **Adept** (the 6 stat pots) → **Veteran** (adds Life & Mana pots,
Biome UTs, Realm Legions bases). Biomes connect by speed-boost **roads**. Each biome has a **Beacon** guarded
by a **Beacon Guardian** (a Hero of Oryx); kill it to activate: minimap fast-travel + safe heal zone. Since
late 2025, activating a beacon also **clears nearby enemies**, and inactive beacons no longer block enemies.

**Biome UTs:** every non-rookie biome has its own themed weapon/ability/ring UT — **legendary-forge tier**,
dropped **only** by that biome's enemies/encounters. Veteran guardians were reworked with Biome-UT loot
tables. ⚠ Per-biome item names still unverified (`ut: null`).

### Adept biomes (stat-pot farming)
| Biome | Pots | Portals | Notable encounters |
|---|---|---|---|
| Coral Reefs | — (fishing hub) | — | Man-eating Barnacle |
| Sprite Forest | DEX, SPD, VIT | Sprite World, Magic Woods, Puppet Master's Encore | Daughter of Limon (always drops an Encore portal), Towering Perfection |
| Haunted Hallows | WIS | Undead Lair, Mad Lab, Cursed Library | Artificial Slop |
| Shipwreck Cove | SPD, DEX | Ancient Ruins, Cave of a Thousand Treasures | |
| Dead Church | ATT, WIS | Haunted Cemetery | |
| Risen Hell | VIT, DEF | Manor, Abyss of Demons, Cursed Library | Cold Soul, Stygian Mirror |
| Abandoned City | ATT, DEF | Ancient Ruins, Mad Lab, Toxic Sewers, Puppet Master's Encore | Maze Minotaur (always drops an Encore portal) |

**Alien Invasion (reworked S29):** can start at **15% Realm Score**; the **Alien Reactors in the Adept
biomes** are now the alien source (no longer Abandoned-City-only). The invasion continues once all Wormholes
are gone and the realm reaches 50% (or forces on at 66%).

### Veteran biomes (Life/Mana + Biome UTs + Legion bases)
| Biome | Pots | Portals | Notes |
|---|---|---|---|
| Deep Sea Abyss | ATT, VIT, **Mana** | Ocean Trench, Cnidarian Reef, Davy Jones' Locker | Cube Deity encounter |
| Carboniferous | VIT, WIS, **Mana** | Woodland Labyrinth, Crawling Depths | both portals are mid-tier Life/Mana sources |
| Floral Escape | SPD, VIT, **Life** | Lair of Draconis, Mountain Temple, Sulfurous Wetlands | |
| Sanguine Forest | ATT, WIS, **Life** | Tomb, Lair of Shaitan, Parasite Chambers | Shadow Lurker (can drop an Encore portal) |
| Runic Tundra | VIT, DEF, WIS, **Mana** | Kogbold Steamworks, Ocean Trench, **Ice Citadel** | two exalt dungeons live here |

**Realm Legions (S28 P2):** Oryx's Legion now occupies the realm, with tougher forces in harder biomes. The
Veteran biomes host the **Legion Watchtower, Legion Strategy Center and Legion Research Base**. **Legion
Elite** gear = T13 weapon/armor and T6 ability equivalents, boosted by set bonuses + Awakened enchantments.

### Seasonal biomes
- **Eternal Frost** (Oryxmas): Ice Tomb, Ice Cave, High Tech Terror.
- **Relentless Springs** (Easter): Queen Bunny Chamber, Moonlight Village ⚠ (Moonlight's portal source unverified).

---

## 2. 2026 season timeline  (→ `meta.json` timeline)

| Season | Name | Date | What matters for the grind |
|---|---|---|---|
| S27 P1 | Emberbloom Cycle | ~early 2026 | **Druid** class: Wand + Leather + **Sigil**; build meter → shapeshift (Shark = stealth rusher, Golem = tank). Phoenix Crucible. |
| S28 P1 | Hydroflow | Apr 14 | T6 ability reskins, Hydroflow Crucible (+SPD/+WIS/+MP%, +10% loot). |
| S28 P2 | Return of Stromwell | May 5 | **Realm Legions**, **Stromwell Rifts** I/II/III (by dungeon difficulty) → Legion Elite + **Nightmatter Circlet** ST ring, **Dungeon Mod rework** (every mod = loot/XP/dust boost). |
| S29 P1 | Alien Invasion | Jun 2 | Invasion rework (above), **Necromancer** + skull rework, **Summoner** modernization, realm event **The Jötunn**. |
| S29 P2 | Alien Overdrive | ~Jul | **Neo Wormholes** (difficulty 8) — grant an **exalt** (colour = stat; red = VIT) *only* if you beat the timer **and** kill the Satellite Core. |
| S30 P1 | Retrowinds | Aug 4 | **Mystic rework** (Hex stacks ≤100, decay after 3s), six community encounters (§1), T13 reskins, Wind Vortex. |
| S30 P2 | Time Chamber (MotMG) | ~Sep | **Time Chamber**: 12 classic dungeons w/ original loot (Legacy Shatters → ATT exalt). **Trials of Cronus** = 5-round boss rush, expects 6/8. **Onboarding** unlocks by account level. |
| S31 P1 | Halloween | Oct (PT) | Blood Rituals return, **Memories** (solo story encounters), +VIT/−healing Crucible, Druid ST reskin. |

---

## 3. Stat-pot farming  (→ `pot-routing.json`)

Two tracks: **biome farming** (Adept for the 6, Veteran for Life/Mana — low risk, no boss gate) and **dungeon
farming** (bosses with soulbound pot drops). Routing below is from the **scraped RealmEye drop tables**.

- **Guaranteed early sources (unchanged):** Sprite World → DEX, Snake Pit → SPD, Undead Lair → WIS,
  Abyss → VIT, Toxic Sewers → DEF, Puppet Master's Theatre → ATT.
- **Life is mid-game:** **Woodland Labyrinth** (tier 3, Carboniferous) drops Life; then Tomb, Lair of Shaitan,
  Mountain Temple, Secluded Thicket, Nest, Crystal Cavern, Lost Halls. **Moonlight Village guarantees a
  Greater Life** on regular difficulty.
- **Mana is mid-game:** **Ocean Trench** and **The Crawling Depths** (both tier 3), then Cnidarian Reef,
  Sulfurous Wetlands, Parasite Chambers, Lost Halls, Spectral Penitentiary, Void, Shatters, O3.
- **Greater-pot dungeons (the late upgrade):** Kogbold Steamworks, Fungal/Crystal Cavern, Lair of Draconis
  (all 6 + Mana per scrape), The Shatters, Tomb (ATT/DEF/SPD), Spectral Penitentiary (DEF/Mana), Woodland
  Labyrinth (VIT/ATT), O3 (Life/Mana), Moonlight Village (Life/WIS/VIT).
- ⚠ The scraper misses some pot rows (Kogbold/Fungal show none, though RealmEye says Kogbold drops "various
  Greater Stat Potions") — scraped absence isn't evidence of absence; keep curated `greaterPots` flags.

---

## 4. Exaltations — the post-8/8 grind  (→ `exaltation.json`)

Clear an exalt dungeon on an **8/8** character: **5/10/15/20/25** clears = **+1…+5** to that stat (Life/Mana
**×5**, max +25), permanent, per class.

| Stat | Dungeon (boss) | Efficiency |
|---|---|---|
| **Life** | Oryx's Sanctuary (Oryx 3 — **50% chance of a bonus exalt**) · Moonlight Village (Genji last) | low · moderate |
| **Mana** | The Void (Void Entity) · Moonlight Village (Kaguya last) | low · moderate |
| **Attack** | The Shatters (**×2**: Archmage + Forgotten King) · Spectral Penitentiary (Soulwarden Murcian) · Moonlight Village (Miko last) · *Legacy Shatters (Time Chamber)* | moderate |
| **Defense** | Lost Halls (Marble Colossus) | moderate |
| **Speed** | **Ice Citadel** (Esben the Neurotic, guaranteed) · Cultist Hideout (Malus) | high · moderate |
| **Dexterity** | The Nest / Plagued Nest (Killer Bee Queen) | high |
| **Vitality** | Kogbold Steamworks (Factory Control Core) · *Neo Wormholes (red)* | high |
| **Wisdom** | Fungal Cavern (Crystal Worm Mother) → Crystal Cavern (Crystal Entity) = **2 per chain** | moderate |

- **Best exalts/hour:** The Nest, Ice Citadel (standalone — skips the Lost Halls → Cultist chain), Kogbold.
- **Double-dip runs:** Fungal → Crystal (2 WIS), The Shatters (2 ATT), O3 (50% bonus Life).
- **Double Exaltation events** appear on the calendar (e.g. Spectral Penitentiary + O3, May 2025) — grind those.
- ⚠ Neo Wormhole colour→stat map beyond red=VIT is unverified, so they're not in `exaltation.json` yet.

---

## 5. Difficulty-for-loot systems

- **Advanced dungeons** (Advanced Kogbold, Plagued Nest, …): **−50% healing** instead of extra damage; keep
  **+30% loot**, extra dust, and **5× base artifact** drop rate. Kogbold's portal encounter (Kogbold
  Expedition Engine) drops both a regular **and** an Advanced portal.
- **Dungeon Mods (S28 P2 rework):** every mod carries a loot, XP or dust boost scaled to how hard it is.
- **Crucible** (unlocks at account level 27): an opt-in seasonal modifier trading stats for loot/XP
  (e.g. S31: +30% VIT, −30% external healing, +10% loot/XP).
- **Trials of Cronus** (reworked S30 P2): 5 rounds, pick 1 of 2 bosses each (Sandstone Titan/Fountain Spirit →
  Ruthven/Corruption Phantom → Davy Jones/Thessal → Heroic Septavius/Infernal Malphas → Perfected Cube God);
  expects 6/8; loot pools refreshed incl. dust.

---

## 6. When to STOP grinding something  (→ `obsoleteAtMaxed`)

- **Stat maxed** → stop farming its pots (the app hides it).
- **ATT/DEX past 75** → gains are halved (diminishing returns).
- **Out-tiered a pot dungeon** → once you can run greater-pot dungeons or farm the matching biome, starter
  single-pot dungeons are a waste (`obsoleteAtMaxed` greys them out).
- **8/8** → low/mid dungeons are fame/UT only; switch to exalts + greater pots.
- **Can forge it** → stop RNG-grinding a UT you can target-craft.

## 7. What items are worth chasing

- **Forge / blueprints** (unlocks at account level 23): dismantle UT/ST for mats; blueprints unlock crafting.
- **Legion Elite** gear (T13/T6-equivalent with set bonuses) and the **Nightmatter Circlet** (ST ring, always
  Divine: +100 HP/MP, +4 ATT/DEX/VIT/WIS, 9% XP; heal-at-50% + energize + poison effects).
- **Biome UTs** — legendary-forge tier, biome-exclusive.
- **Time Chamber** dungeons drop their **original** loot tables (old-sprite items) — collector value.
- **Puppet Master's Encore** UTs: The Thousand Shot, Prism of Dire Instability.
- Shinies are cosmetic long-tail — acknowledged, not a goal.

## 8. Account progression (S30 P2 onboarding)

Systems unlock by **account level**: Pets **5** · Enchanter **17** · Blacksmith/Forge **23** · Crucible **27**.
"Your Journey" objectives guide new players. Account levels also raise starting gear tier.

## 9. Endgame path

Realm Score (every kill counts) hits 100% → Oryx closes the realm → everyone is pulled into **Oryx's Castle**
(O1) → beat Oryx → **Wine Cellar** (O2) needs an **incantation** (drops widely — most dungeons list one) →
beat O2 with **Sword + Shield + Helmet runes** → **Oryx's Sanctuary** (O3).
Rune sources (scraped): **Sword** — Nest, Kogbold, Crystal Cavern · **Shield** — Cnidarian Reef, Lair of
Shaitan, Secluded Thicket · **Helmet** — Lost Halls, Cultist Hideout, The Void.

---

## 10. Open items (next pass)
1. ⚠ Per-biome UT names (`biomes.json` `ut`) — add biome pages to the scraper.
2. ⚠ Neo Wormhole colour → exalt stat map; then add them to `exaltation.json`.
3. ⚠ Druid stat priority (`stat-priority.json` uses healer-style WIS-first; Druid is wand + leather — likely
   ATT/DEX-first). Left unchanged until sourced.
4. ⚠ Deadwater Docks / Fungal Cavern / Moonlight Village portal biomes.
5. Run `npm run refresh` so `ice-citadel`, `deadwater-docks`, `puppet-masters-encore` get scraped drops
   (`puppet-masters-encore` → `puppet-master-s-encore` is already in `WIKI_SLUG`).

## Sources
- DECA — Season 28 P2 *Return of Stromwell*: https://remaster.realmofthemadgod.com/?p=6139
- DECA — Season 28 P1 *Hydroflow*: https://remaster.realmofthemadgod.com/?p=6028
- DECA — Season 27 P1 *Emberbloom Cycle*: https://remaster.realmofthemadgod.com/?p=5769
- DECA — MotMG 2025 *Shadow of the Legion*: https://remaster.realmofthemadgod.com/?p=4642
- DECA — Season 25 *Snowfall*: https://remaster.realmofthemadgod.com/?p=5218
- DECA — Update 5.14 (Ice Citadel + Advanced dungeons): https://remaster.realmofthemadgod.com/?p=4585
- DECA — Realm Rework: https://remaster.realmofthemadgod.com/?p=4117 · Biome UTs: https://remaster.realmofthemadgod.com/?p=3849
- DECA hub — S29 P1 *Alien Invasion*: https://hub.realmofthemadgod.com/news0/updates0/aliens
- DECA hub — S29 P2 *Alien Overdrive*: https://hub.realmofthemadgod.com/news0/updates0/alienoverdrive
- DECA hub — S30 P1 *Retrowinds*: https://hub.realmofthemadgod.com/news0/updates0/season-30-part-1-retrowinds-patch-notes
- DECA hub — Mystic rework + encounters PT: https://hub.realmofthemadgod.com/news0/updates0/mystic-pt
- DECA hub — S30 P2 *Time Chamber*: https://hub.realmofthemadgod.com/news0/updates0/motmg · PT: https://hub.realmofthemadgod.com/news0/updates0/pt0807
- DECA hub — S31 P1 Halloween PT: https://hub.realmofthemadgod.com/news0/updates0/s31pt1
- RealmEye — Kogbold Steamworks: https://www.realmeye.com/wiki/kogbold-steamworks
- RealmEye — Fungal Cavern guide: https://www.realmeye.com/wiki/fungal-cavern-guide · Crystal Cavern guide: https://www.realmeye.com/wiki/crystal-cavern-guide · Crystal Worm Mother: https://realmeye.com/wiki/crystal-worm-mother
- RealmEye — The Shatters: https://realmeye.com/wiki/the-shatters · The Void: https://www.realmeye.com/wiki/the-void · Lost Halls: https://www.realmeye.com/wiki/lost-halls
- RealmEye — Oryx's Sanctuary: https://realmeye.com/wiki/oryx-s-sanctuary · Moonlight Village: https://www.realmeye.com/wiki/moonlight-village
- RealmEye — Spectral Penitentiary guide: https://www.realmeye.com/wiki/spectral-penitentiary-guide · Ice Cave: https://www.realmeye.com/wiki/ice-cave
- RealmEye — Deadwater Docks: https://www.realmeye.com/wiki/deadwater-docks · Puppet Master's Encore guide: https://www.realmeye.com/wiki/puppet-master-s-encore-guide
- RealmEye — The Realm: https://realmeye.com/wiki/the-realm
