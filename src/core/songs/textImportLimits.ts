import {SONG_IMPORT_LIMITS} from '../schema/songImport';

export const TEXT_IMPORT_LIMITS = {
  bytes: 4 * 1024 * 1024,
  characters: 1_000_000,
  lines: 20_000,
  units: 20_000,
  unitsPerSlide: 1000,
  slides: 5000,
  label: 512,
  draftCharacters: SONG_IMPORT_LIMITS.characters,
} as const;
