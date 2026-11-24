import {NAME_LIMIT} from '@core/schema/common/primitives';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {Fragment, useLayoutEffect, useState, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {parseMacroCollectionId} from '@core/schema/common/ids';
import {
  MACRO_FILE_LIMITS,
  type MacroCollection,
} from '@core/schema/tools/macros';
import {Icon, Select} from '@renderer/ui';
import {classNames} from '@renderer/ui/classNames';
import {Popover} from '@renderer/ui/popups/Popover';
import type {MenuAnchor} from '@renderer/ui/menus/Menu';
import type {Notice} from '@renderer/ui/popups/notices';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import {isComposing} from '@renderer/ui/fields/ime';
import {ListInsertLine} from '@renderer/ui/lists/ListRow';
import {stepMove} from '@renderer/ui/lists/reorder';
import {useChoicePopup} from '@renderer/ui/choices/useChoicePopup';
import menuStyles from '@renderer/ui/menus/Menu.module.css';
import type {MacroCollectionEdit} from './macroCollectionEdits';
import {useCollectionEditing} from './useMacroWrites';
import {MacroCollectionMenu} from './macroCollectionMenuEntries';
import {MacroCollectionRow} from './MacroCollectionRow';
import {useCollectionDrag} from './useCollectionDrag';
import styles from './MacroCollectionPicker.module.css';

const ALL = 'all';
interface CollectionProps {
  readonly collections: readonly MacroCollection[];
  readonly value: MacroCollection['id'] | undefined;
  readonly locked: boolean;
  readonly onChange: (id: MacroCollection['id'] | undefined) => void;
  readonly onDelete: (item: MacroCollection) => void;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onNew?: (() => void) | undefined;
}

/** The row under the 모음 that makes a new one. */
function NewCollectionRow({
  disabled,
  onAdd,
}: {
  readonly disabled: boolean;
  readonly onAdd: () => void;
}): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={-1}
      data-choice=""
      className={classNames(menuStyles.item, styles.row)}
      aria-disabled={disabled ? true : undefined}
      onClick={onAdd}
      onKeyDown={event => {
        if (
          !hasModifier(event) &&
          !isComposing(event) &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          onAdd();
        }
      }}
    >
      <span className={menuStyles.icon}>
        <Icon name="plus" size={16} />
      </span>
      <span className={menuStyles.label}>새 매크로 모음</span>
    </div>
  );
}

