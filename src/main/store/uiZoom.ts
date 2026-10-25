import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import {
  parseUiZoomCommand,
  UI_ZOOM,
  type UiZoomCommand,
} from '@shared/schema/uiZoom';
import type {Logger} from '../log';
import type {AppConfigFile} from './appConfigFile';

const PERCENT_PER_FACTOR = 100;

export interface ZoomControl {
  readonly id: number;
  isDestroyed(): boolean;
  setZoomMode(mode: 'isolated'): void;
  setZoomFactor(factor: number): void;
  on(event: 'did-finish-load' | 'destroyed', listener: () => void): unknown;
  removeListener(
    event: 'did-finish-load' | 'destroyed',
    listener: () => void,
  ): unknown;
}

export interface UiZoomRegistration {
  /** Only control windows attach here, before their page begins loading. */
  attachControl(contents: ZoomControl): void;
  dispose(): void;
}

interface AttachedControl {
  readonly apply: () => void;
  readonly dispose: () => void;
}

/** Registers computer-local zoom commands; app.json keeps its single writer. */
export function registerUiZoom(
  config: Pick<AppConfigFile, 'uiZoomPercent' | 'setUiZoomPercent'>,
  log: Logger,
): UiZoomRegistration {
  const controls = new Map<number, AttachedControl>();
  const requireControl = (id: number): void => {
    if (controls.has(id)) return;
    log.warn('dropped a UI zoom request from a non-control window', {
      senderId: id,
    });
    throw new Error('Only control windows may use UI zoom');
  };
  ipcMain.handle(Channels.uiZoomGet, event => {
    requireControl(event.sender.id);
    return config.uiZoomPercent;
  });
  ipcMain.handle(Channels.uiZoomChange, (event, value: unknown) => {
    requireControl(event.sender.id);
    const command = parseUiZoomCommand(value);
    if (!command.ok) {
      log.warn('dropped a malformed UI zoom command', command.error);
      throw new Error('Invalid UI zoom command');
    }
    const percent = changedZoom(config.uiZoomPercent, command.value);
    if (percent !== config.uiZoomPercent) {
      config.setUiZoomPercent(percent);
      for (const control of controls.values()) control.apply();
    }
    return percent;
  });

  return {
    attachControl: contents => {
      controls.get(contents.id)?.dispose();
      if (contents.isDestroyed()) return;
      try {
        contents.setZoomMode('isolated');
      } catch (error: unknown) {
        log.error('could not isolate control window zoom', error);
        return;
      }
      const apply = (): void => {
        if (contents.isDestroyed()) return;
        try {
          contents.setZoomFactor(config.uiZoomPercent / PERCENT_PER_FACTOR);
        } catch (error: unknown) {
          log.error('could not apply control window zoom', error);
        }
      };
      const dispose = (): void => {
        contents.removeListener('did-finish-load', apply);
        contents.removeListener('destroyed', dispose);
        controls.delete(contents.id);
      };
      controls.set(contents.id, {apply, dispose});
      contents.on('did-finish-load', apply);
      contents.on('destroyed', dispose);
      apply();
    },
    dispose: () => {
      ipcMain.removeHandler(Channels.uiZoomGet);
      ipcMain.removeHandler(Channels.uiZoomChange);
      for (const control of [...controls.values()]) control.dispose();
    },
  };
}

function changedZoom(percent: number, command: UiZoomCommand): number {
  switch (command.type) {
    case 'ui.zoomIn':
      return Math.min(UI_ZOOM.max, percent + UI_ZOOM.step);
    case 'ui.zoomOut':
      return Math.max(UI_ZOOM.min, percent - UI_ZOOM.step);
    case 'ui.zoomReset':
      return UI_ZOOM.defaultPercent;
  }
}
