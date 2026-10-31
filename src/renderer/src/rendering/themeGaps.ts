import type {RenderFrame} from './layer';

export const MAX_THEME_GAPS = 32;

/** A bounded report set per output screen, reset when the theme document changes. */
export class ThemeGaps {
  private readonly reported = new Set<string>();
  private revision = '';
  private screen = '';

  constructor(
    private readonly report: (message: string, error: unknown) => void,
  ) {}

  follow(frame: RenderFrame): void {
    const screen = frame.screen?.id ?? '';
    const revision = String(frame.theme?.revision ?? '');
    if (screen !== this.screen || revision !== this.revision) {
      this.reported.clear();
      this.screen = screen;
      this.revision = revision;
    }
    for (const id of frame.theme?.missing ?? []) this.missing('theme', id);
  }

  missing(kind: 'theme' | 'font' | 'media', id: string): void {
    const key = `${kind}:${id}`;
    if (this.reported.has(key) || this.reported.size >= MAX_THEME_GAPS) return;
    this.reported.add(key);
    this.report(
      `missing theme resource: ${kind} ${id} on screen ${this.screen}`,
      {screenId: this.screen, kind, id},
    );
  }

  failed(id: string, error: unknown): void {
    const key = `element:${id}`;
    if (this.reported.has(key) || this.reported.size >= MAX_THEME_GAPS) return;
    this.reported.add(key);
    this.report(`could not draw theme element ${id} on screen ${this.screen}`, {
      screenId: this.screen,
      id,
      error,
    });
  }
}
