import {useState, type JSX} from 'react';
import {createPropId} from '@core/schema/common/ids';
import type {MediaItem} from '@core/schema/media/mediaList';
import type {Prop} from '@core/schema/tools/props';
import {isLyricTextColor} from '@core/schema/slides/textStyle';
import type {Screen} from '@core/schema/screens/screens';
import {
  Dialog,
  Properties,
  NumberField,
  PropertyRow,
  SelectMenu,
  TextArea,
  TextField,
} from '@renderer/ui';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {propReason} from './propEdits';
import {ScreenTargetsRow} from '../ScreenTargetsRow';

const DEFAULT_STYLE = {
  font: 'Pretendard',
  weight: 600,
  color: '#FFFFFF',
  size: 64,
  lineHeight: 1.2,
  align: 'center',
  vAlign: 'middle',
  maxLines: 2,
  margin: 4,
  shadow: true,
  outline: false,
} as const;

export function PropDialog({
  initial,
  screens,
  media,
  locked,
  onCancel,
  onSave,
}: {
  readonly initial?: Prop | undefined;
  readonly screens: readonly Screen[];
  readonly media: readonly MediaItem[];
  readonly locked: boolean;
  readonly onCancel: () => void;
  readonly onSave: (prop: Prop) => void;
}): JSX.Element {
  const [id] = useState(() => initial?.id ?? createPropId(crypto.randomUUID()));
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<'text' | 'image'>(
    initial?.content.kind ?? 'text',
  );
  const [text, setText] = useState(
    initial?.content.kind === 'text' ? initial.content.text : '',
  );
  const [textStyle, setTextStyle] = useState(() =>
    initial?.content.kind === 'text' ? initial.content.style : DEFAULT_STYLE,
  );
  const [mediaId, setMediaId] = useState(
    initial?.content.kind === 'image' ? initial.content.media : undefined,
  );
  const [targets, setTargets] = useState(initial?.targets ?? []);
  const images = media.filter(
    item => item.kind === 'image' && item.internal !== true,
  );
  const selectedMedia = images.find(item => item.id === mediaId);
  const content: Prop['content'] | undefined =
    kind === 'text'
      ? {
          kind: 'text',
          text,
          style: textStyle,
        }
      : selectedMedia
        ? {kind: 'image', media: selectedMedia.id}
        : undefined;
  const prop = content ? {id, name, content, targets} : undefined;
  const reason =
    kind === 'text' && !textStyle.font.trim()
      ? '글꼴을 입력해야 저장할 수 있습니다.'
      : kind === 'text' && !isLyricTextColor(textStyle.color)
        ? '#RRGGBB 형식으로 입력'
        : prop
          ? propReason(prop)
          : '이미지를 골라야 저장할 수 있습니다.';
  return (
    <Dialog
      title={initial ? '그래픽 수정' : '그래픽 추가'}
      size="s"
      onCancel={onCancel}
      primary={{
        label: initial ? '저장' : '추가',
        disabled: locked || reason !== undefined,
        title: reason,
        onSelect: () => {
          if (prop) onSave(prop);
        },
      }}
    >
      <Properties placement="window">
        <PropertyRow label="이름">
          {({controlId}) => (
            <TextField
              id={controlId}
              block
              value={name}
              onChange={setName}
              maxLength={NAME_LIMIT}
              readOnly={locked}
            />
          )}
        </PropertyRow>
        <PropertyRow label="내용">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              block
              value={kind}
              disabled={locked}
              options={[
                {value: 'text', label: '글자'},
                {value: 'image', label: '이미지'},
              ]}
              onChange={value => setKind(value === 'image' ? 'image' : 'text')}
            />
          )}
        </PropertyRow>
        {kind === 'text' ? (
          <PropertyRow label="문구" alignTop>
            {({controlId}) => (
              <TextArea
                id={controlId}
                value={text}
                onChange={setText}
                maxLength={4000}
                readOnly={locked}
              />
            )}
          </PropertyRow>
        ) : (
          <PropertyRow label="이미지">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                value={selectedMedia?.id}
                disabled={locked}
                valueText={
                  mediaId && !selectedMedia
                    ? '이미지를 찾을 수 없습니다.'
                    : undefined
                }
                options={images.map(item => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={value =>
                  setMediaId(images.find(item => item.id === value)?.id)
                }
              />
            )}
          </PropertyRow>
        )}
        {kind === 'text' ? (
          <>
            <PropertyRow label="글꼴">
              {({controlId}) => (
                <TextField
                  id={controlId}
                  value={textStyle.font}
                  readOnly={locked}
                  onChange={font =>
                    setTextStyle(current => ({...current, font}))
                  }
                />
              )}
            </PropertyRow>
            <PropertyRow label="글자 크기">
              {({controlId}) => (
                <NumberField
                  id={controlId}
                  value={textStyle.size}
                  min={1}
                  max={1000}
                  step={1}
                  unit="px"
                  disabled={locked}
                  updateOn="commit"
                  onChange={size =>
                    setTextStyle(current => ({...current, size}))
                  }
                />
              )}
            </PropertyRow>
            <PropertyRow label="글자 색">
              {({controlId}) => (
                <TextField
                  id={controlId}
                  value={textStyle.color}
                  readOnly={locked}
                  maxLength={7}
                  onChange={color =>
                    setTextStyle(current => ({...current, color}))
                  }
                />
              )}
            </PropertyRow>
          </>
        ) : null}
        <ScreenTargetsRow
          screens={screens}
          targets={targets}
          all={false}
          locked={locked}
          onChange={next => setTargets(next === 'all' ? [] : next)}
        />
      </Properties>
    </Dialog>
  );
}
