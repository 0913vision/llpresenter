import type {JSX} from 'react';
import {ButtonSection} from './ButtonSection';
import {CheckboxSection} from './CheckboxSection';
import {IconButtonSection} from './IconButtonSection';
import {KeyCapSection} from './KeyCapSection';
import {LabelSection} from './LabelSection';
import {ListRowSection} from './ListRowSection';
import {OverlaySection} from './OverlaySection';
import {PanelSection} from './PanelSection';
import {PropertySection} from './PropertySection';
import {SegmentedSection} from './SegmentedSection';
import {SelectSection} from './SelectSection';
import {SliderSection} from './SliderSection';
import {StatusMarksSection} from './StatusMarksSection';
import {SwitchSection} from './SwitchSection';
import {TextFieldSection} from './TextFieldSection';
import {ToolbarSection} from './ToolbarSection';
import styles from './Gallery.module.css';

interface GalleryEntry {
  // NOTE(0913vision): The design system component name, so that `?c=<name>`
  // and the card server's `/card/<name>` name the same component.
  readonly name: string;
  readonly Section: () => JSX.Element;
}

/** Every component in the gallery, in the order of the design system. */
export const galleryEntries: readonly GalleryEntry[] = [
  {name: 'Button', Section: ButtonSection},
  {name: 'IconButton', Section: IconButtonSection},
  {name: 'SegmentedControl', Section: SegmentedSection},
  {name: 'ToolbarButton', Section: ToolbarSection},
  {name: 'TextField', Section: TextFieldSection},
  {name: 'Select', Section: SelectSection},
  {name: 'Checkbox', Section: CheckboxSection},
  {name: 'Switch', Section: SwitchSection},
  {name: 'Slider', Section: SliderSection},
  {name: 'StatusMarks', Section: StatusMarksSection},
  {name: 'Panel', Section: PanelSection},
  {name: 'ListRow', Section: ListRowSection},
  {name: 'Overlays', Section: OverlaySection},
  {name: 'PropertyRow', Section: PropertySection},
  {name: 'KeyCap', Section: KeyCapSection},
  {name: 'LabelChip', Section: LabelSection},
];

const COMPONENT_PARAM = 'c';

export interface GalleryProps {
  /** Shows only this component, or every component when it is undefined. */
  readonly only: string | undefined;
}

/** Reads which component to show from a gallery URL query such as `?c=Button`. */
export function galleryFilter(search: string): string | undefined {
  return new URLSearchParams(search).get(COMPONENT_PARAM) ?? undefined;
}

/**
 * A development page that shows every UI component in every state, laid out
 * like its design system preview card.
 */
export function Gallery({only}: GalleryProps): JSX.Element {
  const shown = galleryEntries.filter(
    entry => only === undefined || entry.name === only,
  );
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Components">
        <a href="?" aria-current={only === undefined ? 'page' : undefined}>
          All
        </a>
        {galleryEntries.map(entry => (
          <a
            key={entry.name}
            href={`?${COMPONENT_PARAM}=${entry.name}`}
            aria-current={entry.name === only ? 'page' : undefined}
          >
            {entry.name}
          </a>
        ))}
      </nav>
      <p className={styles.note}>
        Hover, Pressed, and Focus specimens are drawn in their default state.
        Point at them or press Tab to see the state.
      </p>
      {shown.map(({name, Section}) => (
        <Section key={name} />
      ))}
    </main>
  );
}
