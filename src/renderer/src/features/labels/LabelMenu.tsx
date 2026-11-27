import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {classNames} from '@renderer/ui/classNames';
import {Popover} from '@renderer/ui/popups/Popover';
import menuStyles from '@renderer/ui/menus/Menu.module.css';
import {LabelChoices} from './LabelChoices';
import {LabelManagerDialog} from './LabelManagerDialog';
import {labelMenuEntries} from './labelMenuEntries';
import {useChoicePopup} from '@renderer/ui/choices/useChoicePopup';
import type {LabelCatalog} from './labelCatalog';
import styles from './LabelMenu.module.css';
import {SLIDE_LIMITS} from '@core/schema/slides/slide';
import {useTypedValue} from '@renderer/ui/fields/typedValue';

interface LabelMenuProps {
  readonly store: LabelCatalog;
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
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(selected ?? '');
  const nameBox = useRef<HTMLInputElement>(null);
  const shownName = useTypedValue(nameBox, name);
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
  return (
    <Popover>
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
                freeName: () => setNaming(true),
              })}
            />
            {naming ? (
              <input
                ref={nameBox}
                aria-label="이름 적기"
                autoFocus
                maxLength={SLIDE_LIMITS.label}
                defaultValue={shownName.initial}
                onChange={event => {
                  setName(event.currentTarget.value);
                  shownName.typed(event.currentTarget.value);
                }}
                onKeyDown={event => {
                  event.stopPropagation();
                  if (
                    event.key === 'Enter' &&
                    !event.nativeEvent.isComposing &&
                    name.trim() !== ''
                  ) {
                    event.preventDefault();
                    choose(name.trim());
                  } else if (event.key === 'Escape') setNaming(false);
                }}
              />
            ) : null}
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
      </>
    </Popover>
  );
}
