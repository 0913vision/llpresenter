import {RenameField} from '@renderer/ui/RenameField';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {contextMenuTarget, isContextMenuKey} from '@renderer/ui/contextMenu';
import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {Result} from '@core/common/result';
import {parseLyricStyleId, type LyricStyleId} from '@core/schema/ids';
import type {LooksFile, LyricStyle} from '@core/schema/looks';
import {IconButton} from '@renderer/ui/IconButton';
import {type MenuAnchor} from '@renderer/ui/Menu';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {nameProblem} from '@core/screens/screenEdits';
import {LyricStyleContextMenu} from '../SettingsContextMenus';
import {
  LYRIC_STYLE_LIMIT,
  lyricStyleIsUsed,
  type LyricStyleListEdit,
  type LyricStyleListProblem,
} from './lyricStyleListEdits';
import styles from './LyricStyles.module.css';

const PROBLEMS: Readonly<Record<LyricStyleListProblem, string>> = {
  missing: '가사 스타일을 찾을 수 없음',
  'duplicate-id': '가사 스타일 추가 실패',
  full: '가사 스타일은 1,000개까지 추가할 수 있음',
  used: 'Look에서 사용 중인 스타일은 삭제할 수 없음',
  empty: '이름이 비어 있음',
  taken: '같은 이름의 가사 스타일이 있음',
};

/** Selects shared presets and exposes guarded lifecycle actions without changing output. */
export function LyricStyleSelector({
  looks,
  value,
  reason,
  onSelect,
  onChange,
  onProblem,
}: {
  readonly looks: LooksFile;
  readonly value: LyricStyleId | undefined;
  readonly reason: string | undefined;
  readonly onSelect: (id: LyricStyleId) => void;
  readonly onChange: (
    edit: LyricStyleListEdit,
  ) => Promise<Result<boolean, LyricStyleListProblem>> | undefined;
  readonly onProblem: (reason: string) => void;
}): JSX.Element {
  const [menu, setMenu] = useState<{
    id: LyricStyleId;
    anchor: MenuAnchor;
  } | null>(null);
  const [renaming, setRenaming] = useState<LyricStyle | null>(null);
  const mounted = useRef(false);
  const navigation = useRef(0);
  const latestAdd = useRef<LyricStyleId | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const renameAfterMenu = useMenuHandoff<LyricStyle>(menu !== null, target => {
    navigation.current++;
    onSelect(target.id);
    setRenaming(target);
  });
  const select = (id: LyricStyleId): void => {
    navigation.current++;
    onSelect(id);
  };
  const run = (edit: LyricStyleListEdit): void => {
    const previous = navigation.current;
    if (edit.kind === 'add') latestAdd.current = edit.id;
    onChange(edit)
      ?.then(result => {
        if (!mounted.current) return;
        if (!result.ok) onProblem(PROBLEMS[result.error]);
        else if (
          result.value &&
          edit.kind === 'add' &&
          latestAdd.current === edit.id &&
          navigation.current === previous
        ) {
          select(edit.id);
        }
      })
      .catch((cause: unknown) => {
        window.llp?.log.write({
          level: 'error',
          message: 'Could not edit lyric style presets',
          detail: String(cause),
        });
        onProblem('가사 스타일 저장 실패');
      });
  };
  const add = (source: LyricStyleId | undefined): void => {
    const id = parseLyricStyleId(crypto.randomUUID());
    if (!id.ok) {
      onProblem('가사 스타일 추가 실패');
      return;
    }
    run({kind: 'add', id: id.value, ...(source === undefined ? {} : {source})});
  };
  const targetAt = (
    container: HTMLElement,
    target: EventTarget | null,
  ): LyricStyle | undefined => {
    if (!(target instanceof Element)) return undefined;
    const button = target.closest('[role=tab]');
    const index = Array.from(
      container.querySelectorAll('[role=tab]'),
    ).findIndex(element => element === button);
    return looks.lyricStyles[index];
  };
  const creationReason =
    reason ??
    (looks.lyricStyles.length >= LYRIC_STYLE_LIMIT ? PROBLEMS.full : undefined);
  const target = looks.lyricStyles.find(style => style.id === menu?.id);
  const deleteReason =
    reason ??
    (target !== undefined && lyricStyleIsUsed(looks, target.id)
      ? PROBLEMS.used
      : undefined);
  return (
    <>
      <div className={styles.selector}>
        <div
          className={styles.segments}
          onContextMenu={event => {
            const style = targetAt(event.currentTarget, event.target);
            if (style === undefined) return;
            event.preventDefault();
            setMenu({
              id: style.id,
              anchor: {
                kind: 'point',
                target: contextMenuTarget(event),
                point: {x: event.clientX, y: event.clientY},
              },
            });
          }}
          onKeyDown={event => {
            if (!isContextMenuKey(event)) {
              return;
            }
            const style = targetAt(event.currentTarget, event.target);
            if (style === undefined) return;
            event.preventDefault();
            setMenu({
              id: style.id,
              anchor: {
                kind: 'element',
                target: contextMenuTarget(event),
                element:
                  event.target instanceof HTMLElement
                    ? event.target
                    : event.currentTarget,
              },
            });
          }}
        >
          {value === undefined ? null : (
            <SegmentedControl
              label="가사 스타일 선택"
              kind="tabs"
              options={looks.lyricStyles.map(style => ({
                value: style.id,
                label: style.name,
              }))}
              value={value}
              onChange={select}
            />
          )}
        </div>
        <IconButton
          icon="plus"
          label="새 가사 스타일"
          disabled={creationReason !== undefined}
          title={creationReason}
          onClick={() => add(value)}
        />
      </div>
      {renaming === null || reason !== undefined ? null : (
        <RenameField
          key={renaming.id}
          name={renaming.name}
          label="스타일 이름"
          rename={{
            validate: name => {
              const problem = nameProblem(name, looks.lyricStyles, renaming.id);
              return problem === undefined ? undefined : PROBLEMS[problem];
            },
            onClose: () => setRenaming(null),
            onCommit: async name => {
              const result = await onChange({
                kind: 'rename',
                id: renaming.id,
                name,
              });
              if (result !== undefined && !result.ok) {
                onProblem(PROBLEMS[result.error]);
              }
              return result?.ok === true && result.value;
            },
          }}
        />
      )}
      {menu === null || target === undefined ? null : (
        <LyricStyleContextMenu
          label="가사 스타일 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          actions={{
            rename: {
              reason,
              run: () => {
                renameAfterMenu(target);
              },
            },
            remove: {
              reason: deleteReason,
              run: () => run({kind: 'delete', id: target.id}),
            },
          }}
        />
      )}
    </>
  );
}
