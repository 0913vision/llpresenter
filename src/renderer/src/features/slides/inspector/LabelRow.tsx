import {useState, type JSX} from 'react';
import {withLabel} from '@core/slides';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {PropertyControl} from '@renderer/ui/panels/PropertyRow';
import {Select} from '@renderer/ui/choices/Select';
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
      <PropertyControl>
        <Select
          ref={setTrigger}
          aria-label="이름표"
          block
          value={mixed ? '혼합' : (label ?? '없음')}
          disabled={deck.readOnly || catalog === null}
          expanded={open}
          onExpandedChange={setOpen}
        />
      </PropertyControl>
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
