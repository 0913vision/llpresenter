import type {MediaId} from '@core/schema/common/ids';
import type {Song} from '@core/schema/songs/song';
import {amend} from './draftHistory';
import {
  draftView as view,
  useSongDraft,
  type ImportPictures,
} from './draftStore';

/** Null takes the picture away. */
type Replacements = ReadonlyMap<MediaId, MediaId | null>;

function withPictures(song: Song, pictures: Replacements): Song {
  return {
    ...song,
    slides: song.slides.map(slide => {
      const {background, ...rest} = slide;
      if (background?.kind !== 'media') return slide;
      const picture = pictures.get(background.media);
      if (picture === undefined) return slide;
      return picture === null
        ? rest
        : {...slide, background: {...background, media: picture}};
    }),
  };
}

/** Puts pictures that came in where others stood in for them. */
export function replaceImportedPictures(
  source: ImportPictures,
  pictures: Replacements,
): void {
  if (view().pictures?.source !== source) return;
  amend(song => withPictures(song, pictures));
}

/** No more pictures come in. */
export function finishImportedPictures(source: ImportPictures): void {
  if (view().pictures?.source !== source) return;
  useSongDraft.setState({pictures: {source, busy: false}});
}

/** The song with the files of the pictures it was imported with. */
export async function withPictureFiles(song: Song): Promise<Song> {
  const source = view().pictures?.source;
  if (source === undefined) return song;
  const files = await source.keep(
    new Set(
      song.slides.flatMap(({background}) =>
        background?.kind === 'media' ? [background.media] : [],
      ),
    ),
    song.title,
  );
  return withPictures(song, files);
}
