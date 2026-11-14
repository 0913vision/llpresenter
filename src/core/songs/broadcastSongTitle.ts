import type {Song} from '../schema/song';

/** The song name and, when present on its title slide, its hymn number. */
export function broadcastSongTitle(
  song: Pick<Song, 'title' | 'slides'>,
): string {
  const title = song.title.split(/\r?\n/u)[0]?.trim() ?? '';
  if (/^새찬송가\s*\d+\s*장(?:\s|$)/u.test(title)) return title;
  const lines = song.slides
    .filter(slide => slide.titleSlide === true)
    .flatMap(slide => slide.lines);
  const number = lines
    .map(line => /^새찬송가\s*(\d+)\s*장(?:\s|$)/u.exec(line.trim())?.[1])
    .find(Boolean);
  return number === undefined ? title : `새찬송가 ${number}장 ${title}`;
}
