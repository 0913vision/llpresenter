import {bibleSource, type BiblePreviewOptions} from '@core/bible/source';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {useShow} from '@renderer/session/showStore';
import {outputSlideSpec} from '@renderer/rendering/OutputSlidePicture';
import {pictures} from '@renderer/rendering/pictures/pictureService';
import {splitSourceFor, type BibleProjections} from './splitProjection';

let projections: BibleProjections | null = null;

export function installBiblePictureProjection(
  value: BibleProjections | null,
): () => void {
  projections = value;
  return () => {
    if (projections === value) projections = null;
  };
}

/** Stages the passage's first viewport before the heading and output change. */
export async function prepareBiblePictures(
  passage: BibleLookupPassage,
  options: BiblePreviewOptions,
): Promise<boolean> {
  const bibleSourceValue = bibleSource(passage, options);
  const id = bibleSourceValue.id;
  const source = splitSourceFor(
    {...useShow.getState(), bibleSource: bibleSourceValue},
    id,
  );
  const projected = source === null ? undefined : projections?.get(source);
  const appearance = projected?.appearance;
  if (projected == null || appearance === undefined) return false;
  const {tiles} = projected;
  const {screen, theme, background} = appearance;
  const waits = tiles.slice(0, 24).flatMap((_, index) => {
    const slide = slideLayerOf({itemId: id, index}, () => tiles);
    return slide === null
      ? []
      : [
          pictures.whenDrawn(
            outputSlideSpec({
              slide,
              screen,
              themeId: theme.themeId,
              sourceScreenId: theme.sourceScreenId,
              layout: theme.layout,
              item: theme.item,
              emptyColor: theme.emptyColor,
              background,
            }),
            `${id}:${index}`,
          ),
        ];
  });
  const drawn = await Promise.all(waits);
  return drawn.length > 0 && drawn.every(Boolean);
}
