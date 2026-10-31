import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {createPortal} from 'react-dom';
import {classNames} from '@renderer/ui/classNames';
import {layerContainer} from '@renderer/ui/layers';
import menuStyles from '@renderer/ui/Menu.module.css';
import {LabelChoices} from './LabelChoices';
import {LabelManagerDialog} from './LabelManagerDialog';
import {labelMenuEntries} from './labelMenuEntries';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import type {SongEditorStore} from './songEditorStore';
import styles from './LabelMenu.module.css';

interface LabelMenuProps {
  readonly store: SongEditorStore;
  readonly anchor: HTMLElement;
  readonly selected: string | undefined;
  readonly onChoose: (name: string | undefined) => void;
  readonly onClose: (restoreFocus: boolean) => void;
}

/** Picks a label or opens the shared catalog manager. */
export function LabelMenu({
  store,
  anchor,
  selected,
  onChoose,
  onClose,
}: LabelMenuProps): JSX.Element {
  const {labels: document, busy} = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const labels = document?.value.labels ?? [];
  const [managing, setManaging] = useState(false);
  const wasManaging = useRef(false);
  const {surface, onKeyDown} = useChoicePopup({
    anchor,
    onClose: restoreFocus => {
      if (!managing) onClose(restoreFocus);
    },
    onEscape: () => onClose(true),
  });
  useEffect(() => {
    if (!managing && wasManaging.current) {
      surface.current
        ?.querySelector<HTMLElement>('[data-choice-id="manage"]')
        ?.focus();
    }
    wasManaging.current = managing;
  }, [managing, surface]);
  const choose = (value: string | undefined): void => {
    if (busy) return;
    onChoose(value);
    onClose(true);
  };
  return createPortal(
    <>
      <div className={menuStyles.layer}>
        <div
          ref={surface}
          hidden={managing}
          role="menu"
          aria-label="이름표"
          data-check-column="true"
          className={classNames(menuStyles.menu, styles.popup)}
          onKeyDown={onKeyDown}
          onBlur={event => {
            const target = event.relatedTarget;
            if (
              !managing &&
              target instanceof Element &&
              !event.currentTarget.contains(target) &&
              target.closest('[data-llp-layer="dialog"]') === null
            ) {
              onClose(false);
            }
          }}
        >
          <LabelChoices
            entries={labelMenuEntries({
              labels,
              selected,
              choose,
              manage: () => setManaging(true),
            })}
          />
        </div>
      </div>
      {managing ? (
        <LabelManagerDialog
          store={store}
          onClose={() => {
            setManaging(false);
          }}
        />
      ) : null}
    </>,
    layerContainer('popover'),
  );
}
