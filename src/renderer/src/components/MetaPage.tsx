import type { StatKey } from '../../../shared/types';
import type { DungeonGate, ExaltationData, ExaltEfficiency } from '../../../shared/engine';
import metaData from '../../../shared/data/meta.json';
import exaltationData from '../../../shared/data/exaltation.json';
import dungeonsData from '../../../shared/data/dungeons.json';
import { POT_LABEL } from '../labels';
import { StatIcon } from './Icon';

interface SeasonEntry {
  season: string;
  name: string;
  date: string;
  highlights: string[];
}
interface MetaData {
  asOf: string;
  current: string;
  timeline: SeasonEntry[];
  rules: string[];
  corrections: string[];
}

const meta = metaData as unknown as MetaData;
const exaltation = exaltationData as unknown as ExaltationData;
const dungeonName = new Map((dungeonsData as DungeonGate[]).map((d) => [d.id, d.name]));

/** Exalt stats in the in-game order; Life/Mana first since they're the big (×5) ones. */
const EXALT_ORDER: StatKey[] = ['hp', 'mp', 'att', 'def', 'spd', 'dex', 'vit', 'wis'];
const EFF_RANK: Record<ExaltEfficiency, number> = { high: 0, moderate: 1, low: 2 };

/** stat → exalt dungeons that grant it, most grindable first. */
function exaltsByStat(): [StatKey, { id: string; efficiency: ExaltEfficiency }[]][] {
  return EXALT_ORDER.map((stat) => [
    stat,
    Object.entries(exaltation.dungeons)
      .filter(([, d]) => d.stats.includes(stat))
      .map(([id, d]) => ({ id, efficiency: d.efficiency }))
      .sort((a, b) => EFF_RANK[a.efficiency] - EFF_RANK[b.efficiency]),
  ]);
}

export function MetaPage() {
  const timeline = [...meta.timeline].reverse(); // newest first
  return (
    <>
      <div className="profile-head">
        <h1>Realm Meta</h1>
        <div className="profile-meta">
          <span>Researched {meta.asOf}</span>
          <span>{meta.current}</span>
        </div>
      </div>

      <div className="pets-grid">
        <section className="pet-panel">
          <h2 className="pet-h">The grind, in order</h2>
          <ol className="pet-list meta-rules">
            {meta.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>

        <section className="pet-panel">
          <h2 className="pet-h">Exaltation map</h2>
          <div className="meta-exalts">
            {exaltsByStat().map(([stat, rows]) => (
              <div key={stat} className="meta-exalt-row">
                <span className="meta-exalt-stat">
                  <StatIcon stat={stat} size={13} /> {POT_LABEL[stat]}
                </span>
                <span className="meta-exalt-dungeons">
                  {rows.map((r) => (
                    <span key={r.id} className={`meta-eff eff-${r.efficiency}`} title={exaltation.dungeons[r.id]?.note}>
                      {dungeonName.get(r.id) ?? r.id}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="ov-note">
            Run these on an <b>8/8</b> character: every 5 clears (up to 25) = a permanent <b>+1</b> for that class
            (Life/Mana <b>+5</b>). Green = fast grind, amber = moderate, red = run for loot, not speed. Hover a
            dungeon for its note.
          </p>
        </section>

        <section className="pet-panel">
          <h2 className="pet-h">Corrected in this update</h2>
          <ul className="pet-list">
            {meta.corrections.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>

        <section className="pet-panel meta-wide">
          <h2 className="pet-h">Season timeline</h2>
          <div className="meta-timeline">
            {timeline.map((s) => (
              <div key={s.season} className="meta-season">
                <div className="meta-season-head">
                  <span className="meta-season-tag">{s.season}</span>
                  <span className="meta-season-name">{s.name}</span>
                  <span className="meta-season-date">{s.date}</span>
                </div>
                <ul className="pet-list">
                  {s.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
