import {createThemeElementId} from '@core/schema/ids';
import type {SlideLayer} from '@core/live/state';
import type {ThemeScreenLayout} from '@core/schema/themes';

export const STAGE_LYRIC_LABEL_ID = createThemeElementId(
  '562c0000-0000-4000-8000-000000000001',
);

export function stageLyricLabelLayout(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  song: boolean,
): ThemeScreenLayout {
  const label = slide?.label?.trim();
  if (
    !song ||
    slide === null ||
    slide.titleSlide ||
    slide.sectionCard ||
    !slide.lines.some(line => line.trim()) ||
    !label ||
    ['전주', '간주', '후주'].includes(label)
  ) {
    return layout;
  }
  const current = layout.elements.find(
    element => element.kind === 'currentText',
  );
  if (current?.kind !== 'currentText') return layout;
  const elements = layout.elements.filter(element => element.kind !== 'label');
  if (!slide.labelContinued) {
    const height = current.text.size * current.text.lineHeight;
    const lines = Math.max(
      1,
      Math.min(current.text.maxLines, slide.lines.length),
    );
    const y = Math.max(
      0,
      current.frame.y + (current.frame.h - lines * height) / 2 - height,
    );
    elements.push({
      id: STAGE_LYRIC_LABEL_ID,
      kind: 'label',
      frame: {x: current.frame.x, y, w: current.frame.w, h: height},
      text: {...current.text, maxLines: 1},
    });
  }
  return {...layout, elements};
}
