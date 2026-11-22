import type {JSX} from 'react';
import type {SectionCard} from '@core/schema/service';
import type {SlideTexts} from '@core/schema/slideTexts';
import {SlidePicture} from '@renderer/pictures/SlidePicture';
import {cardSlideLayer} from '@renderer/rendering/slideStillSpec';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import styles from './CardSlideBody.module.css';

/** The picture of an item's 타이틀 slide. */
export function CardSlideBody({
  itemId,
  card,
  mode = 'list',
  texts,
}: {
  readonly itemId: string;
  readonly card: SectionCard;
  readonly mode?: 'list' | 'grid' | undefined;
  readonly texts?: SlideTexts | undefined;
}): JSX.Element {
  const theme = useSlideTheme({
    id: itemId,
    kind: 'slides',
    form: 'blank',
    title: card.name,
    theme: card.theme,
  });
  return (
    <div className={styles.thumbnail} data-view={mode}>
      <div className={styles.canvas}>
        {theme === undefined ? null : (
          <SlidePicture
            {...theme}
            slide={cardSlideLayer(itemId, card, texts)}
          />
        )}
      </div>
      <SlideThumbnailBand number={1} label={card.label ?? '타이틀'} />
    </div>
  );
}
