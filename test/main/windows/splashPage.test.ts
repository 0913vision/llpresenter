import {createContext, runInContext} from 'node:vm';
import {describe, expect, it} from 'vitest';
import type {LaunchPlan} from '@main/windows/splash';
import {splashHtml} from '@main/windows/splashPage';

interface LaunchPage {
  begin(plan: LaunchPlan): void;
  advance(id: string, done: number, total: number): void;
  end(id: string, failed: boolean): void;
}

interface FakeElement {
  style: {transform: string};
  textContent: string;
  className: string;
  setAttribute(): void;
}

const FRAME_MS = 16;
const PLAN: LaunchPlan = {
  elapsed: 0,
  tasks: [
    {
      id: 'files',
      label: '곡과 예배 파일 읽는 중',
      name: '곡과 예배 파일',
      endsAt: 400,
      counted: true,
    },
    {
      id: 'page',
      label: '프로그램 화면 불러오는 중',
      name: '프로그램 화면',
      endsAt: 500,
      counted: false,
    },
    {
      id: 'pictures',
      label: '슬라이드 배경 그림 불러오는 중',
      name: '슬라이드 배경 그림',
      endsAt: 1000,
      counted: true,
    },
  ],
};

/** Runs the script of the page without a window. */
function open() {
  const script = /<script>([\s\S]*)<\/script>/.exec(splashHtml())?.[1] ?? '';
  const elements = new Map<string, FakeElement>();
  const find = (name: string): FakeElement => {
    const found = elements.get(name) ?? {
      style: {transform: ''},
      textContent: '',
      className: '',
      setAttribute: () => undefined,
    };
    elements.set(name, found);
    return found;
  };
  let now = 0;
  let frame: (time: number) => void = () => undefined;
  const window: {launch?: LaunchPage} = {};
  runInContext(
    script,
    createContext({
      window,
      document: {querySelector: find},
      performance: {now: () => now},
      requestAnimationFrame: (callback: typeof frame) => {
        frame = callback;
      },
    }),
  );
  const {launch} = window;
  if (launch === undefined) throw new Error('The page has no launch');
  launch.begin(PLAN);
  return {
    launch,
    /** Draws for so long, and gives how full the bar is after each picture. */
    draw: (ms: number): readonly number[] => {
      const shown: number[] = [];
      for (const end = now + ms; now < end;) {
        now += FRAME_MS;
        frame(now);
        shown.push(Number.parseFloat(find('.bar').style.transform.slice(7)));
      }
      return shown;
    },
    says: () => find('#status').textContent,
  };
}

describe('the page of the launch window', () => {
  it('moves on with every picture, and never back', () => {
    const {launch, draw} = open();
    const shown = [...draw(500)];
    launch.end('files', false);
    shown.push(...draw(800));
    launch.end('page', false);
    launch.end('pictures', false);
    shown.push(...draw(1200));
    for (const [index, value] of shown.entries()) {
      if (index === 0) continue;
      const before = shown[index - 1] ?? 0;
      expect(value).toBeGreaterThanOrEqual(before);
      expect(value - before).toBeLessThan(0.1);
    }
    expect(shown.at(-1)).toBeGreaterThan(0.99);
  });

  it('never leaves the part of a task that still runs', () => {
    const {draw, says} = open();
    expect(draw(5000).at(-1)).toBeLessThan(0.4);
    expect(says()).toBe('곡과 예배 파일 읽는 중');
  });

  it('counts the parts of the task that runs', () => {
    const {launch, draw, says} = open();
    launch.advance('files', 12, 38);
    draw(FRAME_MS);
    expect(says()).toBe('곡과 예배 파일 읽는 중 12/38');
    launch.end('files', false);
    launch.end('page', false);
    draw(FRAME_MS);
    expect(says()).toBe('슬라이드 배경 그림 불러오는 중');
  });

  it('says what failed, and goes on', () => {
    const {launch, draw, says} = open();
    launch.end('files', true);
    const shown = draw(600);
    expect(says()).toBe('곡과 예배 파일 준비 실패');
    expect(shown.at(-1)).toBeGreaterThan(0.4);
  });

  it('shows no count for a task whose parts are steps', () => {
    const {launch, draw, says} = open();
    launch.end('files', false);
    launch.advance('page', 1, 3);
    draw(FRAME_MS);
    expect(says()).toBe('프로그램 화면 불러오는 중');
  });
});
