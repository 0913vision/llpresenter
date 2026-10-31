import {useState, type JSX} from 'react';
import {createPropId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {Prop} from '@core/schema/props';
import type {Screen} from '@core/schema/screens';
import {
  Button,
  Dialog,
  Properties,
  PropertyRow,
  SelectMenu,
  TextArea,
  TextField,
} from '@renderer/ui';
import {propReason} from './propEdits';

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
  const [mediaId, setMediaId] = useState(
    initial?.content.kind === 'image' ? initial.content.media : undefined,
  );
  const [targets, setTargets] = useState(initial?.targets ?? []);
  const images = media.filter(item => item.kind === 'image');
  const selectedMedia = images.find(item => item.id === mediaId);
  const content: Prop['content'] | undefined =
    kind === 'text'
      ? {
          kind: 'text',
          text,
          style:
            initial?.content.kind === 'text'
              ? initial.content.style
              : DEFAULT_STYLE,
        }
      : selectedMedia
        ? {kind: 'image', media: selectedMedia.id}
        : undefined;
  const prop = content ? {id, name, content, targets} : undefined;
  const reason = prop ? propReason(prop) : '이미지를 선택하세요';
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
              maxLength={256}
              readOnly={locked}
            />
          )}
        </PropertyRow>
        <PropertyRow label="내용 종류">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              block
              value={kind}
              disabled={locked}
              options={[
                {value: 'text', label: '텍스트'},
                {value: 'image', label: '이미지'},
              ]}
              onChange={value => setKind(value === 'image' ? 'image' : 'text')}
            />
          )}
        </PropertyRow>
        {kind === 'text' ? (
          <PropertyRow label="내용" alignTop>
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
                    ? '이미지를 찾을 수 없습니다'
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
        <PropertyRow label="보낼 화면" alignTop>
          {() => (
            <div role="group" aria-label="보낼 화면">
              {screens.map(screen => (
                <Button
                  key={screen.id}
                  disabled={locked}
                  aria-pressed={targets.includes(screen.id)}
                  onClick={() =>
                    setTargets(current =>
                      current.includes(screen.id)
                        ? current.filter(id => id !== screen.id)
                        : [...current, screen.id],
                    )
                  }
                >
                  {screen.name || '이름 없음'}
                </Button>
              ))}
            </div>
          )}
        </PropertyRow>
      </Properties>
    </Dialog>
  );
}
