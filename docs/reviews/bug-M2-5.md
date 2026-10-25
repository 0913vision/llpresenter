# Bug M2-5: The main process's memory swings up to 2.8 GB while a video loops

- Severity: major. Owner: output. Found by devops's 20-minute soak run 1
  (`docs/reviews/devops-17.md`, "Soak run 1").

## What was seen

- Scenario: the 본 화면 on, a 1080p background video of 5 MB and 10 s looping,
  and a 장 change every 5 s, for 20 minutes, with offscreen windows
  (`LLP_TEST_WINDOWS=offscreen`) at 100% CPU.
- The main process's private memory: median 1,166 MB, p90 2,336 MB, max 2,841
  MB; 84 of 119 samples above 600 MB. After each peak it falls back to about 90
  MB.
- The other processes were flat or settling: the GPU process near 575 MB, the
  output renderer near 101 MB, the control renderer near 195 MB.

## Where to look

- `src/main/windows/mediaResponse.ts` and `src/main/windows/mediaProtocol.ts`:
  the media protocol handler that answers the video element's range requests
  with `createReadStream` and `Readable.toWeb`.
- `src/main/store/` media lookup (data-13) as the caller of the file path.
- `src/renderer/src/render/backgroundLayer.ts`: how the output and the previews
  loop the video (native loop or a seek), which decides how often range requests
  start and are aborted.

## Questions

- Does an aborted or partially read range response keep its file stream, its
  buffers, or its handle until garbage collection?
- Does Electron's `protocol.handle` buffer a whole response body in the main
  process for a video element?
- Is the swing proportional to the loop count, the file size, or the number of
  video elements (the output plus three previews)?
