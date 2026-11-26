import {useState, type JSX, type ReactNode} from 'react';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {TextField} from '@renderer/ui/fields/TextField';
import {isComposing} from '@renderer/ui/fields/ime';

/**
 * Buffers a string until blur or Enter; Escape and invalid values keep the
 * saved value. The field stops at `maxLength`, which every use names, so no
 * value reaches main longer than its file takes.
 */
export function StringProperty({
  label,
  value,
  maxLength,
  reason,
  commit,
  validate = () => undefined,
  autoFocus = false,
  placeholder,
  onCancel,
  prefix,
  onResolved,
}: {
  label: string;
  value: string;
  maxLength: number;
  reason: string | undefined;
  commit: (value: string) => void;
  validate?: (value: string) => string | undefined;
  autoFocus?: boolean;
  placeholder?: string | undefined;
  onCancel?: () => void;
  prefix?: ReactNode;
  onResolved?: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const problem = validate(shown);
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <>
          {prefix}
          <TextField
            id={controlId}
            block
            autoFocus={autoFocus}
            placeholder={placeholder}
            maxLength={maxLength}
            value={shown}
            readOnly={reason !== undefined}
            title={reason}
            invalid={problem !== undefined}
            invalidReason={problem}
            onChange={setDraft}
            onBlur={() => {
              if (
                reason === undefined &&
                problem === undefined &&
                shown !== value
              ) {
                commit(shown);
              }
              onResolved?.(problem === undefined ? shown : value);
              setDraft(null);
              onCancel?.();
            }}
            onKeyDown={event => {
              if (isComposing(event)) return;
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(null);
                onCancel?.();
              }
            }}
          />
        </>
      )}
    </PropertyRow>
  );
}
