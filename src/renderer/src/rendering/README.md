# rendering

Drawing shared by the previews and the output windows. One set of rules draws
every view; no view keeps a second copy.

| Folder    | Holds                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| `theme/`  | A slide drawn through its theme: text boxes, pictures, backgrounds           |
| `media/`  | The pictures, videos and sound a screen plays, and their problems            |
| `layers/` | The layers over the slide (overlays, 소품, 메시지, stage info, test pattern) |
| `screen/` | What one screen follows from the main process: settings, clock, frame        |

The root keeps the entry points (`outputRenderer.ts`, `slideStill.ts`), the
layer contract (`layer.ts`), and what every folder shares (`classes.ts`,
`fontFamily.ts`, `timerTokens.ts`).

## Layers over the slide

`layers/renderLayers.ts` lists every layer back to front, as
`docs/spec/03-output.md` orders them. A layer is a `LayerDefinition` from
`layer.ts`: its `create(parent, options)` returns a view with `render`, an
optional `rescale`, and `dispose`, and a factory that throws releases what it
acquired first.

OutputRenderer creates each view once, draws and rescales it without replacing
it, gives every layer its own stacking context, and disposes every view once.
Errors in creating, drawing, rescaling or disposing a layer are reported for
that layer only, so the layers after it keep working.
