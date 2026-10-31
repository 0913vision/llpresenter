import {useEffect, useRef, useState, type JSX} from 'react';
import {isLyricTextColor} from '@core/schema/textStyle';
import {Dialog, Properties, PropertyRow, Slider} from '@renderer/ui';
import {StageStringProperty} from './StageStringProperty';
import styles from './StageColorProperty.module.css';

interface Channels {
  red: number;
  green: number;
  blue: number;
}
const MAX_CHANNEL = 255;
const CHANNELS = [
  {key: 'red', label: '빨강'},
  {key: 'green', label: '초록'},
  {key: 'blue', label: '파랑'},
] as const;

function channels(color: string): Channels {
  const safe = isLyricTextColor(color) ? color : '#FFFFFF';
  return {
    red: parseInt(safe.slice(1, 3), 16),
    green: parseInt(safe.slice(3, 5), 16),
    blue: parseInt(safe.slice(5, 7), 16),
  };
}

function hex(color: Channels): string {
  return `#${[color.red, color.green, color.blue]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

/** A hex field and a dialog for choosing its color without a native picker. */
export function StageColorProperty({
  label,
  value,
  reason,
  commit,
  allowNone = false,
  noneLabel = '없음',
  inheritedColor,
}: {
  label: string;
  value: string;
  reason: string | undefined;
  commit: (value: string) => void;
  allowNone?: boolean;
  noneLabel?: string;
  inheritedColor?: string;
}): JSX.Element {
  const latest = useRef(value);
  const [draft, setDraft] = useState<Channels | null>(null);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const apply = (next: string): void => {
    if (next !== latest.current) commit(next);
    latest.current = next;
    setDraft(null);
  };
  const preview = draft === null ? '' : hex(draft);
  return (
    <>
      <StageStringProperty
        label={label}
        value={value}
        reason={reason}
        placeholder={allowNone ? noneLabel : undefined}
        validate={text =>
          (allowNone && text === '') || isLyricTextColor(text)
            ? undefined
            : '#RRGGBB 형식으로 입력'
        }
        commit={text => commit(text.toUpperCase())}
        onResolved={text => {
          latest.current = text;
        }}
        prefix={
          <button
            type="button"
            className={styles.swatch}
            aria-label={`${label} 선택`}
            title={reason ?? `${label} 선택`}
            disabled={reason !== undefined}
            onClick={() =>
              setDraft(
                channels(
                  latest.current === ''
                    ? (inheritedColor ?? '')
                    : latest.current,
                ),
              )
            }
          >
            <span
              style={{
                backgroundColor:
                  value === '' ? (inheritedColor ?? 'transparent') : value,
              }}
            />
          </button>
        }
      />
      {draft === null ? null : (
        <Dialog
          title={`${label} 선택`}
          size="s"
          onCancel={() => setDraft(null)}
          primary={{label: '적용', onSelect: () => apply(preview)}}
          secondary={
            allowNone
              ? [{label: noneLabel, onSelect: () => apply('')}]
              : undefined
          }
        >
          <div className={styles.preview}>
            <span style={{backgroundColor: preview}} />
            <output>{preview}</output>
          </div>
          <Properties>
            {CHANNELS.map(({key, label: channelLabel}) => (
              <PropertyRow key={key} label={channelLabel}>
                {() => (
                  <>
                    <Slider
                      label={channelLabel}
                      min={0}
                      max={MAX_CHANNEL}
                      value={draft[key]}
                      width="block"
                      surface="dialog"
                      onChange={number => setDraft({...draft, [key]: number})}
                    />
                    <output>{draft[key]}</output>
                  </>
                )}
              </PropertyRow>
            ))}
          </Properties>
        </Dialog>
      )}
    </>
  );
}
