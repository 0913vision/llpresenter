import {useState, type JSX, type KeyboardEvent} from 'react';
import {TextField} from './TextField';

/** A name in a title bar, saved when its field is left. */
export function RenameText({
  label,
  value,
  readOnly,
  onCommit,
  onKeyDown,
}: {
  readonly label: string;
  readonly value: string;
  readonly readOnly: boolean;
  readonly onCommit: (value: string) => void;
  readonly onKeyDown?:
    ((event: KeyboardEvent<HTMLInputElement>) => void) | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextField
      aria-label={label}
      variant="title"
      block
      value={draft ?? value}
      readOnly={readOnly}
      onChange={setDraft}
      onBlur={() => {
        if (draft !== null && draft.trim() !== '' && draft !== value) {
          onCommit(draft.trim());
        }
        setDraft(null);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') setDraft(null);
        onKeyDown?.(event);
      }}
    />
  );
}
