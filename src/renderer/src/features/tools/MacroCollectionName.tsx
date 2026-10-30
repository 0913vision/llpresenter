import {useRef, useState, type JSX} from 'react';
import {TextField} from '@renderer/ui/TextField';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {isComposing} from '@renderer/ui/ime';

export function MacroCollectionName({
  name,
  locked,
  onFinish,
}: {
  readonly name: string;
  readonly locked: boolean;
  readonly onFinish: (name: string | null) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(name);
  const finished = useRef(false);
  const valid = draft.trim().length > 0 && draft.trim().length <= 256;
  const finish = (save: boolean): void => {
    if (finished.current || (save && (!valid || locked))) return;
    finished.current = true;
    onFinish(save ? draft.trim() : null);
  };
  return (
    <TextField
      aria-label="모음 이름"
      value={draft}
      onChange={setDraft}
      autoFocus
      onFocus={event => event.currentTarget.select()}
      readOnly={locked}
      maxLength={256}
      invalid={!valid}
      invalidReason={valid ? undefined : '이름을 입력하세요'}
      onClick={event => event.stopPropagation()}
      onBlur={() => finish(valid && !locked)}
      onKeyDown={event => {
        if (isComposing(event) || hasModifier(event)) return;
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          const row =
            event.currentTarget.closest<HTMLElement>('[role="option"]');
          finish(event.key === 'Enter');
          if (finished.current) row?.focus({preventScroll: true});
        }
      }}
    />
  );
}
