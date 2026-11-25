import type {EventEmitter} from 'node:events';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PowerPointImagesJob,
  POWERPOINT_IMAGE_SCRIPT,
  POWERPOINT_IMAGE_CLEANUP_SCRIPT,
} from '@main/import/powerpoint/powerpointImages';

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

/**
 * The child spawned `index`-th, once the job has looked for a PowerPoint an
 * earlier run left behind and started its script.
 */
async function spawned(index: number) {
  for (let turn = 0; turn < 50 && mocks.children[index] === undefined; turn++) {
    await Promise.resolve();
  }
  const child = mocks.children[index];
  if (!child) throw new Error(`Missing child ${index}`);
  return child;
}

describe('PowerPoint image export', () => {
  it('opens a copied legacy presentation read-only and saves Open XML in the work directory', async () => {
    const job = new PowerPointImagesJob();
    const result = job.run(
      'temp/original.ppt',
      'temp',
      Object.assign(vi.fn(), {convert: true as const}),
    );
    const child = await spawned(0);
    const call: readonly unknown[] | undefined = mocks.spawn.mock.calls[0];
    expect(call?.[2]).toMatchObject({
      env: {
        LLP_PPT_SOURCE: 'temp/original.ppt',
        LLP_PPT_CONVERT: '1',
        LLP_PPT_DIRECTORY: 'temp',
      },
    });
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      "$presentation.SaveAs((Join-Path $env:LLP_PPT_DIRECTORY 'presentation.pptx'), 24)",
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      '$readOnly = if ($decorations) { 0 } else { -1 }',
    );
    child.emit('close', 0);
    expect(await result).toBe('ok');
  });
  it('uses the existing instance safely and exports only visible slides', () => {
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      "GetActiveObject('PowerPoint.Application')",
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      '$powerpoint.AutomationSecurity = 3',
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain('$powerpoint.DisplayAlerts = 1');
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      'Presentations.Open($env:LLP_PPT_SOURCE, $readOnly, 0, 0)',
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      'SlideShowTransition.Hidden -ne -1',
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      "$slide.Export($path, 'PNG', $exportWidth, $exportHeight)",
    );
    expect(POWERPOINT_IMAGE_SCRIPT).toContain(
      'if ($created) { $powerpoint.Quit() }',
    );
  });
  it('reports progress and failure without returning success', async () => {
    const job = new PowerPointImagesJob();
    const progress = vi.fn();
    const result = job.run('deck.pptm', 'temp', progress);
    const child = await spawned(0);
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
  it('exports decorations from an editable temporary presentation without saving it', async () => {
    const job = new PowerPointImagesJob();
    const progress = Object.assign(vi.fn(), {decorationSlide: 4});
    const result = job.run('temporary.pptx', 'temp', progress);
    const child = await spawned(0);
    expect(mocks.spawn).toHaveBeenCalledOnce();
    expect(POWERPOINT_IMAGE_SCRIPT).toContain('$env:LLP_PPT_DECORATION_SLIDE');
    expect(POWERPOINT_IMAGE_SCRIPT).toContain('Remove-SlideText $slide.Shapes');
    expect(POWERPOINT_IMAGE_SCRIPT).not.toContain('$presentation.Save(');
    child.emit('close', 0);
    expect(await result).toBe('ok');
  });
  it('exports multiple decoration slides in one PowerPoint job', async () => {
    const job = new PowerPointImagesJob();
    const progress = Object.assign(vi.fn(), {decorationSlides: [2, 8, 11]});
    const result = job.run('temporary.pptx', 'temp', progress);
    const child = await spawned(0);
    const call: readonly unknown[] | undefined = mocks.spawn.mock.calls[0];
    expect(call?.[2]).toMatchObject({
      env: {LLP_PPT_DECORATION_SLIDE: '2,8,11'},
    });
    child.stdout.emit('data', 'PROGRESS 2 3 8\n');
    expect(progress).toHaveBeenCalledWith(2, 3, 8);
    child.emit('close', 0);
    expect(await result).toBe('ok');
  });

  it('rejects duplicate or invalid decoration requests before starting PowerPoint', async () => {
    const job = new PowerPointImagesJob();
    const progress = Object.assign(vi.fn(), {decorationSlides: [2, 2]});
    expect(await job.run('temporary.pptx', 'temp', progress)).toBe('file');
    const empty = Object.assign(vi.fn(), {decorationSlides: []});
    expect(await job.run('temporary.pptx', 'temp', empty)).toBe('file');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it.each([
    ['FAILURE unavailable\n', 'unavailable'],
    ['FAILURE unresponsive\n', 'unresponsive'],
    ['', 'file'],
  ] as const)(
    'reports the PowerPoint failure marker %s',
    async (line, expected) => {
      const job = new PowerPointImagesJob();
      const result = job.run('temporary.pptx', 'temp', () => undefined);
      const child = await spawned(0);
      child.stdout.emit('data', line);
      child.emit('close', 1);
      expect(await result).toBe(expected);
    },
  );
  it('requests cooperative cleanup on cancel and kills a timed-out child', async () => {
    vi.useFakeTimers();
    const job = new PowerPointImagesJob();
    const cancelled = job.run('deck.pptx', 'temp', () => undefined);
    const first = await spawned(0);
    job.cancel();
    expect(mocks.writeFileSync).toHaveBeenCalledOnce();
    first.emit('close', 0);
    expect(await cancelled).toBe('cancelled');
    const timed = job.run('deck.pptx', 'temp', () => undefined);
    const second = await spawned(1);
    vi.advanceTimersByTime(120_000);
    expect(second.kill).toHaveBeenCalledOnce();
    second.emit('close', 1);
    const helper = await spawned(2);
    expect(mocks.spawn).toHaveBeenCalledTimes(3);
    expect(POWERPOINT_IMAGE_CLEANUP_SCRIPT).toContain(
      "Join-Path $env:LLP_PPT_DIRECTORY 'opening'",
    );
    expect(POWERPOINT_IMAGE_CLEANUP_SCRIPT).toContain(
      '$presentation.FullName, $env:LLP_PPT_SOURCE',
    );
    helper.emit('close', 0);
    expect(await timed).toBe('unresponsive');
  });
});
