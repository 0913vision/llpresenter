import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {analysisTokenFromUrl} from '@contracts/ipc/mediaUrls';
import type {PixelSize} from '@core/media/coverCrop';
import {
  THUMBNAIL_DATA_URL_PREFIX,
  type AnalysisJob,
} from '@core/schema/mediaAnalysis';
import {recordingLogger} from '../displays/testing';
import {AnalysisFiles} from './analysisFiles';
import {
  ANALYSIS_IDLE_CLOSE_MS,
  ANALYSIS_TIMEOUT_MS,
  MAX_QUEUED_ANALYSES,
  MediaAnalyser,
  THUMBNAIL_SIZE,
  type AnalysisPage,
  type MediaFacts,
} from './mediaAnalyser';

interface FakePage {
  readonly run: ReturnType<
    typeof vi.fn<(job: AnalysisJob) => Promise<unknown>>
  >;
  readonly close: ReturnType<typeof vi.fn<() => void>>;
}

function setup() {
  const pages: FakePage[] = [];
  const answers: {next: (job: AnalysisJob) => Promise<unknown>} = {
    next: () => Promise.resolve({ok: true, duration: 3}),
  };
  const openPage = vi.fn<(signal: AbortSignal) => Promise<AnalysisPage>>(() => {
    const page: FakePage = {
      run: vi.fn((job: AnalysisJob) => answers.next(job)),
      close: vi.fn(),
    };
    pages.push(page);
    return Promise.resolve(page);
  });
  const measureImage = vi.fn<
    (file: string, thumbnail: PixelSize | null) => MediaFacts | null
  >(() => null);
  const files = new AnalysisFiles();
  const log = recordingLogger();
  const analyser = new MediaAnalyser({openPage, files, measureImage, log});
  onTestFinished(() => {
    analyser.dispose();
  });
  return {analyser, pages, answers, openPage, measureImage, files, log};
}

function held() {
  let release: (value: unknown) => void = () => undefined;
  const promise = new Promise<unknown>(resolve => {
    release = resolve;
  });
  return {promise, release};
}

const VIDEO = {file: 'D:/media/a.mp4', kind: 'video', thumbnail: true} as const;

function expectFileGivenBack(files: AnalysisFiles): void {
  const loan = files.lend('D:/media/next.mp4');
  expect(loan).not.toBeNull();
  loan?.release();
}

