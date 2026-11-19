import type {JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import type {BibleTextElement} from '@renderer/rendering/bibleMeasure';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {themeBackgroundColor} from '@renderer/rendering/themeBackground';
import {Picture} from '@renderer/rendering/pictures/Picture';
import {pictureBounds} from '@renderer/rendering/pictures/drawPicture';
import type {SplitAppearance} from './splitProjection';
import styles from './SplitEditor.module.css';

/** A cached output picture with a separate fixed-width verse line guide. */
export function SplitSlidePicture({
  lines,
  continued,
  reference,
  element,
  maxLines,
  appearance,
  part = 1,
}: {
  readonly lines: readonly string[];
  readonly continued: boolean;
  readonly reference: string;
  readonly element: BibleTextElement;
  readonly maxLines: number;
  readonly appearance: SplitAppearance | undefined;
  readonly part?: number;
}): JSX.Element {
  const resolved =
    appearance ??
    previewAppearance({
      role: 'audience',
      themes: undefined,
      screens: undefined,
      item: {id: 'split-preview', kind: 'bible', source: 'external'},
    });
  const theme =
    appearance === undefined
      ? {
          ...resolved.theme,
          layout: {
            ...resolved.theme.layout,
            elements: resolved.theme.layout.elements.map(value =>
              value.kind === 'currentText' ? element : value,
            ),
          },
        }
      : resolved.theme;
  const {frame, text} = element;
  const height = text.size * text.lineHeight * maxLines;
  const ratio = {top: 0, middle: 0.5, bottom: 1}[text.vAlign];
  const bounds = pictureBounds(resolved.screen.pictureSize);
  const scale = Math.min(bounds.width / 1920, bounds.height / 1080);
  const left = bounds.x + (bounds.width - 1920 * scale) / 2;
  const top = bounds.y + (bounds.height - 1080 * scale) / 2;
  const correction = resolved.screen.correction;
  const transform =
    correction === undefined
      ? undefined
      : `translate(${((correction.offset.x * scale) / 1920) * 100}%, ${((correction.offset.y * scale) / 1080) * 100}%) scale(${Math.max(0, 1 - (2 * correction.edgeMargin) / 100)})`;
  return (
    <div className={styles.picture}>
      <Picture
        editing
        layers={{
          ...emptyLayers(),
          media:
            appearance?.background === undefined
              ? null
              : {mediaId: appearance.background, startedAt: 0, loop: true},
          slide: {
            itemId: 'split-preview',
            position: 0,
            biblePart: part,
            label: null,
            lines,
            continued,
            reference,
          },
        }}
        appearance={{
          screen: resolved.screen,
          theme,
          background: themeBackgroundColor(
            theme.layout.background,
            theme.emptyColor,
          ),
          checker: false,
          biblePreview: {elementId: element.id, maxLines},
        }}
      />
      <div className={styles.guideSpace} style={{transform}} aria-hidden="true">
        <div
          className={styles.guide}
          style={{
            left: `${((left + frame.x * scale) / 1920) * 100}%`,
            top: `${((top + (frame.y + (frame.h - height) * ratio) * scale) / 1080) * 100}%`,
            width: `${((frame.w * scale) / 1920) * 100}%`,
            height: `${((height * scale) / 1080) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
