import type {JSX} from 'react';
import {createSlideId} from '@core/schema/ids';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {TilePicture} from '@renderer/pictures/TilePicture';
import styles from './SplitEditor.module.css';

const PREVIEW_ID = createSlideId('00000000-0000-4000-8000-000000000001');

/** A cut of a verse, as its slide shows it. */
export function SplitSlidePicture({
  text,
  continued,
  reference,
  theme,
}: {
  readonly text: string;
  readonly continued: boolean;
  readonly reference: string;
  readonly theme: ThemeFile;
}): JSX.Element {
  const tile: ShowTile = {
    slide: {
      id: PREVIEW_ID,
      theme: theme.id,
      texts: {본문: text},
      ...(continued ? {continued: true} : {}),
    },
    auto: {구절: reference},
    caption: null,
    labelColor: 'none',
  };
  return (
    <div className={styles.picture}>
      <TilePicture tile={tile} theme={theme} />
    </div>
  );
}
