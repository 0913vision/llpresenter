import {useState, type JSX} from 'react';
import type {KnownMacroAction, MacroActionKind} from '@core/schema/macros';
import {
  Button,
  Dialog,
  Properties,
  PropertyRow,
  SelectMenu,
  TextField,
} from '@renderer/ui';
import {
  prepareMacroAction,
  type MacroActionDraft,
} from '@core/macros/macroActionDraft';
import {
  fillMessageText,
  MAX_MESSAGE_CHARACTERS,
} from '@core/overlays/messageText';

export interface MacroActionChoice {
  readonly id: string;
  readonly name: string;
  readonly clearTarget?: 'layer' | 'prop' | undefined;
  readonly blanks?: readonly string[] | undefined;
  readonly text?: string | undefined;
}
export type MacroActionChoices = Partial<
  Readonly<Record<MacroActionKind, readonly MacroActionChoice[]>>
>;

const modes: Partial<
  Readonly<
    Record<MacroActionKind, ReadonlyArray<{value: string; label: string}>>
  >
> = {
  prop: [
    {value: 'on', label: '켜기'},
    {value: 'off', label: '끄기'},
    {value: 'toggle', label: '바꾸기'},
  ],
  timer: [
    {value: 'start', label: '시작'},
    {value: 'pause', label: '일시 정지'},
    {value: 'reset', label: '재설정'},
  ],
  audio: [
    {value: 'play', label: '재생'},
    {value: 'fadeOut', label: '페이드 아웃'},
    {value: 'stop', label: '멈춤'},
  ],
};
const defaultMode: Partial<Readonly<Record<MacroActionKind, string>>> = {
  prop: 'on',
  timer: 'start',
  audio: 'play',
};

