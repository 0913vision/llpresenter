import {describe, expect, it} from 'vitest';
import type {MonitorList} from '@shared/schema/monitors';
import {previewCaption, signalText} from './previewCaption';
import {
  CAPTIONS_ID,
  MAIN_ID,
  STAGE_ID,
  screensDocument,
} from './testing/documents';

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value.screens;
}

function caption(id: string, monitors: MonitorList) {
  const screen = screens().find(candidate => candidate.id === id);
  if (screen === undefined) throw new Error(`Missing screen ${id}`);
  return previewCaption(screen, monitors);
}

const projector: MonitorList[number] = {
  number: 2,
  name: 'EPSON 프로젝터',
  bounds: {x: 1920, y: 0, width: 1920, height: 1080},
  scaleFactor: 1,
  refreshRate: 59.94,
  hasMainWindow: false,
  screenIds: [MAIN_ID],
};

describe('previewCaption', () => {
  it('shows the monitor number and name, the resolution, and the refresh rate', () => {
    const result = caption(MAIN_ID, [projector]);

    expect(result).toEqual({
      name: '본 화면',
      target: '모니터 2 EPSON 프로젝터',
      resolution: '1920×1080',
      refreshRate: '60Hz',
    });
    expect(signalText(result)).toBe('1920×1080 60Hz');
  });

  it('shows the resolution in device pixels and no rate when the system gives none', () => {
    const result = caption(MAIN_ID, [
      {...projector, scaleFactor: 2, refreshRate: 0},
    ]);

    expect(signalText(result)).toBe('3840×2160');
  });

  it('keeps the saved monitor name and no size while the monitor is gone', () => {
    const result = caption(MAIN_ID, []);

    expect(result.target).toBe('모니터 2 Projector');
    expect(signalText(result)).toBe('');
  });

  it('shows the unassigned target for a full screen without a monitor', () => {
    expect(caption(STAGE_ID, [projector]).target).toBe('모니터 미지정');
  });

  it('shows a capture window with its default size and no refresh rate', () => {
    const result = caption(CAPTIONS_ID, [projector]);

    expect(result.target).toBe('캡처용 창');
    expect(signalText(result)).toBe('1920×1080');
  });
});
