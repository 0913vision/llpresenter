import type {JSX} from 'react';
import {sameJson} from '@core/common/sameJson';
import {withBackground} from '@core/slides/edits';
import {Button} from '@renderer/ui/Button';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {changeSelected, type ChosenSlides} from './changeSelected';
import {SlideBackgroundControl} from './SlideBackgroundControl';
import styles from './SlideInspector.module.css';

/** The background of the selected slides, and giving it to every slide. */
export function BackgroundRow({deck, chosen}: ChosenSlides): JSX.Element {
  const value = chosen[0]?.background;
  const mixed = chosen.some(slide => !sameJson(slide.background, value));
  return (
    <PropertyRow label="배경">
      {({controlId}) => (
        <span className={styles.withAction}>
          <SlideBackgroundControl
            id={controlId}
            value={value}
            mixed={mixed}
            disabled={deck.readOnly}
            onChange={background =>
              changeSelected(deck, slide => withBackground(slide, background))
            }
          />
          <Button
            size="md"
            title="전체 슬라이드에 적용"
            disabled={deck.readOnly || mixed || deck.slides.length < 2}
            onClick={() =>
              deck.edit(slides =>
                slides.map(slide => withBackground(slide, value)),
              )
            }
          >
            전체 적용
          </Button>
        </span>
      )}
    </PropertyRow>
  );
}
