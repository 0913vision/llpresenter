import {dialog, type BrowserWindow} from 'electron';
import {constants as fsConstants} from 'node:fs';
import {copyFile, rm, stat} from 'node:fs/promises';
import {extname, join} from 'node:path';
import type {WindowMode} from '../../base/renderers/windowMode';
import type {UiStateFields} from '../../store/locations/appConfigFile';
import {pickerFolder, rememberPickerFile} from '../../uiState/pickerFolder';
import type {
  PowerPointImagesJob,
  PowerPointImagesResult,
} from './powerpointImages';
import {isPowerPointFourThree} from '../pptx/powerpointSize';
import {TEST_IMPORT_FILE_VARIABLE} from '../testImportFile';

const EXTENSIONS = ['pptx', 'pptm', 'ppt'];
const LEGACY_EXTENSION = '.ppt';

/** A use of PowerPoint that failed. */
export class PowerPointError extends Error {
  constructor(
    readonly use: 'convert' | 'export',
    readonly reason: PowerPointImagesResult,
  ) {
    super(`PowerPoint could not ${use}: ${reason}`);
  }
}

/** Where the operator chooses a file, and where that is remembered. */
export interface FileChooserOptions {
  readonly control: BrowserWindow;
  readonly windowMode: WindowMode;
  readonly uiState?: UiStateFields;
}

/** Asks for a PowerPoint file; `null` when the operator chose none. */
export async function choosePowerPointFile({
  control,
  windowMode,
  uiState,
}: FileChooserOptions): Promise<string | null> {
  if (windowMode === 'offscreen') {
    return checkedFile(process.env[TEST_IMPORT_FILE_VARIABLE]);
  }
  const chosen = await dialog.showOpenDialog(control, {
    defaultPath: await pickerFolder(uiState, 'powerpointImportFolder'),
    properties: ['openFile'],
    filters: [{name: 'PowerPoint', extensions: EXTENSIONS}],
  });
  if (chosen.canceled) return null;
  const path = checkedFile(chosen.filePaths[0]);
  rememberPickerFile(uiState, 'powerpointImportFolder', path);
  return path;
}

function checkedFile(path: string | undefined): string {
  if (path === undefined || path === '') {
    throw new Error('Missing PowerPoint file');
  }
  if (!EXTENSIONS.includes(extname(path).slice(1).toLowerCase())) {
    throw new Error('Unsupported PowerPoint file');
  }
  return path;
}

/** Whether PowerPoint must convert a file before it can be read. */
export function isLegacyPowerPoint(path: string): boolean {
  return extname(path).toLowerCase() === LEGACY_EXTENSION;
}

/**
 * Converts a private copy of a .ppt file, so PowerPoint never opens or locks
 * the original.
 */
export async function convertLegacyPowerPoint(
  original: string,
  {
    folder,
    converter,
    isStopped,
  }: {
    readonly folder: string;
    readonly converter: Pick<PowerPointImagesJob, 'run'>;
    readonly isStopped: () => boolean;
  },
): Promise<string> {
  const copy = join(folder, 'original.ppt');
  await copyFile(original, copy, fsConstants.COPYFILE_EXCL);
  if (isStopped()) throw new PowerPointError('convert', 'cancelled');
  const result = await converter.run(
    copy,
    folder,
    Object.assign(() => undefined, {convert: true as const}),
  );
  if (result !== 'ok') throw new PowerPointError('convert', result);
  const converted = join(folder, 'presentation.pptx');
  await stat(converted);
  await rm(copy, {force: true});
  return converted;
}

/** Why a PowerPoint file cannot be read now: another one is being read. */
export const POWERPOINT_BUSY = 'PowerPoint 파일을 읽는 중입니다.';

/** Says what went wrong with a file, or `fallback` when nothing is known. */
export function powerPointMessage(error: unknown, fallback: string): string {
  if (!(error instanceof PowerPointError)) return fallback;
  switch (error.reason) {
    case 'unavailable':
      return error.use === 'convert'
        ? '이 파일을 가져오려면 PowerPoint가 설치되어 있어야 합니다.'
        : 'PowerPoint가 설치되어 있지 않습니다.';
    case 'unresponsive':
      return 'PowerPoint가 응답하지 않습니다.';
    case 'ok':
    case 'file':
    case 'cancelled':
      return error.use === 'convert'
        ? 'PowerPoint 파일을 변환할 수 없습니다.'
        : fallback;
  }
}

/** Why the slides of a file that was read have the wrong shape, or `null`. */
export function unsupportedSlideSize(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('widescreen' in value)) {
    throw new Error('Invalid PowerPoint worker result');
  }
  if (value.widescreen === true) return null;
  if (
    value.widescreen !== false ||
    !('width' in value) ||
    typeof value.width !== 'number' ||
    !('height' in value) ||
    typeof value.height !== 'number' ||
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height) ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    throw new Error('Invalid PowerPoint slide size');
  }
  if (!isPowerPointFourThree(value.width, value.height)) return null;
  return '4:3 파일은 가져올 수 없습니다. PowerPoint에서 16:9로 바꿔 주세요.';
}
