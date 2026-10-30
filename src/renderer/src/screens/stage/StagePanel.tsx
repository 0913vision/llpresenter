import {
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {StageLayout} from '@core/schema/stageLayouts';
import {referencedStageLayouts} from '@core/looks/stageLayoutReferences';
import {useLive} from '@renderer/platform/live';
import {IconButton} from '@renderer/ui/IconButton';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {type MenuAnchor} from '@renderer/ui/Menu';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {ChoiceRows} from '../ChoiceRows';
import {stageLayoutsInUse} from '../choices';
import {selectedIdIn, useScreensSelection} from '../selection';
import {nameProblem} from '@core/screens/screenEdits';
import {useSettingsDocument} from '../../platform/useSettingsDocument';
import {StageLayoutContextMenu} from '../SettingsContextMenus';
import {STAGE_LAYOUT_LIMIT} from './stageEditor';
import {useStageEditor} from './useStageEditor';
import styles from '../looks/LookList.module.css';

const NAME_PROBLEMS = {
  empty: '이름이 비어 있음',
  taken: '같은 이름의 배치가 있음',
};
const READ_ONLY_REASON = '새 버전에서 만든 설정이므로 변경할 수 없음';
const FULL_REASON = '무대 배치는 1,000개까지 추가할 수 있음';
const REFERENCED_REASON = 'Look에서 사용 중인 배치는 삭제할 수 없음';

/** Stage list actions share the existing settings-document lifecycle. */
export function StagePanel({
  onProblem,
}: {
  onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const layouts = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  const looks = useSettingsDocument('looks', 'Look', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const live = useLive(view => view.state?.lookId);
  const select = useScreensSelection(view => view.select);
  const selection = useScreensSelection(view => view.selection);
  const run = useStageEditor(layouts, onProblem);
  const items = useMemo(() => layouts?.value.layouts ?? [], [layouts]);
  const reason =
    layouts === null
      ? '무대 배치를 불러오는 중'
      : layouts.access === 'readOnly'
        ? READ_ONLY_REASON
        : undefined;
  const creationReason =
    reason ?? (items.length >= STAGE_LAYOUT_LIMIT ? FULL_REASON : undefined);
  const [menu, setMenu] = useState<{id: string; anchor: MenuAnchor} | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{id: string; name: string} | null>(
    null,
  );
  const pendingRename = useRef<string | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // NOTE(0913vision): Mount the field after Menu's passive focus restoration.
  useEffect(() => {
    if (menu !== null || pendingRename.current === null) return;
    const id = pendingRename.current;
    pendingRename.current = null;
    if (!items.some(layout => layout.id === id)) return;
    select('stage', id);
    setRenaming(id);
  }, [menu, items, select]);
  const addLayout = (source?: StageLayout): void => {
    const before = useScreensSelection.getState().selection;
    run(
      editor =>
        source === undefined ? editor.create() : editor.duplicate(source.id),
      id => {
        const current = useScreensSelection.getState().selection;
        if (
          mounted.current &&
          id !== null &&
          current.kind === before.kind &&
          current.id === before.id
        ) {
          select('stage', id);
        }
      },
    );
  };
  const target = items.find(layout => layout.id === menu?.id);
  const referenced = useMemo(
    () => (looks === null ? null : referencedStageLayouts(looks.value)),
    [looks],
  );
  const deleteReason =
    reason ??
    (referenced === null
      ? 'Look을 불러오는 중'
      : target !== undefined && referenced.has(target.id)
        ? REFERENCED_REASON
        : undefined);
  const confirmReason =
    reason ??
    (referenced === null
      ? 'Look을 불러오는 중'
      : deleting !== null && referenced.has(deleting.id)
        ? REFERENCED_REASON
        : deleting !== null && !items.some(layout => layout.id === deleting.id)
          ? '배치를 찾을 수 없음'
          : undefined);
  const inUse = useMemo(
    () =>
      looks === null || screens === null
        ? new Set<string>()
        : stageLayoutsInUse(looks.value, screens.value, live),
    [looks, screens, live],
  );
  return (
    <>
      <Panel label="무대 배치" className={styles.panel}>
        <PanelHeader>
          <PanelTitle title="무대 배치" />
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 배치"
              disabled={creationReason !== undefined}
              title={creationReason}
              onClick={() => addLayout()}
            />
          </PanelActions>
        </PanelHeader>
        <PanelBody variant="flush" className={styles.body}>
          <ChoiceRows
            label="무대 배치"
            selected={selectedIdIn(selection, 'stage')}
            onSelect={id => select('stage', id)}
            renaming={
              renaming === null || reason !== undefined
                ? null
                : {
                    id: renaming,
                    handlers: {
                      validate: name => {
                        const problem = nameProblem(name, items, renaming);
                        return problem === undefined
                          ? undefined
                          : NAME_PROBLEMS[problem];
                      },
                      onCommit: name => {
                        setRenaming(null);
                        run(editor => editor.renameLayout(renaming, name));
                      },
                      onCancel: () => setRenaming(null),
                    },
                  }
            }
            choices={items}
            inUse={inUse}
            onMenu={(layout, anchor) => setMenu({id: layout.id, anchor})}
          />
        </PanelBody>
      </Panel>
      {menu === null || target === undefined ? null : (
        <StageLayoutContextMenu
          label="무대 배치 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          actions={{
            duplicate: {
              reason: creationReason,
              run: () => addLayout(target),
            },
            rename: {
              reason,
              run: () => {
                pendingRename.current = target.id;
              },
            },
            remove: {
              reason: deleteReason,
              run: () => {
                setDeleting({id: target.id, name: target.name});
              },
            },
          }}
        />
      )}
      {deleting === null ? null : (
        <AlertDialog
          icon="trash"
          title={`‘${deleting.name}’ 배치를 삭제할까요?`}
          onCancel={() => setDeleting(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: confirmReason !== undefined,
              title: confirmReason,
              onSelect: () => {
                const id = deleting.id;
                setDeleting(null);
                run(
                  editor => editor.removeLayout(id),
                  result => {
                    if (mounted.current && result !== null) {
                      useScreensSelection
                        .getState()
                        .selectAfterStageRemoval(id, result.next);
                    }
                  },
                );
              },
            },
          ]}
        />
      )}
    </>
  );
}
