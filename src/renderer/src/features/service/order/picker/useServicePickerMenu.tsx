import {warningNotice} from '@renderer/ui/popups/notices';
import {useRef, useState} from 'react';
import {useShow} from '@renderer/session/show';
import {Menu} from '@renderer/ui/menus/Menu';
import type {Notice} from '@renderer/ui/popups/notices';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {renameService} from '@renderer/features/service/list/serviceEdits';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {useServicePicker} from './useServicePicker';
import {useServiceRowMenu} from './useServiceRowMenu';
import {useUndoKeys} from '@renderer/platform/useUndoKeys';

const PICKER_WIDTH = 300;

/** The service picker shared by the order heading and File menu. */
export function useServicePickerMenu(onProblem: (notice: Notice) => void) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const anchorRef = useRef<HTMLElement>(null);
  useUndoKeys(anchorRef, onProblem);
  const picker = useServicePicker(onProblem);
  const actions = useServiceActions({onProblem, onOpen: picker.close});
  const rows = useServiceRowMenu(onProblem, picker.close, picker.select);
  const currentId = useShow(view => view.serviceId);
  const api = window.llp;
  const [renaming, setRenaming] = useState(false);
  const current = picker.entries.find(entry => entry.id === currentId);
  const openAt = (element: HTMLElement): void => {
    anchorRef.current = element;
    setAnchor(element);
    if (!picker.open) picker.toggle();
  };
  const toggleAt = (element: HTMLElement): void => {
    anchorRef.current = element;
    setAnchor(element);
    picker.toggle();
  };
  const overlays = (
    <>
      {picker.open && picker.ready && anchor ? (
        <Menu
          label="예배 선택"
          anchor={{kind: 'element', element: anchor}}
          width={PICKER_WIDTH}
          onClose={() => {
            if (document.activeElement instanceof HTMLInputElement) {
              document.activeElement.blur();
            }
            rows.cancelRename();
            picker.close();
          }}
          search={{value: picker.query, onChange: picker.setQuery}}
          entries={[
            ...picker.visible.map((entry): MenuEntry => ({
              kind: 'item',
              id: entry.id,
              label: entry.name,
              meta: `${Number(entry.date.slice(5, 7))}월 ${Number(entry.date.slice(8, 10))}일`,
              check: 'radio',
              checked: entry.id === currentId,
              onSelect: () => picker.select(entry),
              onMenu: anchor => rows.openMenu(entry, anchor),
              rename: rows.renameFor(entry),
            })),
            ...(picker.visible.length === 0
              ? []
              : [{kind: 'separator', id: 'service-actions'} as const]),
            {...actions.entries.newService, label: '새 예배…', icon: undefined},
            {
              kind: 'item',
              id: 'rename-open',
              label: '이름 바꾸기…',
              ...menuAvailability(
                current === undefined
                  ? '열린 예배 없음'
                  : current.access === 'editable'
                    ? undefined
                    : NEWER_FILE_REASON,
              ),
              onSelect: () => {
                picker.close();
                setRenaming(true);
              },
            },
          ]}
        />
      ) : null}
      {picker.guardDialog}
      {actions.dialogs}
      {rows.overlays}
      {renaming && current !== undefined && api !== undefined ? (
        <RenameDialog
          name={current.name}
          title="예배 이름 바꾸기"
          rename={{
            onCommit: async name => {
              const done = await renameService(api, current.id, name);
              if (done) setRenaming(false);
              else {
                onProblem(warningNotice('service:rename', '이름 바꾸기 실패'));
              }
              return done;
            },
            onClose: () => setRenaming(false),
          }}
        />
      ) : null}
    </>
  );
  return {open: picker.open, busy: picker.busy, openAt, toggleAt, overlays};
}
