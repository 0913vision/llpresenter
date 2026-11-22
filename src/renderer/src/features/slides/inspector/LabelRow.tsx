import {useState, type JSX} from 'react';
import {withLabel} from '@core/slides/edits';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {Select} from '@renderer/ui/Select';
import {changeSelected, type ChosenSlides} from './changeSelected';

/** The label of the selected slides. */
export function LabelRow({deck, chosen}: ChosenSlides): JSX.Element {
  const catalog = useLabelCatalog();
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const label = chosen[0]?.label;
  const mixed = chosen.some(slide => slide.label !== label);
  return (
    <>
      <PropertyRow label="이름표">
        {({controlId}) => (
          <Select
            ref={setTrigger}
            id={controlId}
            aria-label="이름표"
            block
            value={mixed ? '혼합' : (label ?? '없음')}
            disabled={deck.readOnly || catalog === null}
            expanded={open}
            onExpandedChange={setOpen}
          />
        )}
      </PropertyRow>
      {!open || trigger === null || catalog === null ? null : (
        <LabelMenu
          store={catalog}
          anchor={trigger}
          selected={mixed ? undefined : label}
          onChoose={name =>
            changeSelected(deck, slide => withLabel(slide, name))
          }
          onClose={restore => {
            setOpen(false);
            if (restore) trigger.focus();
          }}
        />
      )}
    </>
  );
}
