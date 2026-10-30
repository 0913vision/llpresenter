import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {parseLookId, parseMessageStyleId} from '@core/schema/ids';
import type {Look} from '@core/schema/looks';
import {useLive} from '@renderer/state/live';
import {Button} from '@renderer/ui/Button';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {LiveBadge} from '@renderer/ui/StatusMarks';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import type {Notice} from '@renderer/ui/notices';
import {nameProblem} from '@core/screens/screenEdits';
import {useScreensSelection} from '../selection';
import {useSettingsDocument} from '../useSettingsDocument';
import {useMonitors} from '../useMonitors';
import {previewCaption} from '../previewCaption';
import {LookScreenCard} from './LookScreenCard';
import {LookCardSlots} from './LookCardSlots';
import {LyricStyles} from './LyricStyles';
import {LOOK_LIST_LIMIT} from '@core/looks/lookListEdits';
import {useLookListEditor} from './useLookListEditor';
import styles from './LookEditor.module.css';

const READ_ONLY_REASON = '새 버전에서 만든 설정이므로 변경할 수 없음';

function LookName({
  look,
  looks,
  reason,
  onCommit,
}: {
  readonly look: Look;
  readonly looks: readonly Look[];
  readonly reason: string | undefined;
  readonly onCommit: (name: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const shown = draft ?? look.name;
  const problem = nameProblem(shown, looks, look.id);
  const commit = (): void => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (reason === undefined && problem === undefined && draft !== null) {
      onCommit(shown.trim());
    }
    setDraft(null);
  };
  return (
    <TextField
      aria-label="Look 이름"
      variant="title"
      value={shown}
      onChange={setDraft}
      readOnly={reason !== undefined}
      aria-disabled={reason !== undefined ? true : undefined}
      title={reason}
      invalid={problem !== undefined}
      invalidReason={
        problem === 'empty'
          ? '이름이 비어 있음'
          : problem === 'taken'
            ? '같은 이름의 Look이 있음'
            : undefined
      }
      onBlur={commit}
      onKeyDown={event => {
        if (isComposing(event) || hasModifier(event)) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** The selected Look's header and per-screen cards; changes save through one shared queue. */
export function LookEditor({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('looks', 'Look', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const layouts = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const editor = useLookListEditor(document, null, onProblem);
  const mounted = useRef(false);
  const latestCopy = useRef<string | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const selection = useScreensSelection(view => view.selection);
  const live = useLive(view => view.state?.lookId);
  const monitors = useMonitors();
  const look = document?.value.looks.find(item => item.id === selection.id);
  const reason = document?.access === 'readOnly' ? READ_ONLY_REASON : undefined;
  const copyReason =
    reason ??
    ((document?.value.looks.length ?? 0) >= LOOK_LIST_LIMIT
      ? 'Look은 1,000개까지 추가할 수 있음'
      : undefined);
  const failed = (cause: unknown): void => {
    window.llp?.log.write({
      level: 'error',
      message: 'Could not edit the Look',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
    editor.report('Look 저장 실패');
  };
  return (
    <Panel label="Look 편집" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="Look" />
        {look === undefined ? null : (
          <>
            <LookName
              key={look.id}
              look={look}
              looks={document?.value.looks ?? []}
              reason={reason}
              onCommit={name => {
                editor
                  .change({kind: 'rename', id: look.id, name})
                  ?.then(result => {
                    if (!result.ok) editor.report('Look 이름 변경 실패');
                  })
                  .catch(failed);
              }}
            />
            {look.id === (live ?? document?.value.current) ? (
              <LiveBadge />
            ) : null}
            <PanelActions>
              <Button
                disabled={copyReason !== undefined}
                title={copyReason}
                onClick={() => {
                  const id = parseLookId(crypto.randomUUID());
                  if (!id.ok) {
                    editor.report('Look 추가 실패');
                    return;
                  }
                  const previous = useScreensSelection.getState().selection;
                  latestCopy.current = id.value;
                  editor
                    .change({kind: 'duplicate', source: look.id, id: id.value})
                    ?.then(result => {
                      if (!mounted.current) return;
                      if (
                        result.ok &&
                        result.value &&
                        latestCopy.current === id.value &&
                        useScreensSelection.getState().selection === previous
                      ) {
                        useScreensSelection.getState().select('look', id.value);
                      } else if (!result.ok) editor.report('Look 복제 실패');
                    })
                    .catch(failed);
                }}
              >
                복제
              </Button>
            </PanelActions>
          </>
        )}
      </PanelHeader>
      <PanelBody className={styles.body}>
        {look === undefined || document === null ? null : (
          <>
            <LookCardSlots
              screens={screens?.value.screens ?? []}
              render={screen => (
                <LookScreenCard
                  look={look}
                  screen={screen}
                  looks={document.value}
                  stageLayouts={layouts?.value.layouts ?? []}
                  timers={timers?.value.timers ?? []}
                  target={previewCaption(screen, monitors).target}
                  reason={reason}
                  onProblem={editor.report}
                  onMessageChange={styleId => {
                    editor
                      .assignMessage({
                        lookId: look.id,
                        screenId: screen.id,
                        styleId,
                      })
                      ?.catch(failed);
                  }}
                  onMessageStyleChange={(id, change) =>
                    editor
                      .changeMessageStyle(id, change)
                      ?.catch((cause: unknown) => {
                        failed(cause);
                        return false;
                      })
                  }
                  onMessageCreate={() => {
                    const id = parseMessageStyleId(crypto.randomUUID());
                    if (!id.ok) {
                      editor.report('메시지 스타일 추가 실패');
                      return;
                    }
                    editor
                      .createMessage({
                        lookId: look.id,
                        screenId: screen.id,
                        styleId: id.value,
                      })
                      ?.catch(failed);
                  }}
                  onChange={change => {
                    editor
                      .changeCard({
                        lookId: look.id,
                        screenId: screen.id,
                        change,
                      })
                      ?.catch(failed);
                  }}
                />
              )}
            />
            <LyricStyles
              looks={document.value}
              reason={reason}
              onListChange={editor.changeStyleList}
              onEffectsChange={(id, change) =>
                editor.changeEffects(id, change)?.catch((cause: unknown) => {
                  failed(cause);
                  return false;
                })
              }
              onProblem={editor.report}
              onChange={edit => {
                const saving = editor.changeStyle(edit);
                return saving?.catch((cause: unknown) => {
                  failed(cause);
                  return false;
                });
              }}
            />
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
