import {useState, type JSX} from 'react';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {THEME_BACKGROUNDS, THEME_DECORATIONS} from '@core/themes/pictures';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {Select} from '@renderer/ui/Select';

const BACKGROUNDS = {
  label: '기본 배경',
  items: THEME_BACKGROUNDS.map(picture => ({
    ...picture,
    kind: 'image' as const,
  })),
};

export function ThemeImageChoice({
  id,
  images,
  selected,
  reason,
  change,
}: {
  readonly id?: string;
  readonly images: readonly MediaItem[];
  readonly selected: MediaId | undefined;
  readonly reason: string | undefined;
  readonly change: (id: MediaId) => void;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const image = [...THEME_BACKGROUNDS, ...THEME_DECORATIONS, ...images].find(
    image => image.id === selected,
  );
  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) button?.focus();
  };
  return (
    <>
      <Select
        id={id}
        aria-label="이미지"
        ref={setButton}
        block
        value={image?.name ?? '이미지 선택'}
        lead={{kind: 'icon', icon: 'image'}}
        expanded={open}
        onExpandedChange={setOpen}
        disabled={reason !== undefined}
        title={reason}
      />
      {!open || button === null ? null : (
        <MediaPicker
          allowNone={false}
          label="이미지"
          anchor={button}
          items={images}
          leadingGroup={BACKGROUNDS}
          itemsLabel="미디어"
          selected={selected}
          query={query}
          onQueryChange={setQuery}
          onSelect={id => {
            if (id !== undefined) change(id);
          }}
          onClose={close}
        />
      )}
    </>
  );
}
