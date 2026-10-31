import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {contextMenuTarget, isContextMenuKey} from '@renderer/ui/contextMenu';
import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type JSX,
} from 'react';
import {createPortal} from 'react-dom';
import {MACRO_FILE_LIMITS, type MacroCollection} from '@core/schema/macros';
import {Button, Icon, IconButton} from '@renderer/ui';
import {classNames} from '@renderer/ui/classNames';
import {layerContainer} from '@renderer/ui/layers';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {isComposing} from '@renderer/ui/ime';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import menuStyles from '@renderer/ui/Menu.module.css';
import {useToolEditing} from './useToolEditing';
import {
  saveMacroCollectionEdit,
  type MacroCollectionEdit,
} from './macroCollectionEdits';
import {MacroCollectionMenu} from './macroCollectionMenuEntries';
import {RenameField} from '@renderer/ui/RenameField';
import styles from './MacroCollectionPicker.module.css';

const ALL = 'all';
const DRAG_MIME = 'application/x-llpresenter-macro-collection';
interface CollectionProps {
  readonly collections: readonly MacroCollection[];
  readonly value: MacroCollection['id'] | undefined;
  readonly locked: boolean;
  readonly onChange: (id: MacroCollection['id'] | undefined) => void;
  readonly onDelete: (item: MacroCollection) => void;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onNew?: (() => void) | undefined;
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
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: saveMacroCollectionEdit,
    onProblem: props.onProblem,
    area: {
      key: 'macro-collections',
      label: '모음',
      log: 'Could not edit macro collections',
    },
  });
  const locked = props.locked || busy || window.llp === undefined;
  const [context, setContext] = useState<{
    id: string;
    anchor: MenuAnchor;
  } | null>(null);
  const [renaming, setRenaming] = useState<MacroCollection['id'] | null>(null);
  const dragging = useRef<MacroCollection['id'] | null>(null);
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
  const move = (
    event: DragEvent,
    before: MacroCollection['id'] | undefined,
  ): void => {
    const id = dragging.current;
    if (locked || id === null) return;
    event.preventDefault();
    event.stopPropagation();
    dragging.current = null;
    save({kind: 'move', id, before});
  };
  const rows = [{id: ALL, name: '모든 매크로'}, ...collections];
  return (
    <>
      {createPortal(
        <div className={menuStyles.layer}>
          <div
            ref={surface}
            role="dialog"
            aria-label="매크로 모음"
            data-check-column="false"
            className={menuStyles.menu}
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
            <div className={styles.head}>
              <span>매크로 모음</span>
              <IconButton
                icon="plus"
                label="새 매크로 모음"
                disabled={
                  locked ||
                  !props.onNew ||
                  collections.length >= MACRO_FILE_LIMITS.collections
                }
                onClick={props.onNew}
              />
            </div>
            <div
              role="listbox"
              aria-label="매크로 모음 목록"
              className={styles.list}
              onDragOver={event => {
                event.stopPropagation();
                if (!locked && dragging.current !== null) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={event => {
                event.stopPropagation();
                move(event, undefined);
              }}
            >
              {rows.map(row => {
                const item = collections.find(item => item.id === row.id);
                const showContext = (anchor: MenuAnchor): void =>
                  setContext({id: row.id, anchor});
                return (
                  <div
                    key={row.id}
                    role="option"
                    data-choice=""
                    tabIndex={row.id === (value ?? ALL) ? 0 : -1}
                    aria-selected={row.id === (value ?? ALL)}
                    className={classNames(menuStyles.item, styles.row)}
                    draggable={
                      item !== undefined && !locked && renaming !== row.id
                    }
                    onDragStart={event => {
                      if (item === undefined || locked) return;
                      dragging.current = item.id;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData(DRAG_MIME, item.id);
                    }}
                    onDragEnd={() => {
                      dragging.current = null;
                    }}
                    onDrop={event =>
                      move(event, item?.id ?? collections[0]?.id)
                    }
                    onClick={() => choose(item?.id)}
                    onContextMenu={event => {
                      event.preventDefault();
                      event.currentTarget.focus();
                      showContext({
                        kind: 'point',
                        target: contextMenuTarget(event),
                        point: {x: event.clientX, y: event.clientY},
                      });
                    }}
                    onKeyDown={event => {
                      if (
                        event.target !== event.currentTarget ||
                        isComposing(event)
                      ) {
                        return;
                      }
                      if (isContextMenuKey(event)) {
                        event.preventDefault();
                        showContext({
                          kind: 'element',
                          target: contextMenuTarget(event),
                          element: event.currentTarget,
                        });
                      } else if (
                        !hasModifier(event) &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        choose(item?.id);
                      }
                    }}
                  >
                    {renaming === item?.id ? (
                      <RenameField
                        label="모음 이름"
                        maxLength={256}
                        name={item.name}
                        locked={locked}
                        rename={{
                          validate: name =>
                            name.length > 256
                              ? '이름이 너무 깁니다'
                              : undefined,
                          onCommit: name =>
                            run({kind: 'rename', id: item.id, name}, 'saved'),
                          onClose: () => setRenaming(null),
                        }}
                      />
                    ) : (
                      <span className={menuStyles.label}>{row.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        layerContainer('popover'),
      )}
      {context === null ? null : (
        <MacroCollectionMenu
          label="매크로 모음 메뉴"
          anchor={context.anchor}
          onClose={() => setContext(null)}
          actions={{
            reason:
              target === undefined
                ? '모든 매크로는 바꿀 수 없습니다'
                : locked
                  ? '지금은 모음을 변경할 수 없음'
                  : undefined,
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
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const collection = props.collections.find(item => item.id === props.value);
  const close = (restore: boolean): void => {
    setAnchor(null);
    if (restore) anchor?.focus();
  };
  return (
    <>
      <Button
        className={styles.trigger}
        aria-label="매크로 모음"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
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
        onClick={event =>
          setAnchor(anchor === null ? event.currentTarget : null)
        }
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: anchor !== null,
            onExpandedChange: open =>
              setAnchor(open ? event.currentTarget : null),
          })
        }
      >
        <span className={menuStyles.label}>
          {collection?.name ?? '모든 매크로'}
        </span>
        <Icon name="down" size={14} />
      </Button>
      {anchor === null ? null : (
        <CollectionPopover {...props} anchor={anchor} onClose={close} />
      )}
    </>
  );
}
