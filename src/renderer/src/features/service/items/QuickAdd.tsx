import {useState, type JSX} from 'react';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {createServiceItemId} from '@core/schema/ids';
import {useServiceOrderEditing} from '@renderer/features/service/order/useServiceOrderEditing';
import {openItem, useShow} from '@renderer/session/show';
import {useOrderFull} from '@renderer/session/orderFull';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu} from '@renderer/ui/Menu';
import {menuButtonProps} from '@renderer/ui/menuButton';
import type {Notice} from '@renderer/ui/notices';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {otherItemEntries} from './quickAddItems';
import {passageItem, type PassageDefaults} from './quickAddBible';
import {BibleQuickAdd} from './BibleQuickAdd';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {useOtherSources} from './useOtherSources';
import {useHeaderRename} from '@renderer/session/headerRename';
import {rememberBiblePassage} from '@renderer/session/recentWriter';

const NO_SERVICE_REASON = '열린 예배 없음';

/** Adds non-song items at the end of the selected service section. */
export function ServiceQuickAdd({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const full = useOrderFull();
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [typingPassage, setTypingPassage] = useState(false);
  const sources = useOtherSources(open);
  const reason =
    serviceId === null
      ? NO_SERVICE_REASON
      : readOnly
        ? NEWER_FILE_REASON
        : full
          ? ORDER_FULL_REASON
          : undefined;
  const disabled = reason !== undefined || editing.busy;
  const insertPassage = (ref: string, defaults: PassageDefaults): void => {
    const passage = passageItem(ref, defaults);
    insertItem(passage);
  };
  const insertItem = (
    source: ServiceItem | (() => Promise<ServiceItem>),
  ): void => {
    const api = window.llp;
    if (api === undefined) return;
    const {rows, openItemId} = useShow.getState();
    const selected = rows.findIndex(row => row.id === openItemId);
    const before =
      typeof source === 'function' || isItemOfKind(source, 'slides')
        ? selected < 0
          ? null
          : (rows[selected + 1]?.id ?? null)
        : quickAddBefore(rows, openItemId);
    editing.run(async (edits, id) => {
      const item = typeof source === 'function' ? await source() : source;
      if ('header' in item) useHeaderRename.getState().request(item.id);
      const result = await edits.insertItem(
        id,
        item,
        before === null ? null : createServiceItemId(before),
      );
      if (
        ((result.ok && result.value) ||
          (!result.ok && result.error.reason === 'write-failed')) &&
        isItemOfKind(item, 'slides')
      ) {
        if (useShow.getState().serviceId === id) openItem(item.id);
        const opened = await api.slidesEditor.open({
          serviceId: id,
          itemId: item.id,
          ...(typeof source !== 'function' && item.slides.form === 'blank'
            ? {focusText: true}
            : {}),
        });
        if (!opened.ok) throw new Error('Could not open the added slides item');
      }
      if (
        (result.ok ? result.value : result.error.reason === 'write-failed') &&
        isItemOfKind(item, 'bible')
      ) {
        rememberBiblePassage(item.bible);
      }
      return result;
    });
  };
  return (
    <>
      <IconButton
        ref={setButton}
        icon="plus"
        label="항목 추가"
        menu
        expanded={open}
        disabled={disabled}
        title={reason}
        {...menuButtonProps({
          expanded: open,
          disabled,
          onExpandedChange: next => {
            setTypingPassage(false);
            setOpen(next);
          },
        })}
      />
      {open && !disabled && button !== null ? (
        <Menu
          label="항목 추가"
          anchor={{kind: 'element', element: button}}
          onClose={() => setOpen(false)}
          entries={otherItemEntries({
            ...sources,
            onInsert: insertItem,
            onBible: () => {
              setOpen(false);
              setTypingPassage(true);
            },
          })}
        />
      ) : null}
      {typingPassage && !disabled ? (
        <BibleQuickAdd
          onInsert={insertPassage}
          onClose={() => setTypingPassage(false)}
        />
      ) : null}
    </>
  );
}
