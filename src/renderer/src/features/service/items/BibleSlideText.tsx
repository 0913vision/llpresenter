import {useEffect, useEffectEvent, useState, type JSX} from 'react';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {bibleEditedVersesSchema} from '@core/schema/biblePassage';
import type {ServiceId} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {cacheKey} from '@core/bible/split/splitCache';
import {sameBibleVerse} from '@core/bible/selection';
import {editBibleVersePart, snapshotVerseParts} from '@core/bible/editedVerses';
import type {VersePart} from '@core/bible/split/splitVerses';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {isComposing} from '@renderer/ui/ime';
import {SlideTextEditor} from '../slides/SlideTextEditor';
import type {ServiceItemStore} from './serviceItemStore';

export function BibleSlideText({
  items,
  item,
  serviceId,
  part,
  projection,
  readOnly,
}: {
  readonly items: ServiceItemStore;
  readonly item: ServiceItemOf<'bible' | 'sermon'>;
  readonly serviceId: ServiceId;
  readonly part: VersePart;
  readonly projection: BibleProjection;
  readonly readOnly: boolean;
}): JSX.Element {
  const passage = isItemOfKind(item, 'bible')
    ? item.bible
    : item.sermon.passage;
  const verseKey = cacheKey(part.reference);
  const savedParts = passage.editedVerses?.[verseKey];
  const index = part.part - 1;
  const verse = projection.verses.find(verse =>
    sameBibleVerse(verse.reference, part.reference),
  );
  const snapshot =
    savedParts ??
    (verse === undefined
      ? undefined
      : snapshotVerseParts(
          verse.text,
          projection.parts.filter(candidate =>
            sameBibleVerse(candidate.reference, part.reference),
          ),
        ));
  const key = JSON.stringify([
    serviceId,
    item.id,
    verseKey,
    index,
    snapshot?.[index]?.source,
  ]);
  const [, renderTyped] = useState(0);
  const save = (): void => {
    editorTask(items.saveBibleText(key));
  };
  const saveOnLeave = useEffectEvent(save);
  useEffect(() => () => saveOnLeave(), []);
  return (
    <SlideTextEditor
      aria-label="성경 본문"
      value={
        items.bibleTextDraft(key) ?? savedParts?.[index]?.text ?? part.text
      }
      readOnly={readOnly || snapshot === undefined}
      onChange={text => {
        if (snapshot === undefined || readOnly) return;
        items.typeBibleText(key, text, {
          target: {serviceId, itemId: item.id},
          failure: '성경 본문 저장 실패',
          change: fresh => {
            if (
              !isItemOfKind(fresh, 'bible') &&
              !isItemOfKind(fresh, 'sermon')
            ) {
              return null;
            }
            const current = isItemOfKind(fresh, 'bible')
              ? fresh.bible
              : fresh.sermon.passage;
            if (
              current.ref !== passage.ref ||
              current.translation !== passage.translation
            ) {
              return null;
            }
            const saved = current.editedVerses?.[verseKey];
            if (
              saved === undefined &&
              JSON.stringify(current.cuts?.[verseKey]) !==
                JSON.stringify(passage.cuts?.[verseKey])
            ) {
              return null;
            }
            const parts = saved ?? snapshot;
            const changed = editBibleVersePart(parts, snapshot, {index, text});
            if (changed === null) return null;
            if (changed === parts) return fresh;
            const editedVerses = {...current.editedVerses, [verseKey]: changed};
            if (!parsePayload(bibleEditedVersesSchema, editedVerses).ok) {
              return null;
            }
            const updated = {...current, editedVerses};
            return isItemOfKind(fresh, 'bible')
              ? {...fresh, bible: updated}
              : {...fresh, sermon: {...fresh.sermon, passage: updated}};
          },
        });
        renderTyped(version => version + 1);
      }}
      onBlur={save}
      onKeyDown={event => {
        if (
          readOnly ||
          isComposing(event) ||
          !(event.ctrlKey || event.metaKey)
        ) {
          return;
        }
        const shortcut = event.key.toLowerCase();
        if (shortcut !== 'z' && shortcut !== 'y') return;
        event.preventDefault();
        event.stopPropagation();
        editorTask(
          items.saveBibleText(key).then(saved => {
            if (saved) {
              return items.replayItemEdit(
                shortcut === 'y' || event.shiftKey ? 'redo' : 'undo',
                serviceId,
              );
            }
          }),
        );
      }}
    />
  );
}
