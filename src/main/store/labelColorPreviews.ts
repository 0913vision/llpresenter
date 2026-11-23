import type {WebContents} from 'electron';
import {settingsEndpoints} from '@contracts/ipc/settings';
import type {LabelColorPreviewRequest} from '@core/schema/labelColorPreview';
import type {IpcHost} from '../base/ipcHost';
import type {SettingsStore} from './settingsStore';

/** The color of a label that one window tries out before it is saved. */
export class LabelColorPreviews {
  private owner: WebContents | undefined;

  constructor(private readonly ipc: Pick<IpcHost, 'push'>) {}

  /** Shows a color to every window, or takes it back, and tells if it did. */
  change(
    {name, color}: LabelColorPreviewRequest,
    contents: WebContents,
    settings: Pick<SettingsStore, 'get'>,
  ): boolean {
    if (contents.isDestroyed()) return false;
    if (color === null) {
      if (this.owner === contents) this.clear();
      return true;
    }
    const labels = settings.get('labels');
    if (
      labels.name !== 'labels' ||
      labels.access !== 'editable' ||
      !labels.value.labels.some(label => label.name === name)
    ) {
      return false;
    }
    this.giveTo(contents);
    this.ipc.push(settingsEndpoints.labelColorPreview, {name, color});
    return true;
  }

  /** Takes back the color that is shown, if there is one. */
  readonly clear = (): void => {
    if (this.owner === undefined) return;
    this.owner.removeListener('destroyed', this.clear);
    this.owner = undefined;
    this.ipc.push(settingsEndpoints.labelColorPreview, null);
  };

  private giveTo(contents: WebContents): void {
    if (this.owner === contents) return;
    this.clear();
    this.owner = contents;
    contents.once('destroyed', this.clear);
  }
}
