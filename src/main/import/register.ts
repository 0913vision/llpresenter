import {clipboard, dialog, ipcMain, type BrowserWindow} from 'electron';
import {Channels} from '@shared/ipc';
import {
  parseTextImportPreviewRequest,
  parseTextImportReadRequest,
  type TextImportFailure,
  type TextImportPreviewResult,
  type TextImportReadResult,
} from '@shared/schema/textImport';
import type {PayloadError} from '@shared/schema/payload';
import type {Logger} from '../log';
import type {WindowMode} from '../windows/testWindows';
import {convertTextImport} from './convert';
import {readTextImport, type TextImportInputs} from './read';
import {TEXT_IMPORT_LIMITS} from './limits';

/** Names the file that stands in for the file dialog when windows are offscreen. */
export const TEST_IMPORT_FILE_VARIABLE = 'LLP_TEST_IMPORT_FILE';

export interface TextImportRegistration {
  readonly control: BrowserWindow;
  readonly windowMode: WindowMode;
  readonly log: Logger;
}

function invalidRequest(
  log: Logger,
  error: PayloadError,
): {readonly ok: false; readonly error: TextImportFailure} {
  log.warn('dropped a malformed text import request', error);
  return {
    ok: false,
    error: {reason: 'invalid', message: `${error.field}: ${error.message}`},
  };
}

function nativeInputs({
  control,
  windowMode,
}: TextImportRegistration): TextImportInputs {
  return {
    chooseFile: async () => {
      if (windowMode === 'offscreen') {
        const injected = process.env[TEST_IMPORT_FILE_VARIABLE];
        if (injected) return injected;
      }
      if (windowMode === 'offscreen' || control.isDestroyed()) {
        throw new Error('The file dialog is unavailable');
      }
      const selected = await dialog.showOpenDialog(control, {
        properties: ['openFile'],
        filters: [{name: '텍스트 파일', extensions: ['txt']}],
      });
      return selected.canceled ? null : (selected.filePaths[0] ?? null);
    },
    readClipboard: () => clipboard.readText(),
  };
}

class TextImportSession {
  private disposed = false;
  private reading = false;
  private clipboardCheck: Promise<boolean> | undefined;

  constructor(
    private readonly inputs: TextImportInputs,
    private readonly log: Logger,
  ) {}

  private isDisposed(): boolean {
    return this.disposed;
  }

  clipboardAvailable(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    this.clipboardCheck ??= this.checkClipboard().finally(() => {
      this.clipboardCheck = undefined;
    });
    return this.clipboardCheck;
  }

  private async checkClipboard(): Promise<boolean> {
    try {
      const text = await this.inputs.readClipboard();
      return (
        !this.isDisposed() &&
        text.length <= TEXT_IMPORT_LIMITS.characters &&
        text.trim() !== ''
      );
    } catch (error) {
      this.log.warn('could not check clipboard text availability', error);
      return false;
    }
  }

  async read(value: unknown): Promise<TextImportReadResult> {
    const parsed = parseTextImportReadRequest(value);
    if (!parsed.ok) return invalidRequest(this.log, parsed.error);
    if (this.isDisposed() || this.reading) {
      return {
        ok: false,
        error: {
          reason: 'read-failed',
          message: 'A text import read is unavailable',
        },
      };
    }
    this.reading = true;
    try {
      const result = await readTextImport(parsed.value, this.inputs);
      if (!result.ok) {
        this.log.warn('could not read text import input', result.error);
      }
      if (this.isDisposed()) {
        return {
          ok: false,
          error: {reason: 'read-failed', message: 'The text import was closed'},
        };
      }
      return result;
    } finally {
      this.reading = false;
    }
  }

  preview(value: unknown): TextImportPreviewResult {
    const parsed = parseTextImportPreviewRequest(value);
    if (!parsed.ok) return invalidRequest(this.log, parsed.error);
    if (this.isDisposed()) {
      return {
        ok: false,
        error: {reason: 'invalid', message: 'The text import was closed'},
      };
    }
    const result = convertTextImport(parsed.value);
    if (!result.ok) {
      this.log.warn('could not convert text import input', result.error);
    }
    return result;
  }

  close(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    return true;
  }
}

/** Answers read/preview IPC and returns the handler cleanup. */
export function registerTextImport(
  context: TextImportRegistration,
): () => void {
  const session = new TextImportSession(nativeInputs(context), context.log);
  ipcMain.handle(Channels.textImportClipboardAvailable, () =>
    session.clipboardAvailable(),
  );
  ipcMain.handle(Channels.textImportRead, (_event, value: unknown) =>
    session.read(value),
  );
  ipcMain.handle(Channels.textImportPreview, (_event, value: unknown) =>
    session.preview(value),
  );
  return () => {
    if (!session.close()) return;
    ipcMain.removeHandler(Channels.textImportRead);
    ipcMain.removeHandler(Channels.textImportClipboardAvailable);
    ipcMain.removeHandler(Channels.textImportPreview);
  };
}
