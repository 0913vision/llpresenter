import type {JSX} from 'react';
import {useShow} from '@renderer/session/show';
import {Icon} from '@renderer/ui/Icon';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import type {Notice} from '@renderer/ui/notices';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useButtonPress} from '@renderer/ui/press';
import {useServicePickerMenu} from './useServicePickerMenu';
import styles from './ServiceOrderHeader.module.css';

const CHEVRON_SIZE = 12;

function logProblem(notice: Notice): void {
  console.error('Service picker failed:', notice.key);
}

/** The chosen service and its service picker. */
export function ServiceOrderHeader({
  onProblem = logProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const picker = useServicePickerMenu(onProblem);
  const name = useShow(view =>
    view.serviceId === null ? null : view.serviceName,
  );
  const disabled = window.llp === undefined || picker.busy;
  const press = useButtonPress<HTMLButtonElement>({
    disabled,
    onPress: event => {
      picker.toggleAt(event.currentTarget);
    },
    onKeyDown: event =>
      openOnArrowDown(event, {
        expanded: picker.open,
        disabled,
        onExpandedChange: () => {
          picker.toggleAt(event.currentTarget);
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
      {picker.overlays}
    </>
  );
}
