# Review request: `devops-13`

- Team member: `devops`
- Branch: `feat/devops/soak-scenario`
- Review range: `94780dc...feat/devops/soak-scenario`
- Related brief: the lead's M2 soak task. A 20-minute offscreen soak of a
  looping video plus 장 changes, through the recorder and the judge, with the
  numbers for qa's SK cases. This request prepares it; the run itself waits for
  two pieces (see "Not run yet").

## What to check

1.  `src/main/soak/scenario.ts`: the scenario only runs with a usable soak
    record, validates `LLP_SOAK_MEDIA_ID` as a media id, logs a command that
    throws and carries on, and its stop function clears its only timer.
2.  `src/main/soak/index.ts` and `recorder.ts`: the record lines carry the
    output frame rates from an injected source, and the existing call
    `registerSoakRecorder(log)` keeps working.
3.  `scripts/soak/webm.mts`: the WebM is well formed (EBML header, Info with the
    duration, one VP8 track, a cluster per key frame, block times that fit 16
    bits).
4.  `scripts/soak/clip/`: the clip maker never shows a window, keeps Electron's
    caches out of the user's AppData, and validates everything the page sends
    back (`clip-frames.mts`).
5.  `scripts/soak/media.mts` and `run.mts`: `media.json` follows data's format,
    and the app starts with the background and `LLP_TEST_WINDOWS=offscreen`.

## What changed and why

### The scenario in the app (`src/main/soak/scenario.ts`)

`registerSoakScenario(log, dispatch, env)` runs only when `readSoakSettings`
says the soak record is on, so a normal start never plays it. It sends the same
live commands a window would:

1.  `media.show` with `LLP_SOAK_MEDIA_ID`, looping. A value that isn't a media
    id (UUID v4, `mediaIdSchema`) is logged, and the scenario runs without a
    background.
2.  `output.set` for the 본 화면 (`MAIN_SCREEN_ID`).
3.  `slide.show` with the first of 12 invented 장 (`scenarioSlide`: two lines,
    이름표 1절, 후렴, or none, no copied lyrics), then the next one every 5
    seconds, as qa's SK2 says, starting over after the 12th.

A command that throws is logged with its type, and the next change still comes.
The stop function clears the interval; the app's quit stops the outputs.

### Frame rates in the record

`sampleLine` now takes the outputs (`{screen, fps}`), which replaces the TODO.
`registerSoakRecorder(log, {frameRates, env})` takes them from an injected
source; without one the record lists no outputs, as before. output-9's call
`registerSoakRecorder(log)` keeps compiling and working.

### The background clip (`scripts/soak/clip/`, `webm.mts`)

The repository holds no video, and qa's clips live in qa's folder, so the runner
makes its own clip. qa suggested this and shared how they make theirs
(MediaRecorder from a canvas in an offscreen window, then an EBML patch for the
missing duration), and warned that a 287 ms gap in one of their clips showed up
as a false loop hitch. I kept the offscreen window and the duration, but encode
with WebCodecs instead of MediaRecorder:

- `encode.js` draws 300 frames of moving lights at 1920×1080 into an
  `OffscreenCanvas` and encodes each with `VideoEncoder` (VP8, 4 Mbps, a key
  frame every second) at its exact time (`index × 33.333 ms`). Frame times don't
  depend on how busy the machine is, so the clip has no gaps.
- `webm.mts` writes the WebM itself: header, Info with the duration, one video
  track, and a cluster per key frame. That puts the duration in from the start
  instead of patching it in.
- `clip/main.mts` runs in Electron in a window with `show: false` and
  `offscreen: true`, with hardware acceleration off and `userData` in the run's
  folder. It checks the frames (`parseEncodedFrames`, `checkFrameTiming`: 300
  frames, no gap over 1.5 frames), writes the file, then plays and seeks it in
  Chromium (`checkPlayback`: 1920×1080, 10 ± 0.1 s) before it prints a summary.
