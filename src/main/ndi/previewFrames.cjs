/** Drops queued video frames, retaining the newest one available. */
function takeLatestFrame(next, release, limit = 12) {
  let latest = next();
  try {
    for (let i = 1; latest !== null && i < limit; i++) {
      const candidate = next();
      if (candidate === null) break;
      const previous = latest;
      latest = candidate;
      release(previous);
    }
    return latest;
  } catch (error) {
    if (latest !== null) release(latest);
    throw error;
  }
}

module.exports = {takeLatestFrame};
