# design

This folder holds the source files of the design system. It is also published
as a claude.ai artifact in the user's account:
[Design system](https://claude.ai/artifact/LDSJg1gwuFymJBuTbVEBQP). Draft
boards are kept outside the repository.

Implementation follows `system/project/`. When a draft board disagrees with it,
the design system wins.

## system/

- `project/README.md`: principles, color, type, spacing, icons, states and
  motion, window sizes and layout, and writing and the glossary.
- `project/tokens.json`, `project/tokens.css`: the tokens. The app uses
  `tokens.css` as it is.
- `project/components/<name>/README.md`: component docs. `preview.html` is a
  preview that shows every state.
- `project/components/bundle.css`: CSS for the previews (the `css/` pieces
  combined by `build-css.js`). When you build app components, use it as a
  reference for values.
- `upload/Icons/`: 86 icons (Phosphor Regular). The list of icon names is in
  `project/assets/Icons/README.md`.
- `upload/Media/`: 4 sample background images.
- To view the previews locally, start `node card-server.js` (port 5299) in
  `design/system`, then run the following command. The output is
  `shots/<component>.png`.

  ```bash
  ../../node_modules/electron/dist/electron.exe shoot-card.js <component> 960
  ```

- After you change the tokens, regenerate `tokens.css` with
  `node gen-tokens-css.js`.
- `CONVENTIONS.md`: the working rules used to build the design system
  (records). The list of board changes is kept with the draft boards.
