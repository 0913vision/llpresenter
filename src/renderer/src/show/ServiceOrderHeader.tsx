import {useState, type JSX} from 'react';
import {useShow} from '@renderer/state/show';
import {Icon} from '@renderer/ui/Icon';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useServicePicker} from './useServicePicker';
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
  const currentId = useShow(view => view.serviceId);
  const name = useShow(view =>
    view.serviceId === null ? null : view.serviceName,
  );
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
        onClick={event => {
          setAnchor(event.currentTarget);
          picker.toggle();
        }}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: picker.open,
            disabled: window.llp === undefined || picker.busy,
            onExpandedChange: () => {
              setAnchor(event.currentTarget);
              picker.toggle();
            },
          })
        }
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
          onClose={picker.close}
          search={{value: picker.query, onChange: picker.setQuery}}
          entries={picker.visible.map(entry => ({
            kind: 'item',
            id: entry.id,
            label: entry.name,
            meta: `${Number(entry.date.slice(5, 7))}월 ${Number(entry.date.slice(8, 10))}일`,
            check: 'radio',
            checked: entry.id === currentId,
            onSelect: () => picker.select(entry),
          }))}
        />
      ) : null}
    </>
  );
}
