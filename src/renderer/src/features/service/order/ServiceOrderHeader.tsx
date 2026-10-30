import {useState, type JSX} from 'react';
import {useShow} from '@renderer/state/show';
import {Icon} from '@renderer/ui/Icon';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useButtonPress} from '@renderer/ui/press';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {useServicePicker} from './useServicePicker';
import {useServiceRowMenu} from './useServiceRowMenu';
import styles from './ServiceOrderHeader.module.css';

const CHEVRON_SIZE = 12;
const PICKER_WIDTH = 300;

function logProblem(notice: Notice): void {
  console.error('Service picker failed:', notice.key);
}

/** The chosen service and its service picker. */
export function ServiceOrderHeader({
  onProblem = logProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const picker = useServicePicker(onProblem);
  const actions = useServiceActions({onProblem, onOpen: picker.close});
  const rows = useServiceRowMenu(onProblem, picker.close);
  const currentId = useShow(view => view.serviceId);
  const name = useShow(view =>
    view.serviceId === null ? null : view.serviceName,
  );
  const disabled = window.llp === undefined || picker.busy;
  const press = useButtonPress<HTMLButtonElement>({
    disabled,
    onPress: event => {
      setAnchor(event.currentTarget);
      picker.toggle();
    },
    onKeyDown: event =>
      openOnArrowDown(event, {
        expanded: picker.open,
        disabled,
        onExpandedChange: () => {
          setAnchor(event.currentTarget);
          picker.toggle();
        },
      }),
  });
  return (
    <>
      <button
        type="button"
        className={styles.heading}
        aria-haspopup="menu"
        aria-expanded={picker.open}
        aria-busy={picker.busy}
        disabled={window.llp === undefined}
        aria-disabled={picker.busy || undefined}
        {...press}
      >
        <TruncatedText text={name ?? '예배 순서'} className={styles.name} />
        {name === null ? null : (
          <Icon name="down" size={CHEVRON_SIZE} className={styles.chevron} />
        )}
      </button>
      {picker.open && anchor ? (
        <Menu
          label="예배 순서 선택"
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
}
