import { fetchPlayer } from '../src/shared/realmeye';

for (const n of ['mrow', 'Spoder', 'SamRiddelI', 'NPC']) {
  const p = await fetchPlayer(n);
  console.log(
    `${n} -> ${p?.characters.length ?? 'null'} chars: ${p?.characters.map((c) => c.className).join(', ')}`,
  );
}
