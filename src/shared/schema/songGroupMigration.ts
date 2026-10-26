import type {UnknownRecord} from '../guards';
import {checkPart} from './fileFormat';
import {createSongGroupId, type SongGroupId} from './ids';
import {songSchema, type Song} from './song';

/** Converts validated version 1 slide orders without changing their expansion. */
export function migrateSongGroups(file: UnknownRecord): UnknownRecord {
  const checked = checkPart(songSchema, file);
  if (!checked.ok) {
    throw new Error(`${checked.error.field}: ${checked.error.message}`);
  }
  const {slides, arrangements, ...fields} = checked.value;
  const boundaries = groupBoundaries(checked.value);
  const groups = [];
  const starts = new Map<number, SongGroupId>();
  let start = 0;
  for (let end = 1; end <= slides.length; end += 1) {
    if (!boundaries.has(end)) continue;
    const id = createSongGroupId(crypto.randomUUID());
    starts.set(start + 1, id);
    groups.push({
      id,
      name: slides[start]?.label ?? '',
      slides: slides
        .slice(start, end)
        .map(({label: _label, ...slide}) => archiveField(slide, 'hotKey')),
    });
    start = end;
  }
  return {
    ...archiveField(fields, 'groups'),
    groups,
    ...(arrangements === undefined
      ? {}
      : {
          arrangements: arrangements.map(({slides: order, ...arrangement}) => ({
            ...archiveField(arrangement, 'groups'),
            groups: order.flatMap(number => {
              const id = starts.get(number);
              return id === undefined ? [] : [id];
            }),
          })),
        }),
  };
}

function groupBoundaries(song: Song): ReadonlySet<number> {
  const cuts = new Set([0, song.slides.length]);
  song.slides.forEach((slide, index) => {
    if ((slide.label ?? '') !== (song.slides[index - 1]?.label ?? '')) {
      cuts.add(index);
    }
  });
  for (const {slides} of song.arrangements ?? []) {
    slides.forEach((number, index) => {
      if (slides[index - 1] !== number - 1) cuts.add(number - 1);
      if (slides[index + 1] !== number + 1) cuts.add(number);
    });
  }
  return cuts;
}

function archiveField(
  fields: UnknownRecord,
  key: 'groups' | 'hotKey',
): UnknownRecord {
  if (!Object.hasOwn(fields, key)) return fields;
  const {[key]: value, legacyV1, ...rest} = fields;
  return {
    ...rest,
    legacyV1: {
      ...(Object.hasOwn(fields, 'legacyV1') ? {legacyV1} : {}),
      [key]: value,
    },
  };
}
