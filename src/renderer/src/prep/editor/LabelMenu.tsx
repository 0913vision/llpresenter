import {useState, useSyncExternalStore, type JSX} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from '@renderer/ui/Icon';
import {LabelColorPicker} from '@renderer/ui/LabelColorPicker';
import {TextField} from '@renderer/ui/TextField';
import {Tooltip} from '@renderer/ui/Tooltip';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/ime';
import {layerContainer} from '@renderer/ui/layers';
import menuStyles from '@renderer/ui/Menu.module.css';
import {labelNameReason} from './LabelDialog';
import {LabelChoices, type LabelContext} from './LabelChoices';
import {LabelManagement} from './LabelManagement';
import {useLabelPopup} from './useLabelPopup';
import type {SongEditorStore} from './songEditorStore';
import {editorTask} from './editorTask';
import styles from './LabelMenu.module.css';

interface LabelMenuProps {
  readonly store: SongEditorStore;
  readonly anchor: HTMLElement;
  readonly selected: string | undefined;
  readonly onChoose: (name: string | undefined) => void;
  readonly onClose: (restoreFocus: boolean) => void;
}

/** Label choices, persistent color row, and inline creation in one popup. */
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
  const locked = busy || document?.access !== 'editable';
  const lockReason = busy
    ? '저장 중'
    : document === null
      ? '이름표 불러오는 중'
      : '읽기 전용 이름표';
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [context, setContext] = useState<LabelContext | null>(null);
  const current = labels.find(label => label.name === selected);
  const reason = labelNameReason(name, labels);
  const {surface, onKeyDown} = useLabelPopup({
    anchor,
    onClose,
    onEscape: () => {
      if (creating) {
        setCreating(false);
        surface.current?.querySelector<HTMLElement>('[data-new]')?.focus();
      } else onClose(true);
    },
  });
  const choose = (value: string | undefined): void => {
    if (busy) return;
    onChoose(value);
    onClose(true);
  };
  const create = async (): Promise<void> => {
    if (locked || reason !== undefined) return;
    const created = name.trim();
    if (
      await store.updateLabels([
        ...labels,
        {name: created, color: 'none', key: null},
      ])
    ) {
      choose(created);
    }
  };
  return createPortal(
    <>
      <div className={menuStyles.layer}>
        <div
          ref={surface}
          role="menu"
          aria-label="이름표"
          className={classNames(menuStyles.menu, styles.popup)}
          onKeyDown={onKeyDown}
          onBlur={event => {
            const target = event.relatedTarget;
            if (
              target instanceof Element &&
              !event.currentTarget.contains(target) &&
              target.closest(
                '[data-llp-layer="popover"], [data-llp-layer="dialog"]',
              ) === null
            ) {
              onClose(false);
            }
          }}
        >
          <LabelChoices
            labels={labels}
            selected={selected}
            onChoose={choose}
            onContext={value => {
              if (!locked) {
                value.trigger.focus();
                setContext(value);
              }
            }}
          />
          {current === undefined ? null : (
            <>
              <div role="separator" className={menuStyles.separator} />
              <Tooltip text={locked ? lockReason : `${current.name} 색`}>
                <fieldset disabled={locked} className={styles.colors}>
                  <LabelColorPicker
                    label={`${current.name} 색`}
                    scope="모든 곡에 적용"
                    name={`${current.name} 색`}
                    inMenu
                    value={current.color}
                    onChange={color =>
                      editorTask(
                        store.updateLabels(
                          labels.map(label =>
                            label.name === current.name
                              ? {...label, color}
                              : label,
                          ),
                        ),
                      )
                    }
                  />
                </fieldset>
              </Tooltip>
            </>
          )}
          <div role="separator" className={menuStyles.separator} />
          {creating ? (
            <div className={styles.create}>
              <TextField
                aria-label="새 이름표 이름"
                value={name}
                onChange={setName}
                autoFocus
                block
                size="sm"
                readOnly={locked}
                invalid={name !== '' && reason !== undefined}
                invalidReason={name === '' ? undefined : reason}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !isComposing(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    editorTask(create());
                  }
                }}
              />
            </div>
          ) : (
            <Tooltip text={locked ? lockReason : '새 이름표'}>
              <button
                type="button"
                role="menuitem"
                data-choice
                data-new
                className={classNames(menuStyles.item, styles.choice)}
                aria-disabled={locked}
                onClick={() => {
                  if (!locked) setCreating(true);
                }}
              >
                <span className={menuStyles.lead}>
                  <Icon name="plus" size={14} />
                </span>
                새 이름표
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      {context === null ? null : (
        <LabelManagement
          context={context}
          store={store}
          labels={labels}
          locked={locked}
          onClose={() => {
            setContext(null);
            (
              surface.current?.querySelector<HTMLElement>(
                '[aria-checked="true"]',
              ) ?? surface.current?.querySelector<HTMLElement>('[data-choice]')
            )?.focus();
          }}
        />
      )}
    </>,
    layerContainer('popover'),
  );
}
