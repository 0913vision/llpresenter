import {useState, type JSX} from 'react';
import {withLabel} from '@core/slides/edits';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {Button} from '@renderer/ui/Button';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {changeSelected, type ChosenSlides} from './changeSelected';
import styles from './SlideInspector.module.css';

/** The label of the selected slides. */
export function LabelRow({deck, chosen}: ChosenSlides): JSX.Element {
  const catalog = useLabelCatalog();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const label = chosen[0]?.label;
  const mixed = chosen.some(slide => slide.label !== label);
  return (
    <>
      <PropertyRow label="이름표">
        {({controlId}) => (
          <Button
            id={controlId}
            size="md"
            className={styles.full}
            disabled={deck.readOnly || catalog === null}
            onClick={event => setAnchor(event.currentTarget)}
          >
            {mixed ? '혼합' : (label ?? '없음')}
          </Button>
        )}
      </PropertyRow>
      {anchor === null || catalog === null ? null : (
        <LabelMenu
          store={catalog}
          anchor={anchor}
          selected={mixed ? undefined : label}
          onChoose={name =>
            changeSelected(deck, slide => withLabel(slide, name))
          }
          onClose={restore => {
            setAnchor(null);
            if (restore) anchor.focus();
          }}
        />
      )}
    </>
  );
}
