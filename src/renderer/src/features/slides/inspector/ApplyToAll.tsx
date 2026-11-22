import type {JSX} from 'react';
import type {Slide} from '@core/schema/slide';
import {Button} from '@renderer/ui/Button';
import {PropertyControl} from '@renderer/ui/PropertyRow';
import type {SlideDeck} from '../slideDeck';
import styles from './SlideInspector.module.css';

/** The last row of a tab: gives what it sets to every slide. */
export function ApplyToAll({
  deck,
  change,
  children,
}: {
  readonly deck: SlideDeck;
  /** What every slide gets, or null when there is no one value. */
  readonly change: ((slide: Slide) => Slide) | null;
  readonly children: string;
}): JSX.Element {
  return (
    <PropertyControl>
      <Button
        className={styles.applyToAll}
        disabled={deck.readOnly || change === null || deck.slides.length < 2}
        onClick={() => {
          if (change !== null) deck.edit(slides => slides.map(change));
        }}
      >
        {children}
      </Button>
    </PropertyControl>
  );
}
