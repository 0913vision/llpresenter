import type {AppLayout} from '@shared/schema/appConfig';
import {
  parseLayoutChange,
  parseMediaStripChange,
  type UiState,
} from '@shared/schema/uiState';
import type {Logger} from '../log';
import type {UiStateFields} from '../store/appConfigFile';
import {withLayoutChange} from './layout';

export interface UiStateStoreOptions {
  readonly fields: UiStateFields;
  readonly log: Logger;
}

/**
 * The UI state of the control window, kept in the UI fields of `app.json`.
 * The data store owns the file: this class never reads, parses, or writes it,
 * it only reads the fields and hands over the changed ones.
 */
export class UiStateStore {
  constructor(private readonly options: UiStateStoreOptions) {}

  /** The UI state for the control window. */
  get state(): UiState {
    const {layout, mediaStrip} = this.options.fields.read();
    return {
      ...(layout === undefined ? {} : {layout}),
      ...(mediaStrip === undefined ? {} : {mediaStrip}),
    };
  }

  /**
   * Merges a layout change into its size class, field by field. Invalid values
   * are logged and dropped.
   */
  setLayout(value: unknown): void {
    const change = parseLayoutChange(value);
    if (!change.ok) {
      this.options.log.warn('dropped a malformed layout change', change.error);
      return;
    }
    const layout: AppLayout = withLayoutChange(
      this.options.fields.read().layout,
      change.value,
    );
    this.options.fields.change({layout});
  }

  /** Saves only the validated media strip choice, retaining other app fields. */
  setMediaStrip(value: unknown): void {
    const change = parseMediaStripChange(value);
    if (!change.ok) {
      this.options.log.warn(
        'dropped a malformed media strip change',
        change.error,
      );
      return;
    }
    this.options.fields.change({mediaStrip: change.value.visible});
  }
}
