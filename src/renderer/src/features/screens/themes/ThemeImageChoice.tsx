import {useState, type JSX} from 'react';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {Select} from '@renderer/ui/Select';

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
  const image = images.find(image => image.id === selected);
  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) button?.focus();
  };
  return (
    <>
      <Select
        id={id}
        aria-label="그림"
        ref={setButton}
        block
        value={image?.name ?? '그림 선택…'}
        lead={{kind: 'icon', icon: 'image'}}
        expanded={open}
        onExpandedChange={setOpen}
        disabled={reason !== undefined}
        title={reason}
      />
      {!open || button === null ? null : (
        <MediaPicker
          allowNone={false}
          label="그림"
          anchor={button}
          items={images}
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
