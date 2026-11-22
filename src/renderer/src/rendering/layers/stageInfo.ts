import type {ScreenId} from '@core/schema/ids';
import type {LayerDefinition, RenderFrame} from '../layer';
import {stageClockText} from '../stageClock';
import {fillTimerTokens} from '../timerTokens';

const TICK_MS = 250;
const FONT = "'Pretendard Variable', sans-serif";

function corner(): HTMLElement {
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    fontFamily: FONT,
    fontWeight: '700',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: '1.2',
    whiteSpace: 'pre',
    transformOrigin: 'top left',
    // NOTE(0913vision): A picture behind them must not make them unreadable.
    padding: '0 12px',
    background: '#000000',
  });
  return box;
}

/** The clock of every 무대 화면 at its top left, and its 타이머 under it. */
export const stageInfoLayer: LayerDefinition = {
  kind: 'stage-info',
  create: parent => {
    const clock = corner();
    const timer = corner();
    Object.assign(clock.style, {color: '#E6E6E6', fontSize: '60px'});
    Object.assign(timer.style, {color: '#FFD66B', fontSize: '42px'});
    parent.append(clock, timer);
    let frame: RenderFrame | undefined;
    let screen: ScreenId | undefined;
    let ticker: ReturnType<typeof setInterval> | null = null;
    const write = (box: HTMLElement, text: string): void => {
      if (box.textContent !== text) box.textContent = text;
    };
    const draw = (): void => {
      const shown = frame?.screen?.kind === 'stage';
      clock.hidden = !shown;
      timer.hidden = !shown;
      if (!shown || frame === undefined) return;
      const now = frame.timers?.now();
      write(
        clock,
        stageClockText(now?.wall ?? Date.now(), '24h', {
          seconds: true,
          timeZone: now?.timeZone,
        }),
      );
      const left =
        frame.stageTimerId === undefined ||
        frame.timers === undefined ||
        now === undefined
          ? ''
          : fillTimerTokens(`{timer:${frame.stageTimerId}}`, frame.timers, now);
      write(timer, left);
      timer.hidden = left === '';
    };
    const follow = (): void => {
      const ticks = screen !== undefined && frame?.standby !== true;
      if (ticks && ticker === null) ticker = setInterval(draw, TICK_MS);
      else if (!ticks && ticker !== null) {
        clearInterval(ticker);
        ticker = null;
      }
    };
    return {
      render: (_layers, next) => {
        frame = next;
        screen = next?.screen?.kind === 'stage' ? next.screen.id : undefined;
        draw();
        follow();
      },
      rescale: scale => {
        clock.style.transform = `translate(${28 * scale}px, ${24 * scale}px) scale(${scale})`;
        timer.style.transform = `translate(${28 * scale}px, ${100 * scale}px) scale(${scale})`;
      },
      dispose: () => {
        if (ticker !== null) clearInterval(ticker);
        ticker = null;
        clock.remove();
        timer.remove();
      },
    };
  },
};
