// NOTE(0913vision): Each paint resets the interval; late timers skip missed slots.
function createPacer(send, rate = {n: 30, d: 1}) {
  const interval = (1000 * rate.d) / rate.n;
  let timer = null;
  let due = 0;
  function schedule() {
    timer = globalThis.setTimeout(
      tick,
      Math.max(0, Math.ceil(due - globalThis.performance.now())),
    );
  }
  function tick() {
    send();
    const now = globalThis.performance.now();
    due += (Math.floor(Math.max(0, now - due) / interval) + 1) * interval;
    schedule();
  }
  return {
    sent() {
      if (timer !== null) globalThis.clearTimeout(timer);
      due = globalThis.performance.now() + interval;
      schedule();
    },
    stop() {
      if (timer !== null) globalThis.clearTimeout(timer);
      timer = null;
    },
  };
}
module.exports = {createPacer};
