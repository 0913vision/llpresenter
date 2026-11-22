import type {JSX} from 'react';
import {boxesOf, fillsItself, ownText} from '@core/slides/boxes';
import {PropertyFold} from '@renderer/ui/PropertyFold';
import {SlideTextField} from '../SlideTextField';
import type {SlideBox} from '../SlideTextArea';
import {useFold} from './folding';
import styles from './SlideInspector.module.css';

/** The texts that fill themselves, folded away below the others. */
export function FilledTexts(place: Omit<SlideBox, 'box'>): JSX.Element | null {
  const {tile, theme} = place;
  const fold = useFold('texts');
  const boxes = boxesOf(theme).filter(box => fillsItself(theme, box));
  if (boxes.length === 0) return null;
  return (
    <PropertyFold
      title="자동으로 들어가는 글"
      mark={boxes.some(box => ownText(tile.slide, box) !== '')}
      {...fold}
    >
      <div className={styles.filled}>
        {boxes.map(box => (
          <SlideTextField key={box} {...place} box={box} />
        ))}
      </div>
    </PropertyFold>
  );
}
