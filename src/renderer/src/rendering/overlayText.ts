import {DEFAULT_TEXT_STYLE, type TextStyle} from '@core/themes/textStyle';
import {SlideLayerView} from './slideLayer';

/** The style of overlay text with no style of its own (the 무대 메시지; 소품 text supplies its stored style). */
export const DEFAULT_OVERLAY_TEXT_STYLE: TextStyle = DEFAULT_TEXT_STYLE;

/** Reuses two text pages; even multiline text occupies one row per page. */
export class OverlayTextView {
  private readonly view: SlideLayerView;
  private text: string | null = null;

  constructor(parent: HTMLElement) {
    this.view = new SlideLayerView(parent, DEFAULT_OVERLAY_TEXT_STYLE);
  }

  show(
    text: string | null,
    style: TextStyle = DEFAULT_OVERLAY_TEXT_STYLE,
  ): void {
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

  /**
   * Changes the shown text in place, without a dissolve, as a ticking 타이머
   * does. With no style given, the text keeps the style it has.
   */
  replace(text: string, style?: TextStyle): void {
    if (style !== undefined) this.view.setStyle(style);
    if (text === this.text || this.text === null) return;
    this.text = text;
    this.view.replaceLines([text]);
  }

  rescale(scale: number): void {
    this.view.rescale(scale);
  }

  dispose(): void {
    this.view.dispose();
  }
}
