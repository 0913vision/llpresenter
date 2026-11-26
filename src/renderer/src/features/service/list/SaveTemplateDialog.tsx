import {EMPTY_NAME_REASON} from '@renderer/ui/fields/nameReason';
import {useState, type JSX} from 'react';
import {Dialog, DialogField} from '@renderer/ui/popups/Dialog';
import {TextField} from '@renderer/ui/fields/TextField';
import {NAME_LIMIT} from '@core/schema/common/primitives';

/**
 * The dialog that asks for the name to save the open service as a template
 * under; `busy` while the save runs.
 */
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
        title: trimmed === '' ? EMPTY_NAME_REASON : undefined,
      }}
    >
      <DialogField label="이름">
        <TextField
          aria-label="이름"
          value={text}
          maxLength={NAME_LIMIT}
          onChange={setText}
          readOnly={busy}
        />
      </DialogField>
    </Dialog>
  );
}
