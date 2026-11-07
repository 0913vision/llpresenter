import {useEffectEvent, useLayoutEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {openPreviewMedia} from '@renderer/rendering/previewMedia';
import type {BibleTextElement} from '@renderer/rendering/bibleMeasure';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import type {SplitAppearance} from './splitProjection';
import styles from './SplitEditor.module.css';

/** Uses the slides editor's output renderer, with a fixed-size verse line guide. */
export function SplitSlidePicture({
  lines,
  continued,
  reference,
  element,
  maxLines,
  appearance,
}: {
  readonly lines: readonly string[];
  readonly continued: boolean;
  readonly reference: string;
  readonly element: BibleTextElement;
  readonly maxLines: number;
  readonly appearance: SplitAppearance | undefined;
}): JSX.Element {
  const parent = useRef<HTMLDivElement>(null);
  const renderer = useRef<OutputRenderer | null>(null);
  const draw = useEffectEvent(() => {
    const fallback =
      appearance === undefined
        ? previewAppearance({
            role: 'audience',
            themes: undefined,
            screens: undefined,
            item: {id: 'split-preview', kind: 'bible', source: 'external'},
          })
        : undefined;
    const resolved = appearance ?? fallback;
    if (resolved === undefined) return;
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
    renderer.current?.render(
      {
        ...emptyLayers(),
        media:
          appearance?.background === undefined
            ? null
            : {
                mediaId: appearance.background,
                startedAt: 0,
                loop: true,
              },
        slide: {
          itemId: 'split-preview',
          position: 0,
          label: null,
          lines,
          continued,
          reference,
        },
      },
      {screen: resolved.screen, theme, transitions: false},
    );
  });
  useLayoutEffect(() => {
    if (parent.current === null) return;
    const previewMedia = openPreviewMedia(window.llp);
    const view = new OutputRenderer(parent.current, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      previewMedia,
      mode: 'preview',
      biblePreview: {elementId: element.id, maxLines},
      onError: (message, error) => console.error(message, error),
    });
    renderer.current = view;
    draw();
    return () => {
      renderer.current = null;
      view.dispose();
      previewMedia?.dispose();
    };
  }, [element.id, maxLines]);
  useLayoutEffect(
    () => draw(),
    [lines, continued, reference, element, appearance],
  );
  return <div ref={parent} className={styles.picture} />;
}
