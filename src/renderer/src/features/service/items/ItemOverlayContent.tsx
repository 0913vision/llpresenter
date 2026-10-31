import {useState, type JSX} from 'react';
import type {MediaItem} from '@core/schema/mediaList';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import type {MediaId} from '@core/schema/ids';
import {Dialog} from '@renderer/ui/Dialog';
import {Select} from '@renderer/ui/Select';
import {TextArea} from '@renderer/ui/TextArea';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {Properties, PropertyRow} from '@renderer/ui/PropertyRow';
import {editorTask} from '@renderer/features/songs/editor/editorTask';

export function ItemOverlayContent({
  overlay,
  media,
  onSave,
  onClose,
}: {
  readonly overlay: ItemOverlay;
  readonly media: readonly MediaItem[];
  readonly onSave: (content: ItemOverlay['content']) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [kind, setKind] = useState<'text' | 'media'>(
    'text' in overlay.content ? 'text' : 'media',
  );
  const [text, setText] = useState(
    'text' in overlay.content ? overlay.content.text : '',
  );
  const [selected, setSelected] = useState<MediaId | undefined>(
    'media' in overlay.content ? overlay.content.media : undefined,
  );
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const save = (content: ItemOverlay['content']): void => {
    setSaving(true);
    editorTask(
      onSave(content).then(saved => {
        if (saved) onClose();
        else setSaving(false);
      }),
    );
  };
  return (
    <Dialog
      title="오버레이 내용"
      size="m"
      onCancel={onClose}
      primary={{
        label: '적용',
        disabled: saving || (kind === 'media' && selected === undefined),
        title: saving
          ? '저장 중'
          : kind === 'media' && selected === undefined
            ? '미디어를 선택하세요'
            : undefined,
        onSelect: () => {
          const unknown: Record<string, unknown> = {...overlay.content};
          delete unknown.media;
          delete unknown.text;
          delete unknown.loop;
          delete unknown.sound;
          if (kind === 'text') save({...unknown, text});
          else if (selected !== undefined) {
            const previous =
              'media' in overlay.content && overlay.content.media === selected
                ? overlay.content
                : undefined;
            save({
              ...unknown,
              media: selected,
              loop: previous?.loop ?? false,
              sound: previous?.sound ?? false,
            });
          }
        },
      }}
    >
      <Properties>
        <PropertyRow label="내용">
          {({labelId, controlId}) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              options={[
                {value: 'text', label: '글자'},
                {value: 'media', label: '미디어'},
              ]}
              value={kind}
              disabled={saving}
              onChange={setKind}
            />
          )}
        </PropertyRow>
        {kind === 'text' ? (
          <TextArea
            aria-label="오버레이 글자"
            value={text}
            readOnly={saving}
            onChange={setText}
          />
        ) : (
          <Select
            ref={setTrigger}
            disabled={saving}
            aria-label="오버레이 미디어"
            value={media.find(item => item.id === selected)?.name ?? '없음'}
            expanded={anchor !== null}
            onExpandedChange={open => setAnchor(open ? trigger : null)}
          />
        )}
      </Properties>
      {anchor === null ? null : (
        <MediaPicker
          anchor={anchor}
          items={media}
          selected={selected}
          query={query}
          onQueryChange={setQuery}
          onSelect={setSelected}
          onClose={() => setAnchor(null)}
        />
      )}
    </Dialog>
  );
}
