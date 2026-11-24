import type {JSX} from 'react';
import {createSlideId} from '@core/schema/common/ids';
import type {ShowTile} from '@core/schema/services/showService';
import type {ThemeFile} from '@core/schema/screens/theme';
import {AUTO_TOKENS} from '@core/schema/slides/slideContent';
import {TilePicture} from '@renderer/pictures/TilePicture';
import styles from './SplitEditor.module.css';

const PREVIEW_ID = createSlideId('00000000-0000-4000-8000-000000000001');

/** A cut of a verse, as its slide shows it. */
export function SplitSlidePicture({
  text,
  continued,
  address,
  theme,
}: {
  readonly text: string;
  readonly continued: boolean;
  readonly address: string;
  readonly theme: ThemeFile;
}): JSX.Element {
  const tile: ShowTile = {
    slide: {
      id: PREVIEW_ID,
      theme: theme.id,
      texts: {본문: text},
      ...(continued ? {continued: true} : {}),
    },
    auto: {[AUTO_TOKENS.passage]: address},
    caption: null,
    labelColor: 'none',
  };
  return (
    <div className={styles.picture}>
      <TilePicture tile={tile} theme={theme} />
    </div>
  );
}
