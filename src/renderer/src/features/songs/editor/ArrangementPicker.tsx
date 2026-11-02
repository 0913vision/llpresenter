import {useState, type JSX} from 'react';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import {ModifiedMark} from '@renderer/ui/ListRow';
import {Menu} from '@renderer/ui/Menu';
import {ORDER_CHANGED_LABEL} from '@core/songs/itemOrder';
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
  orderChanged = false,
  ...choices
}: ArrangementChoices & {
  readonly disabled: boolean;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  /** Whether the item plays its own order, which the 구성 only started. */
  readonly orderChanged?: boolean;
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
      {orderChanged ? (
        <ModifiedMark label={ORDER_CHANGED_LABEL} spacer={false} />
      ) : null}
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
