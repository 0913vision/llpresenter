# M2 check smoke result

## Build and scope

- Tested October 25, 2026, on local `main`
  `b08a8bf68a964cddf61f9d202e4ca883aa2623b9`, version `0.11.0`.
- This QA worktree was rebased to that commit before building. Only documents
  and sample data were added; app code was unchanged.
- Windows, Electron `44.9.3`, one real 1920x1080 monitor, 100% scale. A second
  run supplied a fake second 1920x1080 monitor through the existing QA wrapper.
- Every app run set `LLP_TEST_WINDOWS=offscreen`. The wrapper recorded no
  dialog, show, focus, maximize, full screen, or always-on-top calls. Control
  and output windows stayed hidden.
- The sample was copied before each run. All takeover QA writes stayed in this
  worktree's ignored `.llp/qa/runtime/` sandbox. The user sheet instead copies
  the sample outside the user's clone.
- The lead has not published `m2-check1` yet. This is a local-main smoke result,
  not a remote-tag check, full M2 sign-off, or a long soak result.

## Results

| Check                               | Result                       | Evidence                                                                                                                                                                                                            |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                            | Pass                         | 275 packages installed, no audit vulnerabilities; lifecycle scripts completed.                                                                                                                                      |
| `npm run build`                     | Pass                         | Main, preload, and both renderer pages built.                                                                                                                                                                       |
| `npm run preview` startup and close | Pass                         | Preview rebuilt, read 3 songs and 1 service, showed the sample service in the renderer, and exited with code 0. Diagnostic launch used the QA wrapper entry and a renderer CDP argument; no main-process inspector. |
| Fixture schemas                     | Pass                         | All 7 text files parse through the app's current parsers, editable with no dropped fields. All song, arrangement, media, and label references resolve. Media sizes match the registry.                              |
| First launch                        | Pass                         | `샘플 주일 예배`, five rows in the documented order, no missing-data warning on a service row.                                                                                                                      |
| Song and arrangement                | Pass                         | First song has 10 tiles in `주일용` order; next songs have 5 and 3. Tile text and live marking follow the selected and live items.                                                                                  |
| Slide keys                          | Pass                         | Space, Right, and Page Down advance; Left and Page Up go back. The last slide stops at position 9. Label keys C, 2, B, E, 1, and P select the matching label.                                                       |
| Item keys                           | Pass                         | From both the grid and the service list, Ctrl Down twice, Ctrl Up, Ctrl L select the second, third, second, and live first song. Headers are skipped; live position stays 2.                                        |
| Clear and undo                      | Pass                         | Button clear and undo, F2 then Ctrl Z, F1 then Ctrl Z. A separate rendering check confirms both lyric pages have opacity 0 after clear, and the restored page has opacity 1 after undo.                             |
| Preview picture click               | Pass                         | Clicking the small stage picture makes it large; clicking the main picture restores it. The broadcast picture also becomes large. M2-3 does not reproduce.                                                          |
| Output toggle                       | Pass in offscreen mode       | The main state and button toggle on and off; the retained output renderer has the current lyrics when enabled again. No native visibility claim is made from a hidden-window test.                                  |
| Monitor placement                   | Pass in offscreen mode       | One monitor gives a 960x540 window placement and `monitorMissing`; the fake second monitor gives `fullscreen` placement at x=1920, 1920x1080. Native full screen is intentionally disabled in offscreen mode.       |
| Sample video                        | Pass through live API        | VP8 decodes at 1280x720, readyState 4, no media error. The active video moves from about 2 seconds to about 1 second after 11 more seconds, with the two output buffers exchanging roles across the 12-second loop. |
| Sample image file                   | Pass for lookup and decoding | `llp-media://media/7a2d3b9f-4c5e-4f60-9b7c-8d9e0f1a2b3c` loads as a 1920x1080 `Image`. Output rendering fails as described below.                                                                                   |
| Window sizes                        | Pass for document overflow   | At 1280x720, 1366x768, and 1920x1080, document scroll dimensions equal the viewport. This does not replace visual review at other Windows scales.                                                                   |
| Close and reopen                    | Pass for service             | Graceful close exits with code 0 in about 0.4 seconds in the final runs. The same five-row service reopens. Preview choice fails as described below.                                                                |

