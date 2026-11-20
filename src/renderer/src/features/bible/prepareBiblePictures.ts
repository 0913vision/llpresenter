import {
  biblePassagePictureKey,
  bibleSource,
  type BiblePreviewOptions,
} from '@core/bible/source';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {useShow} from '@renderer/session/showStore';
import {biblePictureInput, pictureSpec} from '@renderer/rendering/pictureSpec';
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
  const passagePictureKey = biblePassagePictureKey(bibleSourceValue);
  const source = splitSourceFor(
    {...useShow.getState(), bibleSource: bibleSourceValue},
    id,
  );
  const projected = source === null ? undefined : projections?.get(source);
  const appearance = projected?.appearance;
  if (projected == null || appearance === undefined) return false;
  const {tiles} = projected;
  const {theme, background} = appearance;
  const grid = document.querySelector<HTMLElement>(
    '[data-workspace-frame="show"]:not([inert]) [data-slide-window-size]',
  );
  const windowSize = Number(grid?.dataset['slideWindowSize']) || 24;
  const waits = tiles.slice(0, windowSize).flatMap((_, index) => {
    const slide = slideLayerOf({itemId: id, index}, () => tiles);
    return slide === null
      ? []
      : [
          pictures.whenDrawn(
            {
              ...pictureSpec({
                kind: 'slide',
                input: biblePictureInput(slide, appearance, {
                  background,
                  sourceScreenId: theme.sourceScreenId,
                }),
              }).spec,
              passagePictureKey,
            },
            `${passagePictureKey}:${index}`,
          ),
        ];
  });
  const drawn = await Promise.all(waits);
  return drawn.length > 0 && drawn.every(Boolean);
}
