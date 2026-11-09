import {useState, type JSX} from 'react';
import {createServiceItemId} from '@core/schema/ids';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {useHeaderRename} from '@renderer/session/headerRename';
import {openItem, useShow} from '@renderer/session/show';
import {useOrderFull} from '@renderer/session/orderFull';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {rememberBiblePassage} from '@renderer/session/recentWriter';
import {Button} from '@renderer/ui/Button';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {BibleQuickAdd} from '../items/BibleQuickAdd';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {passageItem, type PassageDefaults} from '../items/quickAddBible';
import {otherItemEntries} from '../items/quickAddItems';
import {useOtherSources} from '../items/useOtherSources';
import {useServiceOrderEditing} from '../order/useServiceOrderEditing';
import styles from './ServiceTable.module.css';

const SECTION_NAME = '새 구역';
const NO_SERVICE_REASON = '열린 예배 없음';

/** Footer adders; slide items open after the selection, other rows append. */
export function ServiceTableFooter({
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
  const append = (source: ServiceItem | (() => Promise<ServiceItem>)): void => {
    const {rows, openItemId} = useShow.getState();
    const selected = rows.findIndex(row => row.id === openItemId);
    const before =
      (typeof source === 'function' || isItemOfKind(source, 'slides')) &&
      selected >= 0
        ? rows[selected + 1]?.id
        : undefined;
    editing.run(async (edits, id) => {
      const item = typeof source === 'function' ? await source() : source;
      if ('header' in item) useHeaderRename.getState().request(item.id);
      const result = await edits.insertItem(
        id,
        item,
        before === undefined ? null : createServiceItemId(before),
      );
      if (
        isItemOfKind(item, 'slides') &&
        (result.ok ? result.value : result.error.reason === 'write-failed')
      ) {
        if (useShow.getState().serviceId === id) openItem(item.id);
        const opened = await window.llp?.slidesEditor.open({
          serviceId: id,
          itemId: item.id,
          ...(typeof source !== 'function' && item.slides.form === 'blank'
            ? {focusText: true}
            : {}),
        });
        if (!opened?.ok) {
          throw new Error('Could not open the added slides item');
        }
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
  const appendPassage = (ref: string, defaults: PassageDefaults): void =>
    append(passageItem(ref, defaults));
  return (
    <div className={styles.footer}>
      <Button
        ref={setButton}
        variant="ghost"
        icon="plus"
        disabled={disabled}
        title={reason}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setTypingPassage(false);
          setOpen(true);
        }}
      >
        항목
      </Button>
      <Button
        variant="ghost"
        icon="plus"
        disabled={disabled}
        title={reason}
        onClick={() =>
          append({
            id: createServiceItemId(crypto.randomUUID()),
            header: SECTION_NAME,
          })
        }
      >
        구역
      </Button>
      {open && !disabled && button !== null ? (
        <Menu
          label="항목 추가"
          anchor={{kind: 'element', element: button}}
          onClose={() => setOpen(false)}
          entries={otherItemEntries({
            ...sources,
            onInsert: item => {
              setOpen(false);
              append(item);
            },
            onBible: () => {
              setOpen(false);
              setTypingPassage(true);
            },
          })}
        />
      ) : null}
      {typingPassage && !disabled ? (
        <BibleQuickAdd
          onInsert={appendPassage}
          onClose={() => setTypingPassage(false)}
        />
      ) : null}
    </div>
  );
}
