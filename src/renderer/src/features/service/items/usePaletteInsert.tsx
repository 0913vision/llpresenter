import {isItemOfKind} from '@core/schema/service';
import {useState} from 'react';
import {createServiceItemId} from '@core/schema/ids';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {useShow} from '@renderer/session/show';
import {useHeaderRename} from '@renderer/session/headerRename';
import {useOrderFull} from '@renderer/session/orderFull';
import type {PaletteEditing} from './PaletteEditing';
import {BibleQuickAdd} from './BibleQuickAdd';
import {passageItem, type PassageDefaults} from './quickAddBible';
import {createPaletteItem, isPaletteKey} from './paletteItems';
import {rememberBiblePassage} from '@renderer/session/recentWriter';

export function usePaletteInsert(editing: PaletteEditing | null) {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const full = useOrderFull();
  const [bible, setBible] = useState<{
    before: string | null;
    serviceId: string;
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
    if (key === 'bible') {
      setBible({before: target, serviceId});
      return;
    }
    editing.enqueueInsert(async (edits, id) => {
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
      <BibleQuickAdd
        onClose={() => setBible(null)}
        onInsert={(ref: string, defaults: PassageDefaults) => {
          const item = passageItem(ref, defaults);
          const target = bible.before;
          setBible(null);
          editing.enqueueInsert(async (edits, id) => {
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
    ) : null;
  return {insert, disabled, dialog};
}
