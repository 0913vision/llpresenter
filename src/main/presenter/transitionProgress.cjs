/** Samples transition progress from elapsed monotonic time, not frame count. */
function transitionProgress(start, duration, now) {
  if (duration <= 0) return 1;
  return Math.max(0, Math.min(1, (now - start) / duration));
}

module.exports = {transitionProgress};
