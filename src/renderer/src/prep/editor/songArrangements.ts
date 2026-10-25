import type {Arrangement, Song} from '@shared/schema/song';

const NEW_ARRANGEMENT_PREFIX = '구성';

/** Default order is implicit; named orders retain repeats and empty orders. */
export function arrangementOrder(
  song: Song,
  name: string | undefined,
): readonly number[] {
  return (
    song.arrangements?.find(arrangement => arrangement.name === name)?.slides ??
    song.slides.map((_, index) => index + 1)
  );
}

/** Copies the selected order under the first unused numbered name. */
export function newArrangement(
  song: Song,
  selected: string | undefined,
): Arrangement {
  const names = new Set(song.arrangements?.map(({name}) => name));
  let number = 1;
  while (names.has(`${NEW_ARRANGEMENT_PREFIX} ${number}`)) number++;
  return {
    name: `${NEW_ARRANGEMENT_PREFIX} ${number}`,
    slides: [...arrangementOrder(song, selected)],
  };
}
