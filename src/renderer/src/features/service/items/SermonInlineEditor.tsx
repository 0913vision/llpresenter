import {useState, useSyncExternalStore, type JSX} from 'react';
import {SLIDES_LIMITS} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {displayReference} from '@core/bible/displayReference';
import {Button} from '@renderer/ui/Button';
import {TextArea} from '@renderer/ui/TextArea';
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
      aria-label={'제목'}
      placeholder={'제목'}
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

/** Edit title and passage with the same fields used when adding a sermon. */
export function SermonInlineEditor({
  items,
  shownItem,
  showSourceTitle = true,
}: {
  readonly items: ServiceItemStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
  readonly showSourceTitle?: boolean;
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
    <section aria-label="설교 편집" className={styles.editor}>
      {showSourceTitle ? (
        <SermonTitleField
          key={item.sermon.title}
          title={item.sermon.title}
          disabled={state.busy || state.service.access === 'readOnly'}
          onCommit={title => {
            editorTask(
              items.submitItemEdit({
                target: {serviceId, itemId: item.id},
                failure: '설교 저장 실패',
                change: current =>
                  isItemOfKind(current, 'sermon')
                    ? {...current, sermon: {...current.sermon, title}}
                    : null,
              }),
            );
          }}
        />
      ) : null}
      <span className={styles.passage}>
        {displayReference(item.sermon.passage.ref)}
      </span>
      <Button
        disabled={state.busy || state.service.access === 'readOnly'}
        onClick={() => setEditing(true)}
      >
        {'변경'}
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
                failure: '설교 저장 실패',
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
