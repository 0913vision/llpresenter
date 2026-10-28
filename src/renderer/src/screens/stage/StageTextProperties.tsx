import {useState, type JSX} from 'react';
import type {StageElement} from '@shared/schema/stageLayouts';
import {
  NumberField,
  PropertyRow,
  SegmentedControl,
  SelectMenu,
  Switch,
} from '@renderer/ui';
import {StageStringProperty} from './StageStringProperty';
import {StageColorProperty} from './StageColorProperty';

export {StageStringProperty} from './StageStringProperty';

type TextStyle = NonNullable<StageElement['text']>;
export const STAGE_READ_ONLY = '새 버전에서 만든 설정이므로 변경할 수 없음';
const FONT_CHOICES = ['Pretendard', '맑은 고딕', 'Arial', 'Times New Roman'];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function FontProperty({
  font,
  reason,
  change,
}: {
  font: string;
  reason: string | undefined;
  change: (font: string) => void;
}): JSX.Element {
  const [typing, setTyping] = useState(false);
  if (typing) {
    return (
      <StageStringProperty
        label="글꼴"
        value={font}
        reason={reason}
        autoFocus
        validate={value =>
          value.trim() === '' ? '글꼴 이름이 비어 있음' : undefined
        }
        commit={value => change(value.trim())}
        onCancel={() => setTyping(false)}
      />
    );
  }
  return (
    <PropertyRow label="글꼴">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          aria-label="글꼴"
          block
          value={font}
          disabled={reason !== undefined}
          title={reason}
          options={Array.from(new Set([...FONT_CHOICES, font])).map(value => ({
            value,
            label: value,
          }))}
          onChange={change}
          actions={[
            {id: 'custom', label: '다른 글꼴', onSelect: () => setTyping(true)},
          ]}
        />
      )}
    </PropertyRow>
  );
}

/** Stage text controls use the saved style, including unknown future style fields. */
export function StageTextProperties({
  text,
  reason,
  change,
}: {
  text: TextStyle;
  reason: string | undefined;
  change: (patch: Partial<TextStyle>) => void;
}): JSX.Element {
  const disabled = reason !== undefined;
  return (
    <>
      <FontProperty
        font={text.font}
        reason={reason}
        change={font => change({font})}
      />
      <PropertyRow label="굵기">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            aria-label="굵기"
            block
            disabled={disabled}
            title={reason}
            value={String(text.weight)}
            options={Array.from(new Set([...WEIGHTS, text.weight]))
              .sort((a, b) => a - b)
              .map(weight => ({value: String(weight), label: String(weight)}))}
            onChange={weight => change({weight: Number(weight)})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="크기">
        {({controlId}) => (
          <NumberField
            id={controlId}
            value={text.size}
            min={12}
            max={300}
            unit="px"
            readOnly={disabled}
            title={reason}
            updateOn="commit"
            onChange={size => change({size})}
          />
        )}
      </PropertyRow>
      <StageColorProperty
        label="글자색"
        value={text.color}
        reason={reason}
        commit={color => change({color})}
      />
      <PropertyRow label="가로 정렬">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            disabled={disabled}
            title={reason}
            value={text.align}
            options={[
              {value: 'left', label: '왼쪽'},
              {value: 'center', label: '가운데'},
            ]}
            onChange={align => change({align})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="세로 정렬">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            disabled={disabled}
            title={reason}
            value={text.vAlign}
            options={[
              {value: 'top', label: '위'},
              {value: 'middle', label: '가운데'},
              {value: 'bottom', label: '아래'},
            ]}
            onChange={vAlign => change({vAlign})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="줄 간격">
        {({controlId}) => (
          <NumberField
            id={controlId}
            value={text.lineHeight}
            min={0.8}
            max={3}
            step={0.05}
            updateOn="commit"
            readOnly={disabled}
            title={reason}
            onChange={lineHeight => change({lineHeight})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="크기 자동 맞춤">
        {({controlId}) => (
          <Switch
            id={controlId}
            checked={text.autoFit}
            disabled={disabled}
            title={reason}
            onChange={autoFit => change({autoFit})}
          />
        )}
      </PropertyRow>
    </>
  );
}
