import {DEFAULT_LYRIC_STYLE, type LyricStyle} from './lyricStyle';
import {SlideLayerView} from './slideLayer';

/** One fixed message style until M3-X1; text props can supply their stored style. */
export const DEFAULT_MESSAGE_STYLE: LyricStyle = DEFAULT_LYRIC_STYLE;

/** Reuses two text pages; even multiline text occupies one row per page. */
export class OverlayTextView {
  private readonly view: SlideLayerView;
  private text: string | null = null;

  constructor(parent: HTMLElement) {
    this.view = new SlideLayerView(parent, DEFAULT_MESSAGE_STYLE);
  }

  show(text: string | null, style: LyricStyle = DEFAULT_MESSAGE_STYLE): void {
    this.view.setStyle(style);
    if (text === this.text) return;
    this.text = text;
    this.view.show(
      text === null
        ? null
        : {
            itemId: 'overlay',
            position: 0,
            label: null,
            lines: [text],
          },
    );
  }

  rescale(scale: number): void {
    this.view.rescale(scale);
  }

  dispose(): void {
    this.view.dispose();
  }
}
