import {isItemOfKind} from '@core/schema/service';
import {useState} from 'react';
import {createServiceItemId} from '@core/schema/ids';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {useShow} from '@renderer/session/show';
import {useHeaderRename} from '@renderer/session/headerRename';
import {useOrderFull} from '@renderer/session/orderFull';
import type {PaletteEditing} from './PaletteEditing';
import {SermonQuickAdd} from './SermonQuickAdd';
import {BibleQuickAdd} from './BibleQuickAdd';
import {passageItemWithParts, type PassageDefaults} from './quickAddBible';
import {createPaletteItem, isPaletteKey} from './paletteItems';
import {rememberBiblePassage} from '@renderer/session/recentWriter';

export function usePaletteInsert(editing: PaletteEditing | null) {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const full = useOrderFull();
  const [bible, setBible] = useState<{
    before: string | null;
    serviceId: string;
    kind: 'bible' | 'sermon';
  } | null>(null);
  const disabled = serviceId === null || readOnly || full || editing === null;
  const insert = (
    key: string,
    before?: string | null,
    translation: 'new' | 'old' = 'new',
  ): void => {
    if (
      serviceId === null ||
      readOnly ||
      full ||
      editing === null ||
      !isPaletteKey(key)
    ) {
      return;
    }
    const snapshot = useShow.getState();
    const target =
      before === undefined
        ? quickAddBefore(snapshot.rows, snapshot.openItemId)
        : before;
    if (key === 'bible' || key === 'sermon') {
      setBible({before: target, serviceId, kind: key});
      return;
    }
    editing.enqueueEdit(async (edits, id) => {
      const item = await createPaletteItem(key, translation);
      if (item === null) throw new Error('Unknown palette item');
      if ('header' in item) useHeaderRename.getState().request(item.id);
      return edits.insertItem(
        id,
        item,
        target === null ? null : createServiceItemId(target),
      );
    });
  };
  const dialog =
    bible?.serviceId === serviceId && !readOnly && editing !== null ? (
      bible.kind === 'sermon' ? (
        <SermonQuickAdd
          onClose={() => setBible(null)}
          onInsert={(title, ref, defaults) => {
            const api = window.llp;
            if (api === undefined) return;
            const target = bible.before;
            setBible(null);
            editing.enqueueEdit(async (edits, id) => {
              const prepared = await passageItemWithParts(ref, defaults, {
                api,
                serviceId: id,
                sermonTitle: title,
              });
              if (!prepared.ok) return prepared;
              const passage = prepared.value;
              if (passage === null) return {ok: true, value: false};
              const item = {
                id: passage.id,
                sermon: {
                  title,
                  passage: passage.bible,
                  ...(defaults.sermonTitleTransition === undefined
                    ? {}
                    : {
                        openingTransition: defaults.sermonTitleTransition,
                        closingTransition: defaults.sermonTitleTransition,
                      }),
                },
              };
              const result = await edits.insertItem(
                id,
                item,
                target === null ? null : createServiceItemId(target),
              );
              if (result.ok && result.value) {
                rememberBiblePassage(passage.bible);
              }
              return result;
            });
          }}
        />
      ) : (
        <BibleQuickAdd
          onClose={() => setBible(null)}
          onInsert={(ref: string, defaults: PassageDefaults) => {
            const api = window.llp;
            if (api === undefined) return;
            const target = bible.before;
            setBible(null);
            editing.enqueueEdit(async (edits, id) => {
              const prepared = await passageItemWithParts(ref, defaults, {
                api,
                serviceId: id,
              });
              if (!prepared.ok) return prepared;
              const item = prepared.value;
              if (item === null) return {ok: true, value: false};
              const result = await edits.insertItem(
                id,
                item,
                target === null ? null : createServiceItemId(target),
              );
              if (result.ok && result.value && isItemOfKind(item, 'bible')) {
                rememberBiblePassage(item.bible);
              }
              return result;
            });
          }}
        />
      )
    ) : null;
  return {insert, disabled, dialog};
}
