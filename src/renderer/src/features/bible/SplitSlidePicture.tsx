import type {JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import type {BibleTextElement} from '@renderer/rendering/bibleMeasure';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {themeBackgroundColor} from '@renderer/rendering/themeBackground';
import {Still} from '@renderer/pictures/SlidePicture';
import type {StillAppearance} from '@renderer/rendering/slideStill';
import type {BibleAppearance} from './passageSplitter';
import styles from './SplitEditor.module.css';

function stillAppearance(
  appearance: BibleAppearance | undefined,
  element: BibleTextElement,
): StillAppearance {
  if (appearance !== undefined) {
    return {
      screen: appearance.screen,
      theme: {
        themeId: appearance.themeId,
        revision: 0,
        missing: [],
        sourceScreenId: appearance.sourceScreenId,
        layout: appearance.layout,
        emptyColor: appearance.emptyColor,
        item: appearance.item,
      },
      background: themeBackgroundColor(
        appearance.layout.background,
        appearance.emptyColor,
      ),
    };
  }
  const {screen, theme} = previewAppearance({
    role: 'audience',
    themes: undefined,
    screens: undefined,
    item: {id: 'split-preview', kind: 'bible', source: 'external'},
  });
  return {
    screen,
    theme: {
      ...theme,
      layout: {
        ...theme.layout,
        elements: theme.layout.elements.map(value =>
          value.kind === 'currentText' ? element : value,
        ),
      },
    },
    background: themeBackgroundColor(theme.layout.background, theme.emptyColor),
  };
}

/** A cut of a verse, with the lines that fit marked around it. */
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
  readonly appearance: BibleAppearance | undefined;
  readonly part?: number;
}): JSX.Element {
  return (
    <div className={styles.picture}>
      <Still
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
        appearance={stillAppearance(appearance, element)}
        options={{biblePreview: {elementId: element.id, maxLines}}}
      />
    </div>
  );
}
