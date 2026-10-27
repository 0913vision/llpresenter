import type {GroupedSong} from '@shared/schema/groupedSong';
import type {SongGroupId} from '@shared/schema/ids';
import type {ContentEdit} from '@shared/schema/contentEdit';
import {SONG_IMPORT_LIMITS} from '@shared/schema/songImport';

type SongImportDraft = Extract<ContentEdit, {type: 'song.import'}>['draft'];

/** The legacy import wire cannot hold this many expanded arrangement picks. */
export class ImportDraftLimitError extends Error {
  constructor() {
    super('The imported song exceeds its size limits');
  }
}

/** Expands edited groups into the text import draft's legacy wire references. */
export function importDraftSlides(
  song: GroupedSong,
): Pick<SongImportDraft, 'slides' | 'arrangements'> {
  const orders = new Map<SongGroupId, readonly number[]>();
  let first = 1;
  const slides = song.groups.flatMap((group, section) => {
    orders.set(
      group.id,
      group.slides.map((_, index) => first + index),
    );
    first += group.slides.length;
    return group.slides.map(slide => ({...slide, label: group.name, section}));
  });
  let picks = 0;
  for (const arrangement of song.arrangements ?? []) {
    for (const id of arrangement.groups) {
      picks += orders.get(id)?.length ?? 0;
      if (picks > SONG_IMPORT_LIMITS.picks) throw new ImportDraftLimitError();
    }
  }
  return {
    slides,
    ...(song.arrangements === undefined
      ? {}
      : {
          arrangements: song.arrangements.map(({groups, ...arrangement}) => ({
            ...arrangement,
            slides: groups.flatMap(id => orders.get(id) ?? []),
          })),
        }),
  };
}
