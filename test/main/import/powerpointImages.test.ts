import type {EventEmitter} from 'node:events';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PowerPointImagesJob,
  POWERPOINT_IMAGE_SCRIPT,
  POWERPOINT_IMAGE_CLEANUP_SCRIPT,
} from '@main/import/powerpointImages';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  const children: Array<
    EventEmitter & {
      stdout: EventEmitter & {setEncoding: () => void};
      kill: ReturnType<typeof vi.fn>;
    }
  > = [];
  const spawn = vi.fn(() => {
    const stdout = Object.assign(new EventEmitter(), {setEncoding: vi.fn()});
    const child = Object.assign(new EventEmitter(), {stdout, kill: vi.fn()});
    children.push(child);
    return child;
  });
  return {spawn, children, writeFileSync: vi.fn()};
});
vi.mock('node:child_process', () => ({spawn: mocks.spawn}));
vi.mock('node:fs', () => ({writeFileSync: mocks.writeFileSync}));
afterEach(() => {
  vi.useRealTimers();
  mocks.children.length = 0;
  vi.clearAllMocks();
});

describe('PowerPoint image export', () => {
  it('uses the existing instance safely and exports only visible slides', () => {
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      "GetActiveObject('PowerPoint.Application')",
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      '$powerpoint.AutomationSecurity = 3',
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain('$powerpoint.DisplayAlerts = 1');
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      'Presentations.Open($env:LLP_PPT_SOURCE, -1, 0, 0)',
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      'SlideShowTransition.Hidden -ne -1',
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      "$slide.Export($path, 'PNG', 1920, 1080)",
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      'if ($created) { $powerpoint.Quit() }',
    );
  });
  it('reports progress and failure without returning success', async () => {
    const job = new PowerPointImagesJob();
    const progress = vi.fn();
    const result = job.run('deck.pptm', 'temp', progress);
    const child = mocks.children[0];
    if (!child) throw new Error('Missing child');
    expect(mocks.spawn).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining([
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
      ]),
      expect.objectContaining({windowsHide: true}),
    );
    child.stdout.emit('data', 'PROGRESS 1 2 3\n');
    expect(progress).toHaveBeenCalledWith(1, 2, 3);
    child.emit('close', 1);
    expect(await result).toBe('file');
  });
  it.each([
    ['FAILURE unavailable\n', 'unavailable'],
    ['FAILURE unresponsive\n', 'unresponsive'],
    ['', 'file'],
  ] as const)(
    'reports the PowerPoint failure marker %s',
    async (line, expected) => {
      const job = new PowerPointImagesJob();
      const result = job.run('temporary.pptx', 'temp', vi.fn());
      const child = mocks.children[0];
      if (!child) throw new Error('Missing child');
      child.stdout.emit('data', line);
      child.emit('close', 1);
      expect(await result).toBe(expected);
    },
  );
  it('requests cooperative cleanup on cancel and kills a timed-out child', async () => {
    vi.useFakeTimers();
    const job = new PowerPointImagesJob();
    const cancelled = job.run('deck.pptx', 'temp', vi.fn());
    const first = mocks.children[0];
    if (!first) throw new Error('Missing child');
    job.cancel();
    expect(mocks.writeFileSync).toHaveBeenCalledOnce();
    first.emit('close', 0);
    expect(await cancelled).toBe('cancelled');
    const timed = job.run('deck.pptx', 'temp', vi.fn());
    const second = mocks.children[1];
    if (!second) throw new Error('Missing child');
    vi.advanceTimersByTime(120_000);
    expect(second.kill).toHaveBeenCalledOnce();
    second.emit('close', 1);
    const helper = mocks.children[2];
    if (!helper) throw new Error('Missing cleanup helper');
    expect(mocks.spawn).toHaveBeenCalledTimes(3);
    expect(POWERPOINT_IMAGE_CLEANUP_SCRIPT).toContain(
      "Join-Path $env:LLP_PPT_DIRECTORY 'opening'",
    );
    expect(POWERPOINT_IMAGE_CLEANUP_SCRIPT).toContain(
      '$presentation.FullName, $env:LLP_PPT_SOURCE',
    );
    expect(POWERPOINT_IMAGE_CLEANUP_SCRIPT).toContain(
      "Join-Path $env:LLP_PPT_DIRECTORY 'created'",
    );
    helper.emit('close', 0);
    expect(await timed).toBe('unresponsive');
  });
});
