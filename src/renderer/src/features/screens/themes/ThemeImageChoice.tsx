import {useMemo, useState, type JSX} from 'react';
import {parseMediaId, type MediaId} from '@core/schema/ids';
import {THEME_BACKGROUNDS, THEME_DECORATIONS} from '@core/theme/pictures';
import {MediaPicker} from '@renderer/features/media/MediaPicker';
import {useMedia} from '@renderer/platform/media';
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
  selected,
  reason,
  change,
}: {
  readonly id?: string;
  readonly selected: MediaId | undefined;
  readonly reason: string | undefined;
  readonly change: (id: MediaId) => void;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const media = useMedia(view => view.items);
  const images = useMemo(
    () => media.filter(item => item.kind === 'image' && item.internal !== true),
    [media],
  );
  const image = [...THEME_BACKGROUNDS, ...THEME_DECORATIONS, ...images].find(
    entry => entry.id === selected,
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
          onSelect={choice => {
            const parsed = parseMediaId(choice ?? '');
            if (parsed.ok) change(parsed.value);
          }}
          onClose={close}
        />
      )}
    </>
  );
}
