# design

This folder holds the source files of the UI drafts and the design system. Both
are also published as claude.ai artifacts in the user's account.

| Folder    | Contents                                                                   | Published version                                                  |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `system/` | Design system: principles, tokens, and docs and previews for 30 components | [Design system](https://claude.ai/artifact/LDSJg1gwuFymJBuTbVEBQP) |
| `drafts/` | 27 draft boards and a report page, plus the scripts that build the boards  | [Drafts](https://claude.ai/artifact/4Z4M7wLUjyxs5iqLzkeXct)        |

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
  D:/programming/2020-/pp/node_modules/electron/dist/electron.exe shoot-card.js <component> 960
  ```

- After you change the tokens, regenerate `tokens.css` with
  `node gen-tokens-css.js`.
- `CONVENTIONS.md`, `BOARD-CHANGES.md`: the working rules used to build the
  design system and the list of board changes (records).

## drafts/

- `llp-design/project/*.dc.html`: the boards (1920×1080). `Main.dc.html` is the
  report page, and `canvas.json` is the board layout.
- `llp-render/`: the board sources (`src/`, `parts/`) and the scripts that build
  the boards.
  - `assemble.js`: inserts the shared head, menu bar, toolbar, and status bar
    into `src/<board>.html` to make a `.dc.html` file.
  - Build order:
    1. `node build-scene.js`
    2. `node make-fork-a.js`
    3. `node build-import-edit.js`
    4. `node assemble.js <board>.html ...`
  - `ShowH.dc.html` is a board that was edited directly, without a source.
  - To view a board, start `node server.js 5199`, then run
    `electron shoot.js <board>.dc.html shots 0.5`.
- `llp-render/one-off/`: one-off scripts written against an older state. Don't
  run them.
