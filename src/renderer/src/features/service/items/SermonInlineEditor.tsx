import {useState, useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {displayReference} from '@core/bible/displayReference';
import {Button} from '@renderer/ui/Button';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {SermonQuickAdd} from './SermonQuickAdd';
import type {ServiceItemStore} from './serviceItemStore';

/** Edit title and passage with the same fields used when adding a sermon. */
export function SermonInlineEditor({
  items,
}: {
  readonly items: ServiceItemStore;
}): JSX.Element | null {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
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
    <section aria-label={'\uc124\uad50 \ud3b8\uc9d1'}>
      <strong>{item.sermon.title}</strong>{' '}
      {displayReference(item.sermon.passage.ref)}{' '}
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
