export const TEXT_IMPORT_LIMITS = {
  bytes: 4 * 1024 * 1024,
  characters: 1_000_000,
  lines: 20_000,
  units: 20_000,
  unitsPerSlide: 1000,
  slides: 5000,
  label: 512,
  // NOTE(0913vision): A saved draft adds group ids, so the song import limit
  // in `SONG_IMPORT_LIMITS.characters` stays above this one.
  draftCharacters: 1_000_000,
} as const;
