import {useState, type JSX} from 'react';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {createServiceItemId} from '@core/schema/ids';
import {useServiceOrderEditing} from '@renderer/features/service/order/useServiceOrderEditing';
import {useShow} from '@renderer/state/show';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu} from '@renderer/ui/Menu';
import {menuButtonProps} from '@renderer/ui/menuButton';
import type {Notice} from '@renderer/ui/notices';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {otherItemEntries} from './quickAddItems';
import {passageItem, type PassageDefaults} from './quickAddBible';
import {BibleQuickAdd} from './BibleQuickAdd';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {useOtherSources} from './useOtherSources';
import {useHeaderRename} from '@renderer/features/service/state/headerRename';
import {rememberBiblePassage} from '@renderer/features/bible/recentWriter';

const NO_SERVICE_REASON = '열린 예배 순서가 없습니다';

/** Adds non-song items at the end of the selected service section. */
export function ServiceQuickAdd({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [typingPassage, setTypingPassage] = useState(false);
  const sources = useOtherSources(open);
  const reason =
    serviceId === null
      ? NO_SERVICE_REASON
      : readOnly
        ? NEWER_FILE_REASON
        : undefined;
  const disabled = reason !== undefined || editing.busy;
  const insertPassage = (ref: string, defaults: PassageDefaults): void => {
    const passage = passageItem(ref, defaults);
    insertItem(passage);
  };
  const insertItem = (item: ServiceItem): void => {
    const {rows, openItemId} = useShow.getState();
    const before = quickAddBefore(rows, openItemId);
    if ('header' in item) useHeaderRename.getState().request(item.id);
    editing.run(async (edits, id) => {
      const result = await edits.insertItem(
        id,
        item,
        before === null ? null : createServiceItemId(before),
      );
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
