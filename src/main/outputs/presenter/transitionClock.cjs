// NOTE(0913vision): A transition lasts exactly as long as it is set to. Its
// progress is the time since it started, counted in whole frames of the monitor
// so every step is the same size. Frames are never counted against the refresh
// rate the monitor reports: one that reports 120 a second can show 60.

const SAMPLES = 120;
const MINIMUM_SAMPLES = 5;
const LONGEST_FRAME_MS = 100;

/** The length of one frame: the mean of the intervals that were one frame. */
function frameLength(intervals) {
  const median = [...intervals].sort((a, b) => a - b)[intervals.length >> 1];
  const single = intervals.filter(
    value => value > median * 0.75 && value < median * 1.25,
  );
  return single.reduce((sum, value) => sum + value, 0) / single.length;
}

/** Times transitions against the frames a monitor really takes. */
function createTransitionClock(hz) {
  const reported = 1000 / (hz > 0 ? hz : 60);
  let last = null;
  const recent = [];
  let running = null;

  return {
    /** Records that the monitor took a frame. */
    presented(now) {
      const interval = last === null ? null : now - last;
      last = now;
      if (interval === null || interval <= 0 || interval > LONGEST_FRAME_MS) {
        return;
      }
      recent.push(interval);
      if (recent.length > SAMPLES) recent.shift();
      if (running !== null) running.intervals.push(interval);
    },
    /** Forgets the last frame, so a pause is not measured as one. */
    pause() {
      last = null;
    },
    start(seconds) {
      running = {
        duration: seconds * 1000,
        frame: recent.length < MINIMUM_SAMPLES ? reported : frameLength(recent),
        started: null,
        steps: 0,
        intervals: [],
      };
    },
    stop() {
      running = null;
    },
    /** How far the transition has come when the next frame is shown. */
    progress(now) {
      if (running === null) return 1;
      running.started ??= now;
      running.steps = Math.max(
        running.steps,
        Math.round((now - running.started) / running.frame) + 1,
      );
      return Math.min(1, (running.steps * running.frame) / running.duration);
    },
    /** What the transition that just ended took, for the log. */
    finish() {
      if (running === null) return null;
      const {duration, frame, intervals} = running;
      running = null;
      const taken = intervals.reduce((sum, value) => sum + value, 0);
      return {
        set: Math.round(duration),
        taken: Math.round(taken),
        frames: intervals.length,
        late: intervals.filter(value => value > frame * 1.5).length,
      };
    },
  };
}

module.exports = {createTransitionClock};