function CollectionPopover({
  anchor,
  onClose,
  ...props
}: CollectionProps & {
  readonly anchor: HTMLElement;
  readonly onClose: (restore: boolean) => void;
}): JSX.Element {
  const {collections, value, onChange, onDelete} = props;
  const {busy, run} = useCollectionEditing(props.onProblem);
  const locked = props.locked || busy || window.llp === undefined;
  const [context, setContext] = useState<{
    id: string;
    anchor: MenuAnchor;
  } | null>(null);
  const [renaming, setRenaming] = useState<MacroCollection['id'] | null>(null);
  const duplicateReason =
    collections.length >= MACRO_FILE_LIMITS.collections
      ? limitReason('모음', MACRO_FILE_LIMITS.collections)
      : undefined;
  const duplicate = (source: MacroCollection): void => {
    if (locked || duplicateReason !== undefined) return;
    const parsed = parseMacroCollectionId(crypto.randomUUID());
    if (!parsed.ok) return;
    const copyId = parsed.value;
    run({kind: 'duplicate', id: source.id, copyId}).then(
      saved => {
        if (saved) onChange(copyId);
      },
      (cause: unknown) =>
        console.error('Collection copy callback failed:', cause),
    );
  };
  const {surface, onKeyDown} = useChoicePopup({
    anchor,
    onClose,
    onEscape: () => onClose(true),
  });
  useLayoutEffect(() => {
    surface.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.focus();
  }, [surface, value]);
  const handoff = useMenuHandoff<{
    kind: 'rename' | 'delete';
    item: MacroCollection;
  }>(context !== null, action => {
    if (action.kind === 'rename') setRenaming(action.item.id);
    else {
      onDelete(action.item);
      onClose(false);
    }
  });
  const target = collections.find(item => item.id === context?.id);
  const choose = (id: MacroCollection['id'] | undefined): void => {
    onChange(id);
    onClose(true);
  };
  const save = (edit: MacroCollectionEdit, after?: () => void): void => {
    run(edit).then(
      saved => {
        if (saved) after?.();
      },
      (cause: unknown) => {
        window.llp?.log.write({
          level: 'error',
          message: 'Macro collection callback failed',
          detail: String(cause),
        });
      },
    );
  };
  const drag = useCollectionDrag({
    collections,
    locked,
    move: (id, before) => save({kind: 'move', id, before}),
  });
  const rows = [{id: ALL, name: '모든 매크로'}, ...collections];
  const cannotAdd =
    locked ||
    props.onNew === undefined ||
    collections.length >= MACRO_FILE_LIMITS.collections;
  const add = (): void => {
    if (!cannotAdd) props.onNew?.();
  };
  return (
    <>
      <Popover>
        <div className={menuStyles.layer}>
          <div
            ref={surface}
            role="dialog"
            aria-label="매크로 모음"
            className={menuStyles.menu}
            style={{minWidth: anchor.getBoundingClientRect().width}}
            onKeyDown={onKeyDown}
            onBlur={event => {
              if (
                event.relatedTarget instanceof Element &&
                !anchor.contains(event.relatedTarget) &&
                event.relatedTarget.closest(
                  '[data-llp-layer="popover"], [data-llp-layer="dialog"]',
                ) === null
              ) {
                onClose(false);
              }
            }}
          >
            <div
              role="listbox"
              aria-label="매크로 모음 목록"
              className={styles.list}
              {...drag.list}
            >
              {rows.map(row => {
                const item = collections.find(item => item.id === row.id);
                const showContext = (anchor: MenuAnchor): void => {
                  onChange(item?.id);
                  setContext({id: row.id, anchor});
                };
                return (
                  <Fragment key={row.id}>
                    {drag.insertBefore !== undefined &&
                    drag.insertBefore === item?.id ? (
                      <ListInsertLine />
                    ) : null}
                    <MacroCollectionRow
                      name={row.name}
                      selected={row.id === (value ?? ALL)}
                      locked={locked}
                      drag={drag.row(item, renaming === row.id)}
                      rename={
                        renaming !== item?.id
                          ? undefined
                          : {
                              maxLength: NAME_LIMIT,
                              onCommit: name =>
                                run(
                                  {kind: 'rename', id: item.id, name},
                                  'saved',
                                ),
                              onClose: () => setRenaming(null),
                            }
                      }
                      onChoose={() => choose(item?.id)}
                      onMenu={showContext}
                      onDuplicate={
                        item === undefined ? undefined : () => duplicate(item)
                      }
                      onStep={direction => {
                        const step =
                          item === undefined || locked
                            ? undefined
                            : stepMove(
                                collections.map(entry => entry.id),
                                item.id,
                                direction,
                              );
                        if (item !== undefined && step !== undefined) {
                          save({
                            kind: 'move',
                            id: item.id,
                            before: step.before ?? undefined,
                          });
                        }
                      }}
                    />
                  </Fragment>
                );
              })}
              {drag.insertBefore === null ? <ListInsertLine /> : null}
            </div>
            <div role="separator" className={menuStyles.separator} />
            <NewCollectionRow disabled={cannotAdd} onAdd={add} />
          </div>
        </div>
      </Popover>
      {context === null ? null : (
        <MacroCollectionMenu
          label="매크로 모음 메뉴"
          anchor={context.anchor}
          onClose={() => setContext(null)}
          actions={{
            reason:
              target === undefined
                ? '모든 매크로는 바꿀 수 없습니다.'
                : locked
                  ? '지금은 모음을 바꿀 수 없습니다.'
                  : undefined,
            duplicate: () => {
              if (target) duplicate(target);
            },
            duplicateReason,
            rename: () => {
              if (target) handoff({kind: 'rename', item: target});
            },
            remove: () => {
              if (target) handoff({kind: 'delete', item: target});
            },
          }}
        />
      )}
    </>
  );
}

export function MacroCollectionPicker(props: CollectionProps): JSX.Element {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const collection = props.collections.find(item => item.id === props.value);
  const close = (restore: boolean): void => {
    setAnchor(null);
    if (restore) anchor?.focus();
  };
  return (
    <>
      <Select
        ref={setTrigger}
        block
        popup="dialog"
        aria-label="매크로 모음"
        value={collection?.name ?? '모든 매크로'}
        expanded={anchor !== null}
        onExpandedChange={open => setAnchor(open ? trigger : null)}
        onBlur={event => {
          if (
            event.relatedTarget instanceof Element &&
            !event.relatedTarget.closest(
              '[data-llp-layer="popover"], [data-llp-layer="dialog"]',
            )
          ) {
            setAnchor(null);
          }
        }}
      />
      {anchor === null ? null : (
        <CollectionPopover {...props} anchor={anchor} onClose={close} />
      )}
    </>
  );
}
