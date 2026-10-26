const assert = require('node:assert/strict');
const {Buffer} = require('node:buffer');
const console = require('node:console');
const fs = require('node:fs');
const path = require('node:path');
const {setTimeout} = require('node:timers');

module.exports = async ({win, send, evaluate, assets, report}) => {
  const wait = async (read, accept, label) => {
    let value;
    for (let step = 0; step < 500; step += 1) {
      value = await read();
      if (accept(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(`${label}: ${JSON.stringify(value)}`);
  };
  const click = async (role, name) => {
    const r = await evaluate(`(() => {
      const node = [...document.querySelectorAll('[role="${role}"]${role === 'button' ? ',button' : ''}')]
        .find(item => (item.getAttribute('aria-label') ?? item.textContent).trim() === ${JSON.stringify(name)});
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
    })()`);
    assert.ok(r, name);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', {
        type,
        ...r,
        button: 'left',
        clickCount: 1,
      });
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  };
  const measure = () =>
    evaluate(`(() => {
    const main=document.querySelector('main');
    const bin=main.querySelector('section[aria-label="\uBBF8\uB514\uC5B4 \uBCF4\uAD00\uD568"]');
    const rect=node=>{if(!node)return null; const r=node.getBoundingClientRect();return{x:r.x,y:r.y,height:r.height,width:r.width,bottom:r.bottom};};
    return {viewport:{width:innerWidth,height:innerHeight},main:rect(main),
      upper:rect(main.firstElementChild),bin:rect(bin),leftPanels:[...main.firstElementChild.firstElementChild.children].map(rect),rightPanels:[...main.firstElementChild.lastElementChild.children].map(rect),clientHeight:main.clientHeight,
      scrollHeight:main.scrollHeight,scrollTop:main.scrollTop,
      appScrollTop:main.parentElement.scrollTop,overflowY:getComputedStyle(main).overflowY};
  })()`);
  const check = async (label, screenshot) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const value = await measure();
    console.log('HEIGHT CASE', label, JSON.stringify(value));
    assert.ok(value.bin, 'saved-open bin stays visible');
    if (value.viewport.width === 1280 && value.viewport.height === 720) {
      assert.equal(value.upper.height, 440, 'M3-C4-4 upper workspace');
      assert.equal(value.bin.height, 178, 'M3-C4-4 media bin');
    }
    const expected =
      value.clientHeight >= 612
        ? Math.min(300, 0.4 * value.clientHeight, value.clientHeight - 444)
        : 168;
    assert.ok(
      value.upper.height >= 439,
      'upper workspace must preserve 440 CSS pixels',
    );
    assert.ok(
      Math.abs(value.bin.height - expected) < 2,
      'bin follows the bounded allocation',
    );
    assert.equal(
      value.appScrollTop,
      0,
      'bars stay outside work-area scrolling',
    );
    if (label.includes('Show')) {
      assert.ok(
        value.rightPanels[2].height >= 239,
        'Show Tools keep their 240px minimum',
      );
      assert.ok(
        value.rightPanels[0].height >= 123,
        'workspace preview remains usable',
      );
      assert.ok(
        value.rightPanels.every(
          panel =>
            panel.y >= value.upper.y - 1 &&
            panel.bottom <= value.upper.bottom + 1,
        ),
        'right panels remain inside the upper row',
      );
    }
    if (value.clientHeight >= 612) {
      assert.ok(
        value.scrollHeight <= value.clientHeight + 2,
        'no unnecessary outer scroll',
      );
    } else {
      assert.ok(
        value.scrollHeight >= 612,
        'both minimum rows remain reachable',
      );
      assert.equal(value.overflowY, 'auto');
    }
    (report.heightCases ??= []).push({label, ...value});
    if (screenshot) {
      const shot = await send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(
        path.join(assets, screenshot),
        Buffer.from(shot.data, 'base64'),
      );
    }
    return value;
  };
  await evaluate(`window.llp.ui.changeZoom({type:'ui.zoomReset'})`);
  await wait(
    () => evaluate('window.llp.ui.getZoom()'),
    value => value === 100,
    '100 percent zoom',
  );
  const devicePixelRatio = await evaluate('devicePixelRatio');
  assert.equal(devicePixelRatio, 1, 'M3-C4-4 DPR');
  report.qaAcceptance = {
    finding: 'M3-C4-4',
    zoomPercent: 100,
    devicePixelRatio,
  };
  win.setSize(1280, 720);
  await wait(
    () => measure(),
    value => value.viewport.width === 1280 && value.viewport.height === 720,
    'minimum viewport',
  );
  await check('saved-open, minimum Show', 'minimum-show.png');
  for (let round = 0; round < 2; round += 1) {
    await click('button', '\uBBF8\uB514\uC5B4');
    const closed = await wait(
      measure,
      value => value.bin === null,
      'minimum bin hidden',
    );
    assert.ok(
      Math.abs(closed.upper.height - closed.clientHeight) < 2,
      'closed bin releases its row',
    );
    await click('button', '\uBBF8\uB514\uC5B4');
    await check('minimum Show reopened');
  }
  await click('tab', '\uC900\uBE44');
  await check('minimum Prep', 'minimum-prep.png');
  await click('option', 'Dawn loop');
  const scrollTarget = await evaluate(`(()=>{
    const panel=document.querySelector('section[aria-label="\uBBF8\uB514\uC5B4 \uBCF4\uAD00\uD568"] section[aria-label="\uC18D\uC131"]');
    const port=[...panel.querySelectorAll('*')].find(n=>n.clientHeight>0&&n.scrollHeight>n.clientHeight+1&&getComputedStyle(n).overflowY==='auto');
    if(!port)return null;const r=port.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  assert.ok(scrollTarget, 'properties have an internal scroll body');
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    ...scrollTarget,
    deltaX: 0,
    deltaY: 500,
  });
  await wait(
    () =>
      evaluate(
        `(()=>{const p=document.querySelector('section[aria-label="\uBBF8\uB514\uC5B4 \uBCF4\uAD00\uD568"] section[aria-label="\uC18D\uC131"]');return [...p.querySelectorAll('*')].some(n=>n.scrollTop>0);})()`,
      ),
    Boolean,
    'properties scroll independently',
  );
  await check(
    'minimum Prep, properties scrolled',
    'minimum-prep-properties.png',
  );
  await evaluate(
    `window.llp.ui.changeZoom({type:'ui.zoomIn'}).then(()=>window.llp.ui.changeZoom({type:'ui.zoomIn'}))`,
  );
  await wait(
    () => evaluate('window.llp.ui.getZoom()'),
    value => value === 120,
    '120 percent zoom',
  );
  const small = await check('minimum window at 120 percent', 'zoom-top.png');
  const x = small.main.x + 2;
  const y = small.main.y + 20;
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x,
    y,
    deltaX: 0,
    deltaY: 400,
  });
  await wait(
    () => measure(),
    value => value.scrollTop > 0,
    'work-area wheel scroll',
  );
  const scrolled = await check('zoomed, scrolled to bin', 'zoom-bin.png');
  assert.equal(scrolled.main.y, small.main.y, 'toolbar stays fixed');
  assert.ok(
    scrolled.bin.bottom <= scrolled.main.bottom + 1,
    'bin controls are reachable',
  );
  await evaluate(`window.llp.ui.changeZoom({type:'ui.zoomReset'})`);
  win.setSize(1920, 1080);
  await wait(
    () => measure(),
    value => value.viewport.width === 1920,
    'normal viewport',
  );
  await click('tab', '\uC9C4\uD589');
  await check('regular Show', 'regular-show.png');
};
