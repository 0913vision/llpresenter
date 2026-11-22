import type {JSX} from 'react';
import type {Slide} from '@core/schema/slide';
import {withBackground, withTransition} from '@core/slides/edits';
import {Button} from '@renderer/ui/Button';
import type {ChosenSlides} from './changeSelected';
import type {InspectorTab} from './inspectorTab';
import {chosenBackground} from './LookTab';
import styles from './SlideInspector.module.css';
import {chosenTransition} from './TransitionTab';

/** What a tab gives to every slide, or null when there is no one value. */
function changeOf(
  tab: InspectorTab,
  chosen: ChosenSlides['chosen'],
): ((slide: Slide) => Slide) | null {
  if (tab === 'look') {
    const {value, mixed} = chosenBackground(chosen);
    return mixed ? null : slide => withBackground(slide, value);
  }
  const {value, mixed} = chosenTransition(chosen);
  return mixed ? null : slide => withTransition(slide, value);
}

/** The end of a tab: gives what it sets to every slide. */
export function ApplyToAll({
  deck,
  chosen,
  tab,
}: ChosenSlides & {readonly tab: InspectorTab}): JSX.Element | null {
  if (tab === 'texts') return null;
  const change = changeOf(tab, chosen);
  return (
    <Button
      className={styles.applyToAll}
      size="md"
      disabled={deck.readOnly || change === null || deck.slides.length < 2}
      onClick={() => {
        if (change !== null) deck.edit(slides => slides.map(change));
      }}
    >
      {tab === 'look' ? '배경을 전체 슬라이드에 적용' : '전체 슬라이드에 적용'}
    </Button>
  );
}
