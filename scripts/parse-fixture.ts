import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePlayer } from '../src/shared/realmeye';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

function show(file: string) {
  const html = readFileSync(join(fixtures, file), 'utf-8');
  const profile = parsePlayer(html);
  console.log(`\n===== ${file} =====`);
  console.log(`player: ${profile.name}  private=${profile.isPrivate}  characters=${profile.characters.length}`);
  console.log('summary:', JSON.stringify(profile.summary));
  for (const c of profile.characters) {
    console.log(
      `\n  ${c.className} (id ${c.classId})  L${c.level}  fame ${c.fame}  ${c.statsMaxed} maxed`,
    );
    console.log('    stats   :', JSON.stringify(c.stats));
    console.log('    base    :', JSON.stringify(c.baseStats));
    console.log('    pet     :', c.petId);
    for (const it of c.equipment) {
      console.log(`    [${it.slot}] ${it.name}${it.tier ? ' (' + it.tier + ')' : ''}  <${it.slug}>`);
    }
  }
}

show('player-active.html');
show('player-empty.html');
