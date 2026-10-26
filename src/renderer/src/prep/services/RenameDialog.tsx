import {useState, type JSX} from 'react';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';

const NAME_NEEDED = '이름을 적어야 바꿀 수 있습니다';

/** 이름 바꾸기 for a 틀 or a 예배 순서; the field starts with its name. */
export function RenameDialog({
  name,
  busy,
  onRename,
  onCancel,
}: {
  readonly name: string;
  readonly busy: boolean;
  readonly onRename: (name: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [text, setText] = useState(name);
  const trimmed = text.trim();
  return (
    <Dialog
      title="이름 바꾸기"
      subtitle={{text: name}}
      size="s"
      onCancel={onCancel}
      primary={{
        label: '바꾸기',
        onSelect: () => onRename(trimmed),
        disabled: busy || trimmed === '' || trimmed === name,
        title: trimmed === '' ? NAME_NEEDED : undefined,
      }}
    >
      <DialogField label="이름">
        <TextField aria-label="이름" value={text} onChange={setText} />
      </DialogField>
    </Dialog>
  );
}
