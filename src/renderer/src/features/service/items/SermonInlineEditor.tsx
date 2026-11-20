import {useState, useSyncExternalStore, type JSX} from 'react';
import {SLIDES_LIMITS} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {displayReference} from '@core/bible/displayReference';
import {Button} from '@renderer/ui/Button';
import {TextArea} from '@renderer/ui/TextArea';
import {TextField} from '@renderer/ui/TextField';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {SermonQuickAdd} from './SermonQuickAdd';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './SermonInlineEditor.module.css';

/** The title as typed, line breaks included; saved when the field is left. */
function SermonTitleField({
  title,
  disabled,
  onCommit,
}: {
  readonly title: string;
  readonly disabled: boolean;
  readonly onCommit: (title: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(title);
  return (
    <TextArea
      aria-label={'\uc81c\ubaa9'}
      placeholder={'\uc81c\ubaa9'}
      className={styles.title}
      value={draft}
      rows={2}
      maxLength={SLIDES_LIMITS.name}
      disabled={disabled}
      onChange={setDraft}
      onKeyDown={event => {
        if (event.key === 'Enter') event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(title);
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = draft.trim();
        if (next === '') setDraft(title);
        else if (next !== title) onCommit(next);
      }}
    />
  );
}

function SermonReferenceField({
  reference,
  disabled,
  onCommit,
}: {
  readonly reference: string;
  readonly disabled: boolean;
  readonly onCommit: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(reference);
  return (
    <label className={styles.reference}>
      본문 주소
      <TextField
        aria-label="본문 주소"
        value={draft}
        maxLength={4000}
        disabled={disabled}
        onChange={setDraft}
        onBlur={() => {
          if (draft !== reference) onCommit(draft);
        }}
      />
    </label>
  );
}

/** Edit title and passage with the same fields used when adding a sermon. */
export function SermonInlineEditor({
  items,
  shownItem,
}: {
  readonly items: ServiceItemStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
}): JSX.Element | null {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const state = shownItem ?? current;
  const [editing, setEditing] = useState(false);
  const item = state.item;
  if (
    item === null ||
    !isItemOfKind(item, 'sermon') ||
    state.service === null
  ) {
    return null;
  }
  const serviceId = state.service.service.id;
  return (
    <section aria-label={'\uc124\uad50 \ud3b8\uc9d1'} className={styles.editor}>
      <SermonTitleField
        key={item.sermon.title}
        title={item.sermon.title}
        disabled={state.busy || state.service.access === 'readOnly'}
        onCommit={title => {
          editorTask(
            items.submitItemEdit({
              target: {serviceId, itemId: item.id},
              failure: '\uc124\uad50 \uc800\uc7a5 \uc2e4\ud328',
              change: current =>
                isItemOfKind(current, 'sermon')
                  ? {...current, sermon: {...current.sermon, title}}
                  : null,
            }),
          );
        }}
      />
      <SermonReferenceField
        key={`${item.id}:${item.sermon.reference ?? item.sermon.passage.ref}`}
        reference={
          item.sermon.reference ?? displayReference(item.sermon.passage.ref)
        }
        disabled={state.busy || state.service.access === 'readOnly'}
        onCommit={reference => {
          editorTask(
            items.submitItemEdit({
              target: {serviceId, itemId: item.id},
              failure: '\uc124\uad50 \uc800\uc7a5 \uc2e4\ud328',
              change: current => {
                if (!isItemOfKind(current, 'sermon')) return null;
                const {reference: _previous, ...sermon} = current.sermon;
                return {
                  ...current,
                  sermon:
                    reference.trim() === ''
                      ? sermon
                      : {...sermon, reference},
                };
              },
            }),
          );
        }}
      />
      <span className={styles.passage}>
        {displayReference(item.sermon.passage.ref)}
      </span>
      <Button
        disabled={state.busy || state.service.access === 'readOnly'}
        onClick={() => setEditing(true)}
      >
        {'\ubcc0\uacbd'}
      </Button>
      {editing ? (
        <SermonQuickAdd
          initial={item}
          onClose={() => setEditing(false)}
          onInsert={(title, ref, defaults) => {
            setEditing(false);
            editorTask(
              items.submitItemEdit({
                target: {serviceId, itemId: item.id},
                failure: '\uc124\uad50 \uc800\uc7a5 \uc2e4\ud328',
                change: current =>
                  isItemOfKind(current, 'sermon')
                    ? {
                        ...current,
                        sermon: {
                          ...current.sermon,
                          title,
                          passage: {
                            ...current.sermon.passage,
                            ref,
                            translation: defaults.translation,
                          },
                        },
                      }
                    : null,
              }),
            );
          }}
        />
      ) : null}
    </section>
  );
}
