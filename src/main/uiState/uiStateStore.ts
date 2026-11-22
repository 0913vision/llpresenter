import type {AppLayout} from '@core/schema/appConfig';
import {
  parseLayoutChange,
  parseMediaStripChange,
  parseRememberedViewChange,
  type UiState,
} from '@core/schema/uiState';
import {parseMediaBrowserChange} from '@core/schema/mediaBrowser';
import type {Logger} from '../base/log';
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
    const {
      layout,
      mediaStrip,
      mediaBrowser,
      previewBig,
      previewBigVisible,
      macroView,
      macroCollection,
      showToolTab,
      slideColumns,
    } = this.options.fields.read();
    return {
      ...(layout === undefined ? {} : {layout}),
      ...(mediaStrip === undefined ? {} : {mediaStrip}),
      ...(mediaBrowser === undefined ? {} : {mediaBrowser}),
      ...(previewBig === undefined ? {} : {previewBig}),
      ...(previewBigVisible === undefined ? {} : {previewBigVisible}),
      ...(macroView === undefined ? {} : {macroView}),
      ...(macroCollection === undefined ? {} : {macroCollection}),
      ...(showToolTab === undefined ? {} : {showToolTab}),
      ...(slideColumns === undefined ? {} : {slideColumns}),
    };
  }

  setRememberedView(value: unknown): void {
    const change = parseRememberedViewChange(value);
    if (!change.ok) {
      this.options.log.warn(
        'dropped a malformed remembered view',
        change.error,
      );
      return;
    }
    const {macroCollection, ...rest} = change.value;
    this.options.fields.change({
      ...rest,
      ...(macroCollection === undefined
        ? {}
        : {macroCollection: macroCollection ?? undefined}),
    });
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

  /** Merges only validated fields, preserving file metadata and concurrent UI choices. */
  setMediaBrowser(value: unknown): void {
    const change = parseMediaBrowserChange(value);
    if (!change.ok) {
      this.options.log.warn(
        'dropped a malformed media browser change',
        change.error,
      );
      return;
    }
    const previous = this.options.fields.read().mediaBrowser;
    this.options.fields.change({mediaBrowser: {...previous, ...change.value}});
  }
}
