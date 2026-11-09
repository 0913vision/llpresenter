import {useState} from 'react';
import {useShow} from '@renderer/session/show';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {useServicePicker} from './useServicePicker';
import {useServiceRowMenu} from './useServiceRowMenu';

const PICKER_WIDTH = 300;

/** The service picker shared by the order heading and File menu. */
export function useServicePickerMenu(onProblem: (notice: Notice) => void) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const picker = useServicePicker(onProblem);
  const actions = useServiceActions({onProblem, onOpen: picker.close});
  const rows = useServiceRowMenu(onProblem, picker.close);
  const currentId = useShow(view => view.serviceId);
  const openAt = (element: HTMLElement): void => {
    setAnchor(element);
    if (!picker.open) picker.toggle();
  };
  const toggleAt = (element: HTMLElement): void => {
    setAnchor(element);
    picker.toggle();
  };
  const overlays = (
    <>
      {picker.open && anchor ? (
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
          ]}
        />
      ) : null}
      {actions.dialogs}
      {rows.overlays}
    </>
  );
  return {open: picker.open, busy: picker.busy, openAt, toggleAt, overlays};
}