export function MacroActionDialog({
  kind,
  choices,
  screens,
  initial,
  locked,
  onCancel,
  onSave,
}: {
  readonly kind: MacroActionKind;
  readonly choices: MacroActionChoices;
  readonly screens: readonly MacroActionChoice[];
  readonly initial?: MacroActionDraft | undefined;
  readonly locked: boolean;
  readonly onCancel: () => void;
  readonly onSave: (action: KnownMacroAction) => void;
}): JSX.Element {
  const [target, setTarget] = useState(initial?.target);
  const [operation, setOperation] = useState(
    initial?.operation ?? defaultMode[kind],
  );
  const [stage, setStage] = useState(initial?.screen);
  const [values, setValues] = useState<Readonly<Record<string, string>>>(
    initial?.values ?? {},
  );
  const [targets, setTargets] = useState<readonly string[] | 'all'>(
    initial?.targets ?? 'all',
  );
  const [duration, setDuration] = useState(initial?.duration ?? null);
  const options = choices[kind] ?? [];
  const selected = options.find(option => option.id === target);
  const modeOptions = modes[kind];
  const needsTarget =
    kind !== 'clearAll' && !(kind === 'audio' && operation !== 'play');
  const currentTargets =
    targets === 'all'
      ? 'all'
      : targets.filter(id => screens.some(screen => screen.id === id));
  const blanks = selected?.blanks ?? [];
  const valueOf = (name: string): string =>
    Object.hasOwn(values, name) ? (values[name] ?? '') : '';
  let messageValid = kind !== 'message';
  if (kind === 'message' && selected?.text !== undefined) {
    try {
      const expanded = fillMessageText(
        {text: selected.text},
        Object.fromEntries(blanks.map(name => [name, valueOf(name)])),
      );
      messageValid = expanded.trim().length > 0;
    } catch {
      messageValid = false;
    }
  }
  const messageTargetsValid =
    currentTargets === 'all' ? screens.length > 0 : currentTargets.length > 0;
  const screenValid = !stage || screens.some(screen => screen.id === stage);
  const draft: MacroActionDraft = {
    kind,
    target: selected?.id,
    operation,
    screen: stage,
    clearTarget: selected?.clearTarget,
    values: Object.fromEntries(blanks.map(name => [name, valueOf(name)])),
    targets: currentTargets,
    duration,
    transition: initial?.transition,
  };
  const action =
    (!needsTarget || selected) &&
    screenValid &&
    (kind !== 'message' || (messageValid && messageTargetsValid))
      ? prepareMacroAction(draft)
      : undefined;
  return (
    <Dialog
      title="동작 설정"
      size="s"
      onCancel={onCancel}
      primary={{
        label: '완료',
        disabled: locked || !action,
        title: action ? undefined : '동작 설정을 확인하세요',
        onSelect: () => {
          if (action) onSave(action);
        },
      }}
    >
      <Properties placement="window">
        {kind === 'clearAll' ? (
          <PropertyRow label={'\ub3d9\uc791'}>
            {() => <span>{'\ubaa8\ub450 \uc9c0\uc6b0\uae30'}</span>}
          </PropertyRow>
        ) : null}
        {modeOptions ? (
          <PropertyRow label="동작">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                disabled={locked}
                value={operation}
                options={modeOptions}
                onChange={setOperation}
              />
            )}
          </PropertyRow>
        ) : null}
        {needsTarget ? (
          <PropertyRow label="대상">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                disabled={locked || options.length === 0}
                value={selected?.id}
                valueText={
                  target && !selected ? '대상을 찾을 수 없습니다' : undefined
                }
                options={options.map(option => ({
                  value: option.id,
                  label: option.name,
                }))}
                onChange={setTarget}
              />
            )}
          </PropertyRow>
        ) : null}
        {kind === 'stageLayout' ? (
          <PropertyRow label="무대 화면">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                disabled={locked}
                value={stage ?? 'default'}
                options={[
                  {value: 'default', label: '기본 무대 화면'},
                  ...screens.map(screen => ({
                    value: screen.id,
                    label: screen.name,
                  })),
                ]}
                onChange={id => setStage(id === 'default' ? undefined : id)}
              />
            )}
          </PropertyRow>
        ) : null}
        {kind === 'message' ? (
          <>
            {blanks.map(name => (
              <PropertyRow key={name} label={name}>
                {({controlId}) => (
                  <TextField
                    id={controlId}
                    block
                    readOnly={locked}
                    maxLength={MAX_MESSAGE_CHARACTERS}
                    value={valueOf(name)}
                    onChange={value =>
                      setValues(old => ({...old, [name]: value}))
                    }
                  />
                )}
              </PropertyRow>
            ))}
            <PropertyRow label="보낼 화면" alignTop>
              {() => (
                <div role="group" aria-label="보낼 화면">
                  <Button
                    disabled={locked}
                    aria-pressed={currentTargets === 'all'}
                    onClick={() =>
                      setTargets(currentTargets === 'all' ? [] : 'all')
                    }
                  >
                    모든 화면
                  </Button>
                  {screens.map(screen => (
                    <Button
                      key={screen.id}
                      disabled={locked}
                      aria-pressed={
                        currentTargets !== 'all' &&
                        currentTargets.includes(screen.id)
                      }
                      onClick={() =>
                        setTargets(current =>
                          current === 'all'
                            ? [screen.id]
                            : current.includes(screen.id)
                              ? current.filter(id => id !== screen.id)
                              : [...current, screen.id],
                        )
                      }
                    >
                      {screen.name}
                    </Button>
                  ))}
                </div>
              )}
            </PropertyRow>
            <PropertyRow label="표시 시간">
              {({controlId}) => (
                <SelectMenu
                  id={controlId}
                  block
                  disabled={locked}
                  value={duration === null ? 'until' : String(duration)}
                  options={[
                    {value: 'until', label: '계속'},
                    {value: '30', label: '30초'},
                    {value: '60', label: '1분'},
                    {value: '120', label: '2분'},
                    ...(duration !== null && ![30, 60, 120].includes(duration)
                      ? [{value: String(duration), label: `${duration}초`}]
                      : []),
                  ]}
                  onChange={value =>
                    setDuration(value === 'until' ? null : Number(value))
                  }
                />
              )}
            </PropertyRow>
          </>
        ) : null}
      </Properties>
    </Dialog>
  );
}
