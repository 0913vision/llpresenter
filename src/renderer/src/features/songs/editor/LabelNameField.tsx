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
  const pendingSave = useRef<Promise<boolean> | null>(null);
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
        const retry = applied !== null && name === applied.name;
        if (!retry) onRename(currentName, name);
        const saved = retry
          ? store.retryRename(applied)
          : store.renameLabel(currentName, name, setApplied);
        pendingSave.current = saved;
        return saved.finally(() => {
          pendingSave.current = null;
        });
      },
      onClose,
    },
    locked,
  );
  const {changed, save: saveDraft} = draft;
  useEffect(() => {
    const save = changed ? () => pendingSave.current ?? saveDraft() : null;
    onDraft(save);
    return () => onDraft(null);
  }, [onDraft, changed, saveDraft]);
  return (
    <TextField
      aria-label={`${label.name} 이름`}
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
      onBlur={event => {
        if (
          !draft.valid &&
          event.currentTarget.closest('[data-label-manager]')
        ) {
          return;
        }
        if (
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('button') &&
          event.currentTarget
            .closest('[data-label-manager]')
            ?.contains(event.relatedTarget)
        ) {
          return;
        }
        draft.field.onBlur(event);
      }}
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
