import {useState, type JSX} from 'react';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';

export function SaveTemplateDialog({
  name,
  busy,
  onSave,
  onCancel,
}: {
  readonly name: string;
  readonly busy: boolean;
  readonly onSave: (name: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [text, setText] = useState(name);
  const trimmed = text.trim();
  return (
    <Dialog
      title="템플릿으로 저장"
      size="s"
      onCancel={onCancel}
      primary={{
        label: '저장',
        onSelect: () => onSave(trimmed),
        disabled: busy || trimmed === '',
        title: trimmed === '' ? '이름을 입력하세요' : undefined,
      }}
    >
      <DialogField label="이름">
        <TextField
          aria-label="이름"
          value={text}
          onChange={setText}
          readOnly={busy}
        />
      </DialogField>
    </Dialog>
  );
}
