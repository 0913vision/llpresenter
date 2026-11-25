import {expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {PowerPointExportScope} from '@main/import/powerpoint/powerpointExportScope';
import {PowerPointTurns} from '@main/import/powerpoint/powerpointTurns';

function pictures() {
  return {
    openFolder: vi.fn(() => Promise.resolve('C:/temp/llp-ppt-1')),
    closeFolder: vi.fn(() => Promise.resolve()),
  };
}

function options(folders = pictures()) {
  return {
    turns: new PowerPointTurns(),
    pictures: folders,
    log: recordingLogger(),
  };
}

it('holds the turn and its folder, and frees both when it is left', async () => {
  const folders = pictures();
  const used = options(folders);
  {
    await using scope = await PowerPointExportScope.take(used);
    expect(scope).not.toBeNull();
    expect(used.turns.isExporting).toBe(true);
    expect(await scope?.folder()).toBe('C:/temp/llp-ppt-1');
    expect(await scope?.folder()).toBe('C:/temp/llp-ppt-1');
  }
  expect(folders.openFolder).toHaveBeenCalledOnce();
  expect(folders.closeFolder).toHaveBeenCalledWith('C:/temp/llp-ppt-1');
  expect(used.turns.isExporting).toBe(false);
});

it('is not given while another export holds the turn', async () => {
  const used = options();
  await using first = await PowerPointExportScope.take(used);
  expect(first).not.toBeNull();
  expect(await PowerPointExportScope.take(used)).toBeNull();
});

it('keeps the turn until PowerPoint has closed, then removes the folder', async () => {
  const folders = pictures();
  const used = options(folders);
  let close: () => void = () => undefined;
  {
    await using scope = await PowerPointExportScope.take(used);
    await scope?.folder();
    scope?.closeAfter(new Promise<void>(resolve => (close = resolve)));
  }
  expect(used.turns.isExporting).toBe(true);
  expect(folders.closeFolder).not.toHaveBeenCalled();
  close();
  await used.turns.lastExport();
  expect(folders.closeFolder).toHaveBeenCalledOnce();
  expect(used.turns.isExporting).toBe(false);
});
