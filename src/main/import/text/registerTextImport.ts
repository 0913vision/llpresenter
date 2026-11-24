import {clipboard, dialog, type BrowserWindow} from 'electron';
import {textImportEndpoints} from '@contracts/ipc/textImport';
import type {
  TextImportPreviewRequest,
  TextImportPreviewResult,
  TextImportReadRequest,
  TextImportReadResult,
} from '@core/schema/songs/textImport';
import {TEXT_IMPORT_LIMITS} from '@core/schema/songs/textImportLimits';
import {convertTextImport} from '@core/songs';
import {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import type {WindowMode} from '../../base/renderers/windowMode';
import type {UiStateFields} from '../../store/locations/appConfigFile';
import {pickerFolder, rememberPickerFile} from '../../uiState/pickerFolder';
import {readTextImport, type TextImportInputs} from './read';
import {TEST_IMPORT_FILE_VARIABLE} from '../testImportFile';

export interface TextImportRegistration {
  readonly control: BrowserWindow;
  readonly windowMode: WindowMode;
  readonly log: Logger;
  readonly uiState?: UiStateFields;
}

function nativeInputs(options: TextImportRegistration): TextImportInputs {
  return {
    chooseFile: async () => {
      if (options.windowMode === 'offscreen') {
        const injected = process.env[TEST_IMPORT_FILE_VARIABLE];
        if (injected) return injected;
      }
      const control = options.control;
      if (options.windowMode === 'offscreen' || control.isDestroyed()) {
        throw new Error('The file dialog is unavailable');
      }
      const selected = await dialog.showOpenDialog(control, {
        defaultPath: await pickerFolder(options.uiState, 'textImportFolder'),
        properties: ['openFile'],
        filters: [{name: '텍스트 파일', extensions: ['txt']}],
      });
      if (selected.canceled) return null;
      rememberPickerFile(
        options.uiState,
        'textImportFolder',
        selected.filePaths[0],
      );
      return selected.filePaths[0] ?? null;
    },
    readClipboard: () => clipboard.readText(),
  };
}

class TextImportSession {
  private disposed = false;
  private reading = false;
  private clipboardCheck: Promise<boolean> | undefined;
  private lastFile: string | null = null;

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

  async read(request: TextImportReadRequest): Promise<TextImportReadResult> {
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
      const result = await readTextImport(request, {
        ...this.inputs,
        chooseFile: async () => {
          if (request.again === true && this.lastFile !== null) {
            return this.lastFile;
          }
          const path = await this.inputs.chooseFile();
          if (path !== null) this.lastFile = path;
          return path;
        },
      });
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

  preview(request: TextImportPreviewRequest): TextImportPreviewResult {
    if (this.isDisposed()) {
      return {
        ok: false,
        error: {reason: 'invalid', message: 'The text import was closed'},
      };
    }
    const result = convertTextImport(request);
    if (!result.ok) {
      this.log.warn('could not convert text import input', result.error);
    }
    return result;
  }

  close(): void {
    this.disposed = true;
  }
}

/**
 * Answers the calls that bring in a song from text.
 *
 * @returns A function that stops answering.
 */
export function registerTextImport(
  context: TextImportRegistration,
): () => void {
  const ipc = new IpcHost(context.log);
  const session = new TextImportSession(nativeInputs(context), context.log);
  ipc.whenClosed(() => {
    session.close();
  });
  ipc.query(textImportEndpoints.clipboardAvailable, () =>
    session.clipboardAvailable(),
  );
  ipc.request(textImportEndpoints.readText, request => session.read(request));
  ipc.request(textImportEndpoints.previewText, request =>
    session.preview(request),
  );
  return () => {
    ipc.close();
  };
}
