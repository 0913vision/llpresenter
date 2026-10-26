# Later native audio check

Status: not run. These checks require a later user-authorized run with an
audio-enabled packaged build chosen by the lead. Development, test and
`LLP_TEST_WINDOWS` runs remain muted. No sound was played during development.

Use invented or public-domain audio and the Windows default output device.
Record the build commit, device, pass/fail results and observations here.

| Item                  | Result  |
| --------------------- | ------- |
| Build commit          | Pending |
| Windows output device | Pending |
| Date and operator     | Pending |

- [ ] Play several playlist entries, including the same file twice. Verify track
      order, repeat, previous and next.
- [ ] Pause and resume mid-track. Verify position and live volume changes.
- [ ] While a replacement loads, pause it. Verify the previous track also stops,
      including when the replacement cannot load.
- [ ] While playing, record the position and press F5. Measure time to silence:
      the acceptance limit is 0.5 seconds. The renderer envelope is 400 ms; this
      native measurement also covers IPC and device buffering.
- [ ] Undo the clear. Verify the same track resumes from the clear position,
      with the existing volume, without advancing to the next entry.
- [ ] Clear and undo a paused track. Verify it remains paused.
- [ ] Repeat the clear/undo checks with F1 and a macro that clears another layer
      before audio. Verify the picture keeps updating.
- [ ] Reload the control window during playback. Verify audio continues.
- [ ] Start manual 페이드 아웃. Verify the level falls over three seconds and
      stops without advancing the playlist. Repeat while a replacement loads.
- [ ] During manual fade, start a fresh track or press play. Verify the old fade
      does not stop that playback.
- [ ] Press F5 during manual fade. Verify the level does not rise and silence
      arrives within 0.5 seconds. Undo and verify the saved position and
      remaining manual fade duration resume.
- [ ] Close the application. Verify playback stops and no hidden audio window
      remains.
