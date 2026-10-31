import {useEffect, useRef, useState, type JSX} from 'react';
import {useRenameDraft} from '@renderer/ui/useRenameDraft';
import type {Label} from '@core/schema/labels';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import type {AppliedRename, SongEditorStore} from './songEditorStore';

export const EMPTY_LABEL_NAME_REASON =
  '이름표 이름을 적어야 저장할 수 있습니다';
export const DUPLICATE_LABEL_NAME_REASON = '같은 이름의 이름표가 있습니다';
export const LABEL_RENAME_SCOPE = '모든 곡에서 이 이름표의 이름을 바꿉니다';

/** The labels file stores unique, nonblank names without trimming old names. */
export function labelNameReason(
  name: string,
  labels: readonly Label[],
): string | undefined {
  if (name.trim() === '') return EMPTY_LABEL_NAME_REASON;
  if (labels.some(label => label.name === name.trim())) {
    return DUPLICATE_LABEL_NAME_REASON;
  }
  return undefined;
}

interface LabelNameFieldProps {
  readonly label: Label;
  readonly labels: readonly Label[];
  readonly store: SongEditorStore;
  readonly locked: boolean;
  readonly onRename: (from: string, to: string) => void;
  readonly onDraft: (save: (() => Promise<boolean>) | null) => void;
}

function NameDraft({
  label,
  labels,
  store,
  locked,
  onRename,
  onDraft,
  onClose,
  autoFocus,
}: LabelNameFieldProps & {
  readonly onClose: () => void;
  readonly autoFocus: boolean;
}): JSX.Element {
  const [applied, setApplied] = useState<AppliedRename | null>(null);
  const currentName = applied?.name ?? label.name;
  const draft = useRenameDraft(
    label.name,
    {
      validate: name =>
        labelNameReason(
          name,
          labels.filter(item => item.name !== currentName),
        ),
      onCommit: name => {
        if (applied !== null && name === applied.name) {
          return store.retryRename(applied);
        }
        onRename(currentName, name);
        return store.renameLabel(currentName, name, setApplied);
      },
      onClose,
    },
    locked,
  );
  const save = draft.changed ? draft.save : null;
  useEffect(() => {
    onDraft(save);
    return () => onDraft(null);
  }, [onDraft, save]);
  return (
    <TextField
      aria-label={`${label.name} 이름`}
      title={LABEL_RENAME_SCOPE}
      {...draft.field}
      onKeyDown={event => {
        if (isComposing(event)) return;
        if (event.key === 'Escape' && !draft.changed && !hasModifier(event)) {
          return;
        }
        if (
          event.key === 'Tab' &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          draft.commit();
        }
        draft.field.onKeyDown(event);
      }}
      autoFocus={autoFocus}
      block
    />
  );
}

/** Keeps each inline rename recoverable and starts a new draft after acceptance. */
export function LabelNameField(props: LabelNameFieldProps): JSX.Element {
  const [session, setSession] = useState({generation: 0, autoFocus: false});
  const frame = useRef<HTMLDivElement>(null);
  return (
    <div ref={frame}>
      <NameDraft
        key={session.generation}
        {...props}
        autoFocus={session.autoFocus}
        onClose={() => {
          const autoFocus =
            frame.current?.contains(document.activeElement) ?? false;
          setSession(current => ({
            generation: current.generation + 1,
            autoFocus,
          }));
        }}
      />
    </div>
  );
}
