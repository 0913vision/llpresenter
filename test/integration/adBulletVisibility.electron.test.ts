import {expect, it} from 'vitest';
import {offscreenApp} from '../ui/electron-app';

it(
  'keeps an incoming ad bullet hidden until its output is revealed',
  {timeout: 240000},
  async () => {
    const app = await offscreenApp();
    const control = await app.start();
    const screenId = '00000000-0000-4000-8000-000000000001';
    const slide = {
      itemId: '55000000-0000-4000-8000-000000000003',
      position: 0,
      label: null,
      kind: 'ad',
      title: 'Notice',
      lines: ['First paragraph', 'Second paragraph'],
    };
    await control.evaluate(
      `window.llp.live.send({type:'slide.show',slide:${JSON.stringify(slide)}})`,
    );
    await control.evaluate(
      `window.llp.live.send({type:'theme.set',themeId:'00000000-0000-4000-8000-000000000105'})`,
    );
    await expect
      .poll(
        () =>
          control.evaluate(
            `window.llp.live.get().then(s=>s.themeOutput?.themeId)`,
          ),
        {timeout: 30000},
      )
      .toBe('00000000-0000-4000-8000-000000000105');
    await control.evaluate(
      `window.llp.live.send({type:'output.set',screenId:'${screenId}',on:true})`,
    );
    await expect
      .poll(
        () =>
          app
            .electron()
            .windows()
            .some(
              window =>
                window.url().includes('output.html') &&
                window.url().includes(screenId),
            ),
        {timeout: 30000},
      )
      .toBe(true);
    const output = app
      .electron()
      .windows()
      .find(
        window =>
          window.url().includes('output.html') &&
          window.url().includes(screenId),
      );
    if (!output) throw Error('Missing audience output');
    await expect
      .poll(() => output.locator('[class*="_marker_"]').count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    const visibility = async (hidden: boolean, disc: boolean) =>
      output.evaluate(`(() => {
    const marker = document.querySelector('[class*="_marker_"]');
    const root = marker.closest('#root > div');
    const block = marker.closest('[class*="_block_"]');
    root.style.visibility = ${JSON.stringify(hidden ? 'hidden' : '')};
    block.style.setProperty('--bullet-visibility', ${JSON.stringify(disc ? 'hidden' : 'inherit')});
    block.style.setProperty('--bullet-disc-content', ${JSON.stringify(disc ? '""' : 'none')});
    return {
      marker: getComputedStyle(marker).visibility,
      glyph: getComputedStyle(marker.firstElementChild).visibility,
      disc: getComputedStyle(marker, '::before').visibility,
    };
  })()`);
    expect(await visibility(true, true)).toEqual({
      marker: 'hidden',
      glyph: 'hidden',
      disc: 'hidden',
    });
    expect(await visibility(false, true)).toEqual({
      marker: 'visible',
      glyph: 'hidden',
      disc: 'visible',
    });
    expect(await visibility(true, false)).toEqual({
      marker: 'hidden',
      glyph: 'hidden',
      disc: 'hidden',
    });
    expect(await visibility(false, false)).toEqual({
      marker: 'visible',
      glyph: 'visible',
      disc: 'visible',
    });
  },
);