## Failures and incomplete features

### F1: The large preview choice resets after restart

- Severity: minor. Owner: shell, `src/renderer/src/state/preview.ts`.
- Build: local main `b08a8bf`, version `0.11.0`.
- Reproduce: use the sample, click the small 방송 자막 preview, close normally,
  and restart with the same `LLP_USER_DATA`.
- Expected: 방송 자막 stays large, following spec 04, "Preview sizes", and spec
  02's `app.json.previewBig`.
- Actual: 본 화면 is large again. Reproduced with one and two monitor inputs,
  including clean exits with the main inspector disconnected before shutdown.
- Current code records the choice only in memory and has a TODO for
  `previewBig`. No output or song data was lost in this check.
- Suggested owner test: select the broadcast preview, persist UI state, create a
  fresh store from that state, and assert the broadcast preview is large.

### F2: A valid image background is sent to a video element

- Severity: major for image output. Owner: output,
  `src/renderer/src/render/backgroundLayer.ts`.
- Build: local main `b08a8bf`, version `0.11.0`.
- Reproduce with the copied sample and the main output enabled. Through the
  renderer's existing live API, send:

  ```javascript
  window.llp.live.send({
    type: 'media.show',
    media: {
      mediaId: '7a2d3b9f-4c5e-4f60-9b7c-8d9e0f1a2b3c',
      loop: false,
    },
  });
  ```

- Expected: the registered PNG is shown as a still background. Its URL loads
  successfully in an `Image`, so this is not a missing or broken fixture.
- Actual: the layer contains a video with that PNG URL, `videoWidth` 0,
  `MediaError.code` 4, and opacity 0. The log reports:

  ```text
  ERROR window: could not start a background video "NotSupportedError: Failed to load because no supported source was found."
  ```

- The same failure occurs in the control previews. The live state accepts the
  image ID, but the image does not appear. The video path works.
- Suggested owner test: register `kind: 'image'`, send `media.show`, and assert
  that its still picture renders without a video playback error.

### Available UI stops short of media and additional outputs

- A song tile sends the lyrics only; `layers.media` stays null even when the
  song file names a background. No available media picker connects the sample
  video to output. Media playback above was checked through the live API,
  separately from the user flow.
- 무대 and 방송 자막 buttons change their pressed state but do not create
  additional output windows. Only the main screen appears in output status.
  Stage preview content uses the current lyric renderer, not a stage layout.
- Clicking 파일 creates no menu. 준비 shows its panel frame without editing
  controls. These are the restart task's known gaps.
- M2-5 remains a known memory issue. This short run did not retest or clear M2-5
  or the separate M2-6 control-memory observation.

The Korean sheet calls out these limits so the user can complete the available
flow. The lead should route F1 and F2 to their owners and assign milestone bug
IDs. Neither finding changes app code in this request.

## Evidence retained locally

The final full `npm run format:check` passes. The custom `.llsong` and
`.llservice` extensions also pass an explicit Prettier JSON parser check.
Fixture schema and reference validation was repeated after formatting; all seven
text files still parse without dropped fields. `npm run verify` was not run
under the restart task's explicit documents-only exception.

Ignored `.llp/qa/runtime/` contains `fixture-validation.json`,
`preview-result.json`, `targeted-result.json`, the per-run data and logs, and
`results/check-flow-one-1792898913823.json` plus
`results/check-flow-two-1792898993426.json`.

The inherited harness needed corrections for the nested service list, tile
number prefixes, the LIVE badge, the output renderer's double-buffered loop, the
required `media.loop` field, and disconnecting the inspector at shutdown. Those
initial harness failures are not app defects. The final two-monitor run passes
its assertions except F1; F2 is confirmed by the separate targeted run. The
one-monitor tile-order assertion had a harness string-escaping error; the
targeted run independently records the correct ten tile names.
