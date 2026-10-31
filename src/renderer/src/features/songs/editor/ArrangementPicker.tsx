import {useState, type JSX} from 'react';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import {Menu} from '@renderer/ui/Menu';
import {Select} from '@renderer/ui/Select';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {
  arrangementMenuEntries,
  type ArrangementChoices,
} from './arrangementMenuEntries';

export function ArrangementPicker({
  disabled,
  title,
  description,
  ...choices
}: ArrangementChoices & {
  readonly disabled: boolean;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}): JSX.Element {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const handoff = useMenuHandoff(open, (action: () => void) => action());
  return (
    <>
      <Select
        ref={setTrigger}
        aria-label="구성"
        aria-description={description}
        size="sm"
        value={choices.selected ?? DEFAULT_ARRANGEMENT_NAME}
        disabled={disabled}
        title={title}
        expanded={open}
        onExpandedChange={setOpen}
      />
      {open && trigger ? (
        <Menu
          label="구성"
          entries={arrangementMenuEntries({
            ...choices,
            create: () => handoff(choices.create),
            rename: () => handoff(choices.rename),
            remove: () => handoff(choices.remove),
            edit: () => handoff(choices.edit),
          })}
          anchor={{kind: 'element', element: trigger}}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