- A run here made a 5,013,551-byte clip (4.0 Mbps) of 300 frames that Chromium
  plays for 10.000 s, in 15 s at about 100% CPU. No window appeared.

### The media library and the app's start (`media.mts`, `run.mts`)

- `prepareSoakMedia` puts the clip in `LoveLight/미디어/soak-loop.webm` under
  the new `LLP_USER_DATA` and lists it in `LoveLight/설정/media.json` with a
  fixed id, `end: loop`, and `fit: fill`.
- `soakEnvironment` adds `LLP_SOAK_MEDIA_ID` and `LLP_TEST_WINDOWS=offscreen` to
  the existing variables, and the app starts with `windowsHide`.

## Wiring for output (after this merges)

In `src/main/index.ts`, next to the existing recorder call:

```ts
const stopSoakRecorder = registerSoakRecorder(log, {
  frameRates: () => /* each output screen's {screen, fps} from FrameRateTracker */,
});
const stopSoakScenario = registerSoakScenario(log, command =>
  store.dispatch(command),
);
shutdown.add({name: 'stop the soak scenario', run: stopSoakScenario});
```

`registerSoakScenario` belongs after `startOutputs`, so the 본 화면 exists when
the scenario turns it on. `index.wiring.test.ts` mocks `./soak` and needs
`registerSoakScenario` in that mock.

## Not run yet

The 20-minute soak waits for two pieces that the lead has asked for:

1.  data's media wiring. Today `findMediaFile` returns `null`, so no video
    plays.
2.  output's `LLP_TEST_WINDOWS=offscreen` switch. Without it, the 본 화면 opens
    as a visible window on a one-monitor PC.

Once both are on `main`, I run `npm run soak -- --minutes 20` and add the
numbers here for qa's SK cases.

## Tests

- `src/main/soak/scenario.test.ts`:
  - the 장 pass `parseLiveCommand`;
  - the start order (background, 본 화면, first 장);
  - a 장 every 5 s, starting over after the 12th;
  - no background without an id;
  - a throwing command is logged and the next 장 still comes;
  - nothing changes after stop;
  - nothing runs without a record or with unusable settings;
  - `LLP_SOAK_MEDIA_ID` is used, and a bad one is logged.
- `src/main/soak/index.test.ts`: the recorder writes the frame rates it gets,
  and no outputs without a source (Electron mocked, real record file).
- `src/main/soak/recorder.test.ts`: a line with outputs reads back unchanged.
- `scripts/soak/webm.test.ts`: an EBML reader in the test checks the header, the
  duration, the track, every frame's time, order, and key flag, a cluster per
  key frame, a new cluster before the 16-bit offset overflows, and refuses a
  clip without frames or without a leading key frame.
- `scripts/soak/clip-frames.test.ts`: checks for the page's frames, timing (a
  287 ms gap is refused), playback report, and error outcome.
- `scripts/soak/media.test.ts`: `media.json` passes data's `parseMediaList`; the
  files land where the store reads them; the clip summary is checked.
- `scripts/soak/run.test.ts`: the app's environment.

## Changed files

- `src/main/soak/scenario.ts`, `scenario.test.ts`, `index.ts`, `index.test.ts`,
  `recorder.ts`, `recorder.test.ts`
- `scripts/soak/webm.mts`, `webm.test.ts`, `clip-frames.mts`,
  `clip-frames.test.ts`, `media.mts`, `media.test.ts`, `run.mts`, `run.test.ts`,
  `clip/main.mts`, `clip/encode.js`, `clip/page.html`
- `scripts/lint/config.mts` (browser globals for `scripts/soak/clip/*.js`)
- `scripts/README.md` (soak section)
- this document

## Checks run

| Command          | Result                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` | Pass at 77 to 100% CPU, 172.2 s wall, every step at once: typecheck 12.5 s, lint 93.8 s, format:check 43.7 s, test:coverage 172.1 s, build 5.5 s |
