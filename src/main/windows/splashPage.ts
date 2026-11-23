import {launchFraction} from '@core/app';
import icon from '../../../build/icon-small.svg?raw';

const STYLE = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #fff;
    font-family: Pretendard, "Malgun Gothic", sans-serif;
    background: linear-gradient(135deg, #172f51, #24548d);
    user-select: none;
  }
  main {
    height: 240px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 38px;
  }
  svg { width: 104px; height: 104px; }
  h1 { margin: 8px 0 0; font-size: 29px; font-weight: 700; letter-spacing: -.5px; }
  footer { width: 100%; margin-top: 18px; font-size: 13px; color: #e1eaf6; }
  .says { display: flex; justify-content: space-between; }
  .percent { font-variant-numeric: tabular-nums; }
  .failed { color: #ffd479; }
  .track { height: 4px; margin-top: 10px; background: #ffffff42; overflow: hidden; }
  .bar { height: 100%; background: #fff; transform: scaleX(0); transform-origin: 0 50%; }
`;

/**
 * The bar keeps moving in the page itself, so it goes on while main is busy.
 * Main only tells what began, advanced, and ended.
 */
const SCRIPT = `
  const fractionOf = ${launchFraction.toString()};
  // A picture that comes late moves the bar no further than one in time.
  const LONGEST_STEP = 34;
  const launch = (() => {
    const find = name => document.querySelector(name);
    const bar = find('.bar'), track = find('.track');
    const says = find('#status'), percent = find('.percent');
    let start = performance.now(), drawn = start, shown = 0, tasks = [];
    const taskOf = id => tasks.find(task => task.id === id);
    const draw = now => {
      const {fraction, current} = fractionOf(tasks, now - start);
      const passed = Math.min(now - drawn, LONGEST_STEP);
      drawn = now;
      if (tasks.length > 0) {
        shown = Math.max(shown, shown + (fraction - shown) * (1 - Math.exp(-passed / 120)));
      }
      const full = Math.floor(shown * 100);
      bar.style.transform = 'scaleX(' + shown.toFixed(4) + ')';
      track.setAttribute('aria-valuenow', String(full));
      percent.textContent = full + '%';
      const failed = tasks.filter(task => task.failed);
      const task = tasks[current];
      const counted = task !== undefined && task.total > 1 ? ' ' + task.done + '/' + task.total : '';
      says.className = failed.length > 0 ? 'failed' : '';
      if (failed.length > 0) says.textContent = failed[failed.length - 1].name + ' 준비 실패';
      else if (task !== undefined) says.textContent = task.label + counted;
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    return {
      begin(plan) {
        start = performance.now() - plan.elapsed;
        tasks = plan.tasks.map(task => ({...task, done: 0, total: 0, ended: null, failed: false}));
      },
      advance(id, done, total) {
        const task = taskOf(id);
        if (task !== undefined) Object.assign(task, {done, total});
      },
      end(id, failed) {
        const task = taskOf(id);
        if (task !== undefined) Object.assign(task, {ended: performance.now() - start, failed});
      },
    };
  })();
  window.launch = launch;
`;

/** The page of the launch window. */
export function splashHtml(): string {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${STYLE}</style>
<main>${icon}<h1>LoveLight Presenter</h1>
<footer><div class="says"><span id="status">시작하는 중</span><span class="percent">0%</span></div>
<div class="track" role="progressbar" aria-label="시작 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="bar"></div></div></footer>
</main><script>${SCRIPT}</script></html>`;
}
