import type {AppLayout} from '@core/schema/appConfig';
import type {MediaBrowserChange} from '@core/schema/mediaBrowser';
import type {
  LayoutChange,
  MediaStripChange,
  RememberedViewChange,
  UiState,
} from '@core/schema/uiState';
import type {UiStateFields} from '../store/appConfigFile';
import {withLayoutChange} from './layout';

/**
 * The UI state of the control window, kept in the UI fields of `app.json`.
 * The data store owns the file: this class never reads, parses, or writes it,
 * it only reads the fields and hands over the changed ones.
 */
export class UiStateStore {
  constructor(private readonly fields: UiStateFields) {}

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
    } = this.fields.read();
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

  setRememberedView({macroCollection, ...rest}: RememberedViewChange): void {
    this.fields.change({
      ...rest,
      ...(macroCollection === undefined
        ? {}
        : {macroCollection: macroCollection ?? undefined}),
    });
  }

  /** Merges a layout change into its size class, field by field. */
  setLayout(change: LayoutChange): void {
    const layout: AppLayout = withLayoutChange(
      this.fields.read().layout,
      change,
    );
    this.fields.change({layout});
  }

  /** Saves only the media strip choice. */
  setMediaStrip({visible}: MediaStripChange): void {
    this.fields.change({mediaStrip: visible});
  }

  /** Changes only the fields that are given. */
  setMediaBrowser(change: MediaBrowserChange): void {
    const previous = this.fields.read().mediaBrowser;
    this.fields.change({mediaBrowser: {...previous, ...change}});
  }
}
