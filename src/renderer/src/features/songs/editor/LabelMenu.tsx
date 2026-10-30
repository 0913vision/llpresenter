import {useState, useSyncExternalStore, type JSX} from 'react';
import {createPortal} from 'react-dom';
import {TextField} from '@renderer/ui/TextField';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {layerContainer} from '@renderer/ui/layers';
import menuStyles from '@renderer/ui/Menu.module.css';
import {labelNameReason} from './LabelDialog';
import {LabelChoices, type LabelContext} from './LabelChoices';
import {LabelManagement} from './LabelManagement';
import {LabelSettingsDialog} from './LabelSettingsDialog';
import {labelMenuEntries} from './labelMenuEntries';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
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

/** Label choices, inline creation, and shared settings. */
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
  const disabledReason = busy
    ? '이름표 저장 중'
    : document?.access !== 'editable'
      ? '읽기 전용 이름표 목록'
      : undefined;
  const locked = disabledReason !== undefined;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [context, setContext] = useState<LabelContext | null>(null);
  const [settings, setSettings] = useState(false);
  const reason = labelNameReason(name, labels);
  const {surface, onKeyDown} = useChoicePopup({
    anchor,
    onClose: restoreFocus => {
      if (!settings && context === null) onClose(restoreFocus);
    },
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
            entries={labelMenuEntries({
              labels,
              selected,
              locked,
              choose,
              create: () => setCreating(true),
              settings: () => setSettings(true),
            })}
            onContext={value => {
              value.trigger.focus();
              setContext(value);
            }}
            creation={
              creating ? (
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
                      if (
                        event.key === 'Enter' &&
                        !isComposing(event) &&
                        !hasModifier(event)
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        editorTask(create());
                      }
                    }}
                  />
                </div>
              ) : null
            }
          />
        </div>
      </div>
      {settings ? (
        <LabelSettingsDialog
          store={store}
          onClose={() => {
            setSettings(false);
            surface.current
              ?.querySelector<HTMLElement>('[data-choice-id="settings"]')
              ?.focus();
          }}
        />
      ) : null}
      {context === null ? null : (
        <LabelManagement
          context={context}
          store={store}
          labels={labels}
          disabledReason={disabledReason}
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
