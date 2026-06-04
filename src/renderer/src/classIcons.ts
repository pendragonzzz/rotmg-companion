// Bundled RotMG class sprites, downloaded by `npm run refresh` into ./assets/classes.
// `import.meta.glob` tolerates an empty/absent folder, so the build still works before
// the first refresh — callers fall back to a class monogram when there's no icon.
const modules = import.meta.glob('./assets/classes/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/([^/]+)\.png$/);
  if (m) byName[m[1]!.toLowerCase()] = url;
}

const norm = (className: string) => className.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Bundled sprite URL for a class, or undefined if not downloaded yet. */
export function classIcon(className: string): string | undefined {
  return byName[norm(className)];
}
