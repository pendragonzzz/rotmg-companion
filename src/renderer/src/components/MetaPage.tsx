import type { StatKey } from '../../../shared/types';
import type { ExaltEfficiency } from '../../../shared/engine';
import { dungeonName, exaltation, meta } from '../gameData';
import { POT_LABEL } from '../labels';
import type { Nav } from '../pages';
import { StatIcon } from './Icon';

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

export function MetaPage({ nav }: { nav: Nav }) {
  const timeline = [...meta.timeline].reverse(); // newest first
  return (
    <>
      <div className="page-intro">
        <span className="pill">Researched {meta.asOf}</span>
        <span className="muted">{meta.current}</span>
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
                    <button
                      key={r.id}
                      className={`meta-eff eff-${r.efficiency}`}
                      title={exaltation.dungeons[r.id]?.note}
                      onClick={() => nav.openDungeon(r.id)}
                    >
                      {dungeonName(r.id)}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="ov-note">
            Run these on an <b>8/8</b> character: every 5 clears (up to 25) = a permanent <b>+1</b> for that class
            (Life/Mana <b>+5</b>). Green = fast grind, amber = moderate, red = run for loot, not speed. Hover for the
            note, click to open the dungeon.
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
