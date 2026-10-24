# Review request: `devops-13`

- Team member: `devops`
- Branch: `feat/devops/soak-scenario`
- Review range: `3329f81...feat/devops/soak-scenario` (round 3, rebased onto
  `main`)
- Related brief: the lead's M2 soak task. A 20-minute offscreen soak of a
  looping video plus 장 changes, through the recorder and the judge, with the
  numbers for qa's SK cases. This request prepares it; the run itself waits for
  two pieces (see "Not run yet").

## What to check

Round 3: the two round 2 findings, answered in "Team member's reply (round 2)"
at the end. Round 2 answered round 1 in "Team member's reply (round 1)". Round
1's list still applies:

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

data-13 (the media lookup) and output-10 (`LLP_TEST_WINDOWS=offscreen`) are on
`main` now. The 20-minute soak still needs output's two wiring lines in
`src/main/index.ts` ("Wiring for output"), which output lands once this merges.
Then I run `npm run soak -- --minutes 20` and add the numbers here for qa's SK
cases.

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

| Command                                  | Result                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` (round 1)               | Pass at 77 to 100% CPU, 172.2 s wall, every step at once: typecheck 12.5 s, lint 93.8 s, format:check 43.7 s, test:coverage 172.1 s, build 5.5 s |
| `npm run verify` (round 2, on `8e0d3b3`) | Pass at 100% CPU, 196.9 s wall, every step at once: typecheck 41.0 s, lint 84.4 s, format:check 107.5 s, test:coverage 196.7 s, build 8.9 s      |
| `npm run verify` (round 3, on `3329f81`) | Pass at 87 to 100% CPU, 184.0 s wall, every step at once: typecheck 11.9 s, lint 77.2 s, format:check 70.7 s, test:coverage 183.9 s, build 6.9 s |

## Team member's reply (round 1)

1.  Codex 1, `slice(-2)`. `parseClipArgs` (`clip-frames.mts`) takes exactly two
    arguments, a `.webm` path and a user data folder, and `main.mts` reads them
    first, before it sets a path, writes a file, or creates a window. A call
    with only an output path now prints the usage and exits 1 with nothing
    created; I ran it to check. Tests: no arguments, one, three, and the
    script's own path as the clip.
2.  Codex 2, the clip maker's deadline and output. `runClipMaker` stops the
    maker after 3 minutes (the clip took 15 s at 100% CPU) with every process it
    started (`killProcessTree`), lets go of its output, and rejects. It keeps
    only the last 64 KB of what the maker prints. Tests with real processes: a
    stalled maker is stopped at its deadline, and a hung tree behind it ends
    (parent and child); 5 MB of output before the summary still resolves; a
    failing maker rejects.
3.  Codex 3, NaN. `parsePlayback` requires a finite, positive duration, width,
    and height, and `checkPlayback` refuses a duration whose difference isn't
    within the tolerance, so NaN fails there too. Tests: NaN, Infinity, and 0
    durations, a NaN width, and NaN straight into `checkPlayback`.
4.  Codex 4, valibot in main. `registerSoakScenario` checks `LLP_SOAK_MEDIA_ID`
    with the shared `parsePayload(mediaIdSchema, value)`; nothing in
    `src/main/soak/` imports valibot.
5.  Codex 5, nit. `ClipSummary` is one exported type in `clip-frames.mts`, used
    by the maker and the runner; the TSDoc on the private copy went with it.

Added for the lead:

- `soakEnvironment` dropped inspector flags from `NODE_OPTIONS` (round 3: it
  leaves `NODE_OPTIONS` out instead), because qa measured a main process with an
  inspector growing 4.9 to 7.9 MB in 30 minutes. The runner itself uses no CDP:
  the scenario runs in the main process. Tests: mixed flags, a flag that only
  looks like one, and a `node_options` with only an inspector flag.
- `scripts/session-context.ts` builds its member branch rule from `COMMIT_TAGS`,
  so a `test/<name>/<feature>` branch shows its role. Test: `test/qa/show-cases`
  is `qa`.

## Team member's reply (round 2)

1.  Codex 1, `NODE_OPTIONS`. Following the lead's call, the soak app now starts
    without `NODE_OPTIONS` at all, under every spelling, instead of with an
    edited copy. Nothing the app needs comes from it, and anything in it (an
    inspector, a heap size) would change what the run measures, so no option
    parser is needed. The filter and its tests are gone. Tests: `NODE_OPTIONS`,
    `node_options`, and `Node_Options`, holding a plain `--inspect`, a quoted
    `"--inspect=9229"`, and a quoted path with two spaces, are all left out, and
    the other variables stay.
2.  Codex 2, the hung-tree cleanup. `waitForHungTree` (`test/process-trees.ts`)
    now registers `onTestFinished` to end both recorded processes, so every test
    that starts a hung tree ends it, also when an assertion fails or the code's
    own stop regresses. The two hand-written cleanups in `step-process.test.ts`
    are gone. After the process tests, no `setInterval` Node process was left.
