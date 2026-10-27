import {useState, type JSX} from 'react';
import type {LyricStyle} from '@shared/schema/looks';
import {isLyricTextColor} from '@shared/schema/textStyle';
import {NumberField} from '@renderer/ui/NumberField';
import {
  Properties,
  PropertyColumns,
  PropertyRow,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {Switch} from '@renderer/ui/Switch';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import type {LyricStyleEdit} from './lyricStyleEdits';
import styles from './LyricStyles.module.css';

type Change = (change: LyricStyleEdit['change']) => void;

const NUMBER_FIELDS = [
  {key: 'size', label: '크기', min: 1, max: 10000, step: 1},
  {key: 'lineHeight', label: '줄 간격', min: 0.1, max: 100, step: 0.1},
  {key: 'maxLines', label: '최대 줄 수', min: 1, max: 1000, step: 1},
  {key: 'margin', label: '여백', min: 0, max: 100, step: 1},
] as const;

function ColorField({
  style,
  reason,
  change,
}: {
  readonly style: LyricStyle;
  readonly reason: string | undefined;
  readonly change: Change;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? style.color;
  const valid = isLyricTextColor(shown);
  return (
    <PropertyRow label="글자색">
      {({controlId}) => (
        <>
          <span
            className={styles.swatch}
            style={{backgroundColor: style.color}}
          />
          <TextField
            id={controlId}
            value={shown}
            onChange={setDraft}
            readOnly={reason !== undefined}
            aria-disabled={reason !== undefined || undefined}
            title={reason}
            invalid={!valid}
            invalidReason={valid ? undefined : '#RRGGBB 형식으로 입력'}
            onBlur={() => {
              if (reason === undefined && valid && shown !== style.color) {
                change({color: shown.toUpperCase()});
              }
              setDraft(null);
            }}
            onKeyDown={event => {
              if (isComposing(event)) return;
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(null);
              }
            }}
          />
        </>
      )}
    </PropertyRow>
  );
}

/** Shared lyric text properties; every control saves only its own changed fields. */
export function LyricStyleProperties({
  style,
  reason,
  change,
}: {
  readonly style: LyricStyle;
  readonly reason: string | undefined;
  readonly change: Change;
}): JSX.Element {
  return (
    <Properties>
      <PropertyColumns>
        <div>
          <PropertyRow label="글꼴">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                value={style.font}
                options={[...new Set(['Pretendard', style.font])].map(font => ({
                  value: font,
                  label: font,
                }))}
                disabled={reason !== undefined}
                title={reason}
                onChange={font => change({font})}
              />
            )}
          </PropertyRow>
          <ColorField
            key={style.id}
            style={style}
            reason={reason}
            change={change}
          />
          {NUMBER_FIELDS.map(field => (
            <PropertyRow key={field.key} label={field.label}>
              {({controlId}) => (
                <NumberField
                  id={controlId}
                  value={style[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  suffix={field.key === 'margin' ? '%' : undefined}
                  updateOn="commit"
                  readOnly={reason !== undefined}
                  aria-disabled={reason !== undefined || undefined}
                  title={reason}
                  onChange={value => change({[field.key]: value})}
                />
              )}
            </PropertyRow>
          ))}
        </div>
        <div>
          <PropertyRow label="가로 정렬">
            {({controlId, labelId}) => (
              <SegmentedControl
                id={controlId}
                labelledBy={labelId}
                value={style.align}
                options={[
                  {value: 'left', label: '왼쪽'},
                  {value: 'center', label: '가운데'},
                ]}
                disabled={reason !== undefined}
                title={reason}
                onChange={align => change({align})}
              />
            )}
          </PropertyRow>
          <PropertyRow label="세로 위치">
            {({controlId, labelId}) => (
              <SegmentedControl
                id={controlId}
                labelledBy={labelId}
                value={style.vAlign}
                options={[
                  {value: 'top', label: '위'},
                  {value: 'middle', label: '가운데'},
                  {value: 'bottom', label: '아래'},
                ]}
                disabled={reason !== undefined}
                title={reason}
                onChange={vAlign => change({vAlign})}
              />
            )}
          </PropertyRow>
          {(['shadow', 'outline'] as const).map(key => (
            <PropertyRow
              key={key}
              label={key === 'shadow' ? '그림자' : '외곽선'}
            >
              {({controlId}) => (
                <Switch
                  id={controlId}
                  checked={style[key]}
                  disabled={reason !== undefined}
                  title={reason}
                  onChange={value => change({[key]: value})}
                />
              )}
            </PropertyRow>
          ))}
        </div>
      </PropertyColumns>
    </Properties>
  );
}
