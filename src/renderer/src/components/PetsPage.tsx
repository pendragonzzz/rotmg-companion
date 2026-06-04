import petsData from '../../../shared/data/pets.json';

interface Rarity {
  name: string;
  maxAbility: number;
  abilities: number;
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
      <div className="profile-head">
        <h1>Pets</h1>
        <div className="profile-meta">
          <span>Your pet&apos;s Heal / Magic Heal is most of your survivability. Aim for those two, then level it up.</span>
        </div>
      </div>

      <div className="pets-grid">
        <section className="pet-panel">
          <h2 className="pet-h">Rarity &amp; ability caps</h2>
          <div className="pet-rarities">
            {pets.rarities.map((r) => (
              <div key={r.name} className="pet-rarity" data-rarity={r.name.toLowerCase()}>
                <div className="pet-rarity-name">{r.name}</div>
                <div className="pet-rarity-cap">
                  abilities cap at <b>Lv {r.maxAbility}</b>
                </div>
                <div className="pet-rarity-meta">
                  {r.abilities} abilit{r.abilities === 1 ? 'y' : 'ies'}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
            ))}
          </div>
          <p className="ov-note">
            A pet has up to 3 abilities: the 1st is always active, the 2nd unlocks at Uncommon, the 3rd at
            Legendary.
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
