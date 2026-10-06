import { pets as petsData } from '../gameData';

interface Rarity {
  name: string;
  maxAbility: number;
  abilities: number;
  feedFame: number;
  note: string;
}
interface Ability {
  name: string;
  tier: string;
  slot: string;
  desc: string;
}
interface PetsData {
  rarities: Rarity[];
  abilities: Ability[];
  feeding: string[];
  fusing: string[];
}

const pets = petsData as unknown as PetsData;

export function PetsPage() {
  return (
    <>
      <div className="page-intro">
        <span className="muted">
          Your pet&apos;s Heal / Magic Heal is most of your survivability. Aim for those two, then level it up.
        </span>
      </div>

      <div className="pets-grid">
        <section className="pet-panel">
          <h2 className="pet-h">Rarity &amp; ability caps</h2>
          <div className="pet-rarities">
            {pets.rarities.map((r) => (
              <div key={r.name} className="pet-rarity" data-rarity={r.name.toLowerCase()}>
                <span className="pet-rarity-name">{r.name}</span>
                <span className="pet-rarity-cap">
                  Lv {r.maxAbility} cap · {r.abilities} abilit{r.abilities === 1 ? 'y' : 'ies'}
                </span>
                <span className="pet-rarity-feed">{r.feedFame.toLocaleString()} fame / feed</span>
              </div>
            ))}
          </div>
          <p className="ov-note">
            A pet has up to 3 abilities (1st always active, 2nd unlocks at Uncommon, 3rd at Legendary). Each
            feed costs the fame above <b>regardless of the item</b> — the item&apos;s <b>feed power</b> is what
            levels the pet, so feed high-feed-power items.
          </p>
        </section>

        <section className="pet-panel">
          <h2 className="pet-h">Which abilities to chase</h2>
          <div className="pet-abilities">
            {pets.abilities.map((a) => (
              <div key={a.name} className="pet-ability">
                <span className={`pet-tier tier-${a.tier}`}>{a.tier}</span>
                <div className="pet-ability-body">
                  <div className="pet-ability-top">
                    <span className="pet-ability-name">{a.name}</span>
                    {a.slot !== '—' && <span className="pet-ability-slot">slot {a.slot}</span>}
                  </div>
                  <div className="pet-ability-desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pet-panel">
          <h2 className="pet-h">Feeding</h2>
          <ul className="pet-list">
            {pets.feeding.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="pet-panel">
          <h2 className="pet-h">Fusing (upgrading rarity)</h2>
          <ul className="pet-list">
            {pets.fusing.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
