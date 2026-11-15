import {useState, useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind, SLIDES_LIMITS} from '@core/schema/service';
import {displayReference} from '@core/bible/displayReference';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {Button} from '@renderer/ui/Button';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {TextField} from '@renderer/ui/TextField';
import type {ServiceItemStore} from './serviceItemStore';

export function SermonInlineEditor({
  items,
}: {
  readonly items: ServiceItemStore;
}): JSX.Element | null {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const item = state.item;
  if (
    item === null ||
    !isItemOfKind(item, 'sermon') ||
    state.service === null
  ) {
    return null;
  }
  return (
    <SermonFields
      key={item.id}
      items={items}
      item={item}
      serviceId={state.service.service.id}
      locked={state.busy || state.service.access === 'readOnly'}
    />
  );
}

function SermonFields({
  items,
  item,
  serviceId,
  locked,
}: {
  readonly items: ServiceItemStore;
  readonly item: import('@core/schema/service').ServiceItemOf<'sermon'>;
  readonly serviceId: string;
  readonly locked: boolean;
}): JSX.Element {
  const [title, setTitle] = useState(item.sermon.title);
  const [editingPassage, setEditingPassage] = useState(false);
  const target = {serviceId, itemId: item.id};
  const saveTitle = (): void => {
    const value = title.trim();
    if (!value || value === item.sermon.title) {
      if (!value) setTitle(item.sermon.title);
      return;
    }
    editorTask(
      items.submitItemEdit({
        target,
        failure: '\uc124\uad50 \uc81c\ubaa9 \uc800\uc7a5 \uc2e4\ud328',
        change: current =>
          isItemOfKind(current, 'sermon')
            ? {...current, sermon: {...current.sermon, title: value}}
            : null,
      }),
    );
  };
  return (
    <section aria-label={'\uc124\uad50 \ud3b8\uc9d1'}>
      <label htmlFor="sermon-title">{'\uc81c\ubaa9'}</label>
      <TextField
        id="sermon-title"
        value={title}
        onChange={setTitle}
        onBlur={saveTitle}
        maxLength={SLIDES_LIMITS.name}
        disabled={locked}
        block
      />
      <div>
        {'\ubcf8\ubb38'}: {displayReference(item.sermon.passage.ref)}{' '}
        <Button disabled={locked} onClick={() => setEditingPassage(true)}>
          {'\ubcc0\uacbd'}
        </Button>
      </div>
      {editingPassage && window.llp !== undefined ? (
        <BiblePassageDialog
          api={window.llp.bible}
          translation={item.sermon.passage.translation}
          onClose={() => setEditingPassage(false)}
          onChoose={passage => {
            setEditingPassage(false);
            editorTask(
              items.submitItemEdit({
                target,
                failure: '\uc124\uad50 \ubcf8\ubb38 \uc800\uc7a5 \uc2e4\ud328',
                change: current =>
                  isItemOfKind(current, 'sermon')
                    ? {
                        ...current,
                        sermon: {
                          ...current.sermon,
                          passage: {
                            ...current.sermon.passage,
                            ref: passage.ref,
                            translation: passage.translation,
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