describe('media analysis', () => {
  it('measures an image in main without opening the page', async () => {
    const {analyser, openPage, measureImage} = setup();
    measureImage.mockReturnValue({width: 400, height: 300});
    expect(
      await analyser.analyse({file: 'a.png', kind: 'image', thumbnail: true}),
    ).toEqual({kind: 'read', facts: {width: 400, height: 300}});
    expect(measureImage).toHaveBeenCalledWith('a.png', THUMBNAIL_SIZE);
    expect(openPage).not.toHaveBeenCalled();
  });

  it('reads a video in the page from a lent file and gives the file back', async () => {
    const {analyser, pages, answers, files} = setup();
    let token = '';
    answers.next = job => {
      token = analysisTokenFromUrl(job.url) ?? '';
      expect(files.fileOf(token)).toBe(VIDEO.file);
      return Promise.resolve({
        ok: true,
        duration: 3,
        width: 640,
        height: 360,
        thumbnail: `${THUMBNAIL_DATA_URL_PREFIX}AAEC`,
      });
    };
    expect(await analyser.analyse(VIDEO)).toEqual({
      kind: 'read',
      facts: {
        duration: 3,
        width: 640,
        height: 360,
        thumbnail: Buffer.from([0, 1, 2]),
      },
    });
    const job = pages[0]?.run.mock.calls[0]?.[0];
    expect(job?.url.startsWith('llp-media://analysis/')).toBe(true);
    expect(job).toMatchObject({kind: 'video', thumbnail: THUMBNAIL_SIZE});
    expect(files.fileOf(token)).toBeNull();
  });

  it('sends an image that main cannot read, or that throws, to the page', async () => {
    const {analyser, pages, measureImage, log} = setup();
    await analyser.analyse({file: 'a.webp', kind: 'image', thumbnail: false});
    measureImage.mockImplementation(() => {
      throw new Error('Invented decoder failure');
    });
    await analyser.analyse({file: 'b.gif', kind: 'image', thumbnail: false});
    expect(pages[0]?.run.mock.calls.map(([job]) => job.kind)).toEqual([
      'image',
      'image',
    ]);
    expect(log.messages('warn')).toEqual(['could not measure an image']);
  });

  it("answers the decoder's refusal as a file that can't play", async () => {
    const {analyser, answers} = setup();
    answers.next = () =>
      Promise.resolve({ok: false, reason: 'unsupported', message: 'Invented'});
    expect(await analyser.analyse(VIDEO)).toEqual({
      kind: 'cant-play',
      reason: 'unsupported',
      message: 'Invented',
    });
  });

  it('reads one file at a time, in order', async () => {
    const {analyser, pages, answers} = setup();
    const first = held();
    answers.next = () => first.promise;
    const one = analyser.analyse(VIDEO);
    const two = analyser.analyse({...VIDEO, file: 'D:/media/b.mp4'});
    await vi.waitFor(() => expect(pages[0]?.run).toHaveBeenCalledOnce());
    answers.next = () => Promise.resolve({ok: true});
    first.release({ok: true, duration: 1});
    expect(await one).toMatchObject({facts: {duration: 1}});
    expect(await two).toEqual({kind: 'read', facts: {}});
    expect(pages).toHaveLength(1);
    expect(pages[0]?.run).toHaveBeenCalledTimes(2);
  });

  it('closes the page after the idle time and opens a new one when needed', async () => {
    const clock = installFakeClock();
    const {analyser, pages, openPage} = setup();
    await analyser.analyse(VIDEO);
    await clock.advance(ANALYSIS_IDLE_CLOSE_MS - 1);
    expect(pages[0]?.close).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(pages[0]?.close).toHaveBeenCalledOnce();
    expect(openPage.mock.calls[0]?.[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await analyser.analyse(VIDEO);
    expect(openPage).toHaveBeenCalledTimes(2);
  });

  it('closes the page on dispose and answers the running and waiting files', async () => {
    const {analyser, pages, answers} = setup();
    answers.next = () => new Promise(() => undefined);
    const running = analyser.analyse(VIDEO);
    const waiting = analyser.analyse(VIDEO);
    await vi.waitFor(() => expect(pages[0]?.run).toHaveBeenCalledOnce());
    analyser.dispose();
    const closed = {kind: 'unavailable', message: 'Media analysis is closed'};
    expect(await running).toEqual(closed);
    expect(await waiting).toEqual(closed);
    expect(pages[0]?.close).toHaveBeenCalledOnce();
    expect(await analyser.analyse(VIDEO)).toEqual(closed);
  });

  it('closes a page that takes too long and goes on with a new one', async () => {
    const clock = installFakeClock();
    const {analyser, pages, answers, log} = setup();
    answers.next = () => new Promise(() => undefined);
    const stuck = analyser.analyse(VIDEO);
    await clock.advance(ANALYSIS_TIMEOUT_MS);
    expect(await stuck).toEqual({
      kind: 'unavailable',
      message: 'The analysis timed out',
    });
    expect(pages[0]?.close).toHaveBeenCalledOnce();
    expect(log.messages('warn')).toEqual(['media analysis timed out']);
    answers.next = () => Promise.resolve({ok: true});
    expect(await analyser.analyse(VIDEO)).toMatchObject({kind: 'read'});
    expect(pages).toHaveLength(2);
  });

  it('answers a malformed reply, a failed run, and a page that cannot open as unavailable', async () => {
    const {analyser, pages, answers, openPage, log} = setup();
    answers.next = () => Promise.resolve({ok: 'yes'});
    expect(await analyser.analyse(VIDEO)).toMatchObject({kind: 'unavailable'});
    answers.next = () => Promise.reject(new Error('Invented page crash'));
    expect(await analyser.analyse(VIDEO)).toMatchObject({kind: 'unavailable'});
    expect(pages[0]?.close).toHaveBeenCalledOnce();
    openPage.mockRejectedValueOnce(new Error('Invented load failure'));
    expect(await analyser.analyse(VIDEO)).toMatchObject({kind: 'unavailable'});
    answers.next = () => Promise.resolve({ok: true});
    expect(await analyser.analyse(VIDEO)).toMatchObject({kind: 'read'});
    expect(log.messages('warn')).toEqual([
      'dropped a malformed analysis reply',
      'media analysis failed',
      'media analysis failed',
    ]);
  });

  it('stops waiting for a cancelled file and never reads it', async () => {
    const {analyser, pages, answers} = setup();
    const first = held();
    answers.next = () => first.promise;
    const running = analyser.analyse(VIDEO);
    const abort = new AbortController();
    const waiting = analyser.analyse({...VIDEO, signal: abort.signal});
    abort.abort();
    expect(await waiting).toEqual({
      kind: 'unavailable',
      message: 'The analysis was cancelled',
    });
    first.release({ok: true});
    await running;
    expect(pages[0]?.run).toHaveBeenCalledOnce();
    const aborted = new AbortController();
    aborted.abort();
    expect(
      await analyser.analyse({...VIDEO, signal: aborted.signal}),
    ).toMatchObject({kind: 'unavailable'});
  });

  it('refuses a file past the queue cap', async () => {
    const {analyser, answers} = setup();
    answers.next = () => new Promise(() => undefined);
    const running = analyser.analyse(VIDEO);
    const waiting = Array.from({length: MAX_QUEUED_ANALYSES}, () =>
      analyser.analyse(VIDEO),
    );
    expect(waiting).toHaveLength(MAX_QUEUED_ANALYSES);
    expect(await analyser.analyse(VIDEO)).toEqual({
      kind: 'unavailable',
      message: 'Too many files wait for analysis',
    });
    analyser.dispose();
    expect(await running).toMatchObject({kind: 'unavailable'});
  });

  it('times out a page that never opens and opens a new one for the next file', async () => {
    const clock = installFakeClock();
    const {analyser, openPage, files, log} = setup();
    openPage.mockImplementationOnce(() => new Promise(() => undefined));
    const stuck = analyser.analyse(VIDEO);
    await clock.advance(ANALYSIS_TIMEOUT_MS);
    expect(openPage.mock.calls[0]?.[0].aborted).toBe(true);
    expect(await stuck).toEqual({
      kind: 'unavailable',
      message: 'The analysis timed out',
    });
    expect(log.messages('warn')).toEqual(['media analysis timed out']);
    expectFileGivenBack(files);
    expect(await analyser.analyse(VIDEO)).toMatchObject({kind: 'read'});
    expect(openPage).toHaveBeenCalledTimes(2);
  });

  it('on disposal while the page opens, gives the file back and never runs the page', async () => {
    const clock = installFakeClock();
    const files = new AnalysisFiles();
    const page = {run: vi.fn<AnalysisPage['run']>(), close: vi.fn()};
    let open: (opened: AnalysisPage) => void = () => undefined;
    let opening = new AbortController().signal;
    const analyser = new MediaAnalyser({
      openPage: signal => {
        opening = signal;
        return new Promise<AnalysisPage>(resolve => {
          open = resolve;
        });
      },
      files,
      measureImage: () => null,
      log: recordingLogger(),
    });
    const result = analyser.analyse(VIDEO);
    await clock.advance(1);
    analyser.dispose();
    expect(await result).toEqual({
      kind: 'unavailable',
      message: 'Media analysis is closed',
    });
    await clock.advance(0);
    expect(opening.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expectFileGivenBack(files);
    open(page);
    await clock.advance(1);
    expect(page.run).not.toHaveBeenCalled();
    expect(page.close).toHaveBeenCalledOnce();
  });

  it('on disposal while the page runs, clears the deadline and gives the file back', async () => {
    const clock = installFakeClock();
    const {analyser, answers, files} = setup();
    answers.next = () => new Promise(() => undefined);
    const result = analyser.analyse(VIDEO);
    await clock.advance(1);
    analyser.dispose();
    expect(await result).toMatchObject({kind: 'unavailable'});
    await clock.advance(1);
    expect(vi.getTimerCount()).toBe(0);
    expectFileGivenBack(files);
  });

  it('closes a page that opens after its analysis timed out without running it, while the next file goes on', async () => {
    const clock = installFakeClock();
    const {analyser, openPage, pages} = setup();
    const late = {run: vi.fn<AnalysisPage['run']>(), close: vi.fn()};
    let open: (page: AnalysisPage) => void = () => undefined;
    openPage.mockImplementationOnce(
      () =>
        new Promise<AnalysisPage>(resolve => {
          open = resolve;
        }),
    );
    const stuck = analyser.analyse(VIDEO);
    await clock.advance(ANALYSIS_TIMEOUT_MS);
    expect(await stuck).toMatchObject({message: 'The analysis timed out'});
    const next = analyser.analyse(VIDEO);
    open(late);
    expect(await next).toMatchObject({kind: 'read'});
    await clock.advance(0);
    expect(late.run).not.toHaveBeenCalled();
    expect(late.close).toHaveBeenCalledOnce();
    expect(pages[0]?.run).toHaveBeenCalledOnce();
  });
});
