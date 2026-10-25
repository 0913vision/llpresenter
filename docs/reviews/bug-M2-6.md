# Bug M2-6: The control renderer's memory keeps rising slowly

- Severity: to decide (it may be settling, not a leak). Owner: shell, with ui
  for shared components. Found by devops's 20-minute soak run 1
  (`docs/reviews/devops-17.md`, "Soak run 1").

## What was seen

- Same scenario as bug M2-5: the 본 화면 on, a looping 1080p background video,
  and a 장 change every 5 s for 20 minutes.
- The control renderer's lowest private memory per window rose from 34 to 188 MB
  in the first minute, then from 188 to about 195 MB over the remaining 19
  minutes, with a small rise in the later half. The judge's trend is +21.3 MB/h
  overall, over its 4 MB/h limit.
- The control window shows the 장 grid, the 예배 순서 list, three previews that
  each run an output renderer (`src/renderer/src/show/ScreenPreview.tsx`), and
  the 지우기 row.

## Questions

- What does the control window create on each 장 change, and is all of it
  released (DOM nodes, listeners, timers, object URLs, video elements, React
  state that grows)?
- Do the three preview renderers create anything per 장 that the output window
  reuses but the previews don't?
- Is any list or cache in the control window's state unbounded (history,
  notifications, logs)?
