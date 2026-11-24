import {useMemo, useState, type JSX} from 'react';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {sameJson} from '@core/common/sameJson';
import {parseMediaId} from '@core/schema/common/ids';
import type {SlideBackground} from '@core/schema/screens/theme';
import {GRADIENT_PRESETS, THEME_BACKGROUNDS} from '@core/theme';
import {
  backgroundName,
  backgroundPicture,
  missingBackgroundTip,
} from '@renderer/features/media/picker/backgroundChoices';
import {
  MediaPicker,
  NONE_LABEL,
  type MediaPickerItem,
} from '@renderer/features/media/picker/MediaPicker';
import {pictureMedia, useMedia} from '@renderer/platform/documents/media';
import {lentPreviewUrl} from '@renderer/rendering/media/previewMedia';
import {backgroundPaint} from '@renderer/rendering/theme/themeBackground';
import {Select} from '@renderer/ui/choices/Select';

const FILL = 'fill:';
const THEME_LABEL = '테마 배경';
const MIXED = '혼합';
/** A picture of an import that is not saved yet. */
const IMPORTED_LABEL = '가져온 배경';

function paintOf(background: SlideBackground): string {
  const {backgroundColor, backgroundImage} = backgroundPaint(background);
  return backgroundImage === 'none'
    ? backgroundColor
    : `${backgroundImage}, ${backgroundColor}`;
}

const FILLS: readonly MediaPickerItem[] = GRADIENT_PRESETS.map(
  ({name, gradient}) => ({
    id: `${FILL}${name}`,
    name,
    kind: 'fill',
    paint: paintOf(gradient),
  }),
);

/** What a background is called. */
export function slideBackgroundName(
  background: SlideBackground | undefined,
  media: Parameters<typeof backgroundName>[0],
): string {
  switch (background?.kind) {
    case undefined:
      return THEME_LABEL;
    case 'none':
      return NONE_LABEL;
    case 'color':
      return background.color;
    case 'gradient':
      return (
        GRADIENT_PRESETS.find(preset => sameJson(preset.gradient, background))
          ?.name ?? '그라데이션'
      );
    case 'media':
      return lentPreviewUrl(background.media) === undefined
        ? backgroundName(media, background.media)
        : IMPORTED_LABEL;
  }
}

function choiceOf(background: SlideBackground | undefined): string | undefined {
  if (background?.kind === 'media') return background.media;
  if (background?.kind !== 'gradient') return undefined;
  const preset = GRADIENT_PRESETS.find(entry =>
    sameJson(entry.gradient, background),
  );
  return preset === undefined ? undefined : `${FILL}${preset.name}`;
}

/** Chooses what is behind the texts of the selected slides. */
export function SlideBackgroundControl({
  id,
  value,
  mixed = false,
  disabled,
  onChange,
}: {
  readonly id?: string | undefined;
  readonly value: SlideBackground | undefined;
  readonly mixed?: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: SlideBackground | undefined) => void;
}): JSX.Element {
  const media = useMedia(view => view.items);
  const pictures = useMemo(() => pictureMedia(media), [media]);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = value?.kind === 'media' ? value.media : undefined;
  const lent = shown === undefined ? undefined : lentPreviewUrl(shown);
  const missing =
    shown !== undefined &&
    lent === undefined &&
    !pictures.some(item => item.id === shown) &&
    backgroundPicture(shown) === undefined;
  const choose = (choice: string | undefined): void => {
    if (choice === undefined) {
      onChange(undefined);
      return;
    }
    if (choice.startsWith(FILL)) {
      onChange(
        GRADIENT_PRESETS.find(({name}) => `${FILL}${name}` === choice)
          ?.gradient,
      );
      return;
    }
    const own = parseMediaId(choice);
    if (own.ok) onChange({kind: 'media', media: own.value});
  };
  return (
    <>
      <Select
        ref={setTrigger}
        id={id}
        aria-label="배경"
        block
        value={mixed ? MIXED : slideBackgroundName(value, media)}
        lead={
          shown === undefined || mixed
            ? undefined
            : {kind: 'media', src: lent ?? thumbnailSrc(shown)}
        }
        title={missing ? missingBackgroundTip() : undefined}
        disabled={disabled}
        expanded={open && !disabled}
        onExpandedChange={expanded => {
          if (expanded) setQuery('');
          setOpen(expanded);
        }}
      />
      {open && !disabled && trigger !== null ? (
        <MediaPicker
          label="배경"
          anchor={trigger}
          items={[...THEME_BACKGROUNDS.map(toItem), ...pictures]}
          leadingGroup={{label: '색', items: FILLS}}
          itemsLabel="미디어"
          selected={mixed ? undefined : choiceOf(value)}
          defaultChoice={{label: THEME_LABEL, detail: ''}}
          explicitNone={{
            selected: !mixed && value?.kind === 'none',
            onSelect: () => onChange({kind: 'none'}),
          }}
          query={query}
          onQueryChange={setQuery}
          onSelect={choose}
          onClose={restore => {
            setOpen(false);
            if (restore) trigger.focus();
          }}
        />
      ) : null}
    </>
  );
}

function toItem(picture: {
  readonly id: string;
  readonly name: string;
}): MediaPickerItem {
  return {...picture, kind: 'image'};
}
