import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useLayoutEffect, useMemo, useRef, useState, type JSX} from 'react';
import {parseLookId} from '@core/schema/ids';
import type {Look} from '@core/schema/looks';
import {useLive} from '@renderer/session/live';
import {sendLookChange} from '@renderer/features/screens/looks/lookActions';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {IconButton} from '@renderer/ui/IconButton';
import {type MenuAnchor} from '@renderer/ui/Menu';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {selectedIdIn, useScreensSelection} from '../selection';
import {nameProblem} from '@core/screens/screenEdits';
import {useSettingsDocument} from '../../../platform/useSettingsDocument';
import {LookContextMenu} from '../SettingsContextMenus';
import {lookFontWarnings} from './fontAvailability';
import {useFontCatalog} from './useFontCatalog';
import {ChoiceRows} from '../ChoiceRows';
import {
  LOOK_LIST_LIMIT,
  type LookListEdit,
  type LookListProblem,
} from '@core/looks/lookListEdits';
import {useLookListEditor} from './useLookListEditor';
import styles from './LookList.module.css';

const READ_ONLY_REASON = '새 버전에서 만든 설정이므로 변경할 수 없음';
const CURRENT_REASON = '현재 사용 중인 Look은 삭제할 수 없음';
const PROBLEMS: Readonly<Record<LookListProblem['reason'], string>> = {
  missing: 'Look을 찾을 수 없음',
  'duplicate-id': 'Look 추가 실패',
  full: 'Look은 1,000개까지 추가할 수 있음',
  current: CURRENT_REASON,
  empty: '이름이 비어 있음',
  taken: '같은 이름의 Look이 있음',
  'confirmation-required': 'Look 삭제 확인 필요',
};

/** Look lifecycle actions and selection; choosing a row never changes output. */
export function LookPanel({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('looks', 'Look', onProblem);
  const macros = useSettingsDocument('macros', '매크로', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const fonts = useFontCatalog();
  const warnings = useMemo(
    () => lookFontWarnings(document?.value, screens?.value.screens, fonts),
    [document, screens, fonts],
  );
  const editor = useLookListEditor(document, macros, onProblem);
  const mounted = useRef(false);
  const latestCreation = useRef<Look['id'] | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const selection = useScreensSelection(view => view.selection);
  const select = useScreensSelection(view => view.select);
  const live = useLive(view => view.state?.lookId);
  const looks = document?.value.looks ?? [];
  const current = live ?? document?.value.current;
  const reason = document?.access === 'readOnly' ? READ_ONLY_REASON : undefined;
  const creationReason =
    reason ?? (looks.length >= LOOK_LIST_LIMIT ? PROBLEMS.full : undefined);
  const [menu, setMenu] = useState<{look: Look; anchor: MenuAnchor} | null>(
    null,
  );
  const [renaming, setRenaming] = useState<Look | null>(null);
  const renameAfterMenu = useMenuHandoff<Look>(menu !== null, look => {
    select('look', look.id);
    setRenaming(look);
  });
  const [confirmation, setConfirmation] = useState<{
    id: Look['id'];
    name: string;
    macros: readonly string[];
  } | null>(null);
  const run = (edit: LookListEdit): void => {
    const previous = useScreensSelection.getState().selection;
    if (edit.kind === 'add' || edit.kind === 'duplicate') {
      latestCreation.current = edit.id;
    }
    const saving = editor.change(edit);
    saving
      ?.then(result => {
        if (!mounted.current) return;
        if (!result.ok) {
          if (
            result.error.reason === 'confirmation-required' &&
            edit.kind === 'delete'
          ) {
            setConfirmation({
              id: edit.id,
              name: looks.find(look => look.id === edit.id)?.name ?? 'Look',
              macros: result.error.macros ?? [],
            });
          } else {
            editor.report(PROBLEMS[result.error.reason]);
          }
          return;
        }
        if (!result.value) return;
        if (
          (edit.kind === 'add' || edit.kind === 'duplicate') &&
          latestCreation.current === edit.id &&
          useScreensSelection.getState().selection === previous
        ) {
          select('look', edit.id);
        }
        if (edit.kind === 'delete') {
          const picked = useScreensSelection.getState().selection;
          const next = looks.find(look => look.id !== edit.id);
          if (
            picked.kind === 'look' &&
            picked.id === edit.id &&
            next !== undefined
          ) {
            select('look', next.id);
          }
        }
      })
      .catch((cause: unknown) => {
        window.llp?.log.write({
          level: 'error',
          message: 'Could not edit the Look list',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        editor.report('Look 저장 실패');
      });
  };
  const copy = (source?: Look): void => {
    const id = parseLookId(crypto.randomUUID());
    if (!id.ok) {
      editor.report('Look 추가 실패');
      return;
    }
    run(
      source === undefined
        ? {kind: 'add', id: id.value}
        : {kind: 'duplicate', id: id.value, source: source.id},
    );
  };
  const target = looks.find(look => look.id === menu?.look.id);
  const deleteReason =
    reason ??
    (target?.id === current || target?.id === document?.value.current
      ? CURRENT_REASON
      : macros === null
        ? '매크로를 불러오는 중'
        : undefined);
  return (
    <>
      <Panel label="Look" className={styles.panel}>
        <PanelHeader>
          <PanelTitle title="Look" />
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 Look"
              disabled={document === null || creationReason !== undefined}
              title={creationReason}
              onClick={() => copy()}
            />
          </PanelActions>
        </PanelHeader>
        <PanelBody variant="flush" className={styles.body}>
          <ChoiceRows
            label="Look"
            choices={looks}
            warnings={warnings}
            selected={selectedIdIn(selection, 'look')}
            inUse={new Set(current === undefined ? [] : [current])}
            onSelect={id => select('look', id)}
            onMenu={(look, anchor) => setMenu({look, anchor})}
            renaming={
              renaming === null || reason !== undefined
                ? null
                : {
                    id: renaming.id,
                    handlers: {
                      validate: name => {
                        const problem = nameProblem(name, looks, renaming.id);
                        return problem === undefined
                          ? undefined
                          : PROBLEMS[problem];
                      },
                      onCommit: async name => {
                        const result = await editor.change({
                          kind: 'rename',
                          id: renaming.id,
                          name,
                        });
                        if (result !== undefined && !result.ok) {
                          editor.report(PROBLEMS[result.error.reason]);
                        }
                        return result?.ok === true && result.value;
                      },
                      onClose: () => setRenaming(null),
                    },
                  }
            }
          />
        </PanelBody>
      </Panel>
      {menu === null || target === undefined ? null : (
        <LookContextMenu
          label="Look 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          actions={{
            apply: {
              reason:
                window.llp === undefined ? '출력에 연결되지 않음' : undefined,
              run: () =>
                sendLookChange(target.id, notice => onProblem?.(notice)),
            },
            duplicate: {reason: creationReason, run: () => copy(target)},
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
      {confirmation === null ? null : (
        <AlertDialog
          icon="trash"
          title={`‘${confirmation.name}’ Look을 삭제할까요?`}
          meta={confirmation.macros}
          onCancel={() => setConfirmation(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              onSelect: () => {
                const id = confirmation.id;
                setConfirmation(null);
                run({kind: 'delete', id, confirmed: true});
              },
            },
          ]}
        />
      )}
    </>
  );
}
