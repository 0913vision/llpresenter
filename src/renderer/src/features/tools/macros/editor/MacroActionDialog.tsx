import {useState, type JSX} from 'react';
import type {
  KnownMacroAction,
  MacroActionKind,
} from '@core/schema/tools/macros';
import {
  Dialog,
  Properties,
  PropertyRow,
  SelectMenu,
  TextField,
} from '@renderer/ui';
import {prepareMacroAction, type MacroActionDraft} from '@core/macros';
import {fillMessageText, MAX_MESSAGE_CHARACTERS} from '@core/overlays';
import {MACRO_OPERATIONS} from '../actions/macroActionChoices';
import {ScreenTargetsRow} from '../../ScreenTargetsRow';
import {DisplayTimeRow} from '../../DisplayTimeRow';

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
> = MACRO_OPERATIONS;
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
  const draft: MacroActionDraft = {
    kind,
    target: selected?.id,
    operation,
    clearTarget: selected?.clearTarget,
    values: Object.fromEntries(blanks.map(name => [name, valueOf(name)])),
    targets: currentTargets,
    duration,
    transition: initial?.transition,
  };
  const action =
    (!needsTarget || selected) &&
    (kind !== 'message' || (messageValid && messageTargetsValid))
      ? prepareMacroAction(draft)
      : undefined;
  return (
    <Dialog
      title="동작 설정"
      size="s"
      onCancel={onCancel}
      primary={{
        label: '적용',
        disabled: locked || !action,
        title: action ? undefined : '동작 설정을 확인해야 합니다.',
        onSelect: () => {
          if (action) onSave(action);
        },
      }}
    >
      <Properties placement="window">
        {kind === 'clearAll' ? (
          <PropertyRow label={'동작'}>
            {() => <span>{'모두 지우기'}</span>}
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
                  target && !selected ? '대상을 찾을 수 없습니다.' : undefined
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
            <ScreenTargetsRow
              screens={screens}
              targets={currentTargets}
              locked={locked}
              onChange={setTargets}
            />
            <DisplayTimeRow
              duration={duration}
              saved={initial?.duration ?? null}
              locked={locked}
              onChange={setDuration}
            />
          </>
        ) : null}
      </Properties>
    </Dialog>
  );
}
