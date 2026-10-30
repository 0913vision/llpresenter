import {useState, type JSX} from 'react';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import {editorTask} from './editorTask';
import {
  DUPLICATE_ARRANGEMENT_NAME_REASON,
  EMPTY_ARRANGEMENT_NAME_REASON,
  RESERVED_ARRANGEMENT_NAME_REASON,
} from './ArrangementDialog';

export function NewArrangementDialog({
  names,
  locked,
  create,
  onClose,
}: {
  readonly names: readonly string[];
  readonly locked: boolean;
  readonly create: (name: string) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState(() => {
    let number = 1;
    while (names.includes(`구성 ${number}`)) number++;
    return `구성 ${number}`;
  });
  const value = name.trim();
  const reason =
    value === ''
      ? EMPTY_ARRANGEMENT_NAME_REASON
      : value === DEFAULT_ARRANGEMENT_NAME
        ? RESERVED_ARRANGEMENT_NAME_REASON
        : names.includes(value)
          ? DUPLICATE_ARRANGEMENT_NAME_REASON
          : undefined;
  return (
    <Dialog
      title="새 구성"
      size="s"
      onCancel={onClose}
      primary={{
        label: '확인',
        disabled: locked || reason !== undefined,
        title: reason,
        onSelect: () =>
          editorTask(
            (async () => {
              if (!locked && reason === undefined && (await create(value))) {
                onClose();
              }
            })(),
          ),
      }}
    >
      <TextField
        aria-label="구성 이름"
        value={name}
        onChange={setName}
        block
        readOnly={locked}
        invalid={reason !== undefined}
        invalidReason={reason}
        onFocus={event => event.currentTarget.select()}
      />
    </Dialog>
  );
}
