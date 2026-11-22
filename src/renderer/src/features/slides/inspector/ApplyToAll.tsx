import type {JSX} from 'react';
import type {Slide} from '@core/schema/slide';
import {Button} from '@renderer/ui/Button';
import type {SlideDeck} from '../slideDeck';
import styles from './SlideInspector.module.css';

/** Gives what a section sets to every slide, after the rows of the section. */
export function ApplyToAll({
  deck,
  mixed,
  change,
}: {
  readonly deck: SlideDeck;
  readonly mixed: boolean;
  readonly change: (slide: Slide) => Slide;
}): JSX.Element {
  return (
    <div className={styles.applyToAll}>
      <Button
        disabled={deck.readOnly || mixed || deck.slides.length < 2}
        onClick={() => deck.edit(slides => slides.map(change))}
      >
        전체 슬라이드에 적용
      </Button>
    </div>
  );
}
