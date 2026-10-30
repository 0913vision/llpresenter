# Output layer registry

`layers.ts` discovers `layers/*.ts` with an eager Vite glob. Test files and the
separate fixture folder are excluded. A new layer needs only a module exporting
`defineLayer({kind, order, create})`; no OutputRenderer edit is needed.

- `kind` names the layer's DOM box and errors. It must be unique.
- `order` is a unique nonnegative integer, back to front. Background uses 0 and
  lyrics 1, preserving the existing relative stack and DOM attributes.
- `create(parent, options)` returns a persistent view with `render(layers)`,
  optional `rescale(scale)`, and `dispose()`. Options preserve the media URL,
  lyric style, preview mode, and error callback. A factory must release any
  partially acquired resources if it throws before returning its view.

OutputRenderer creates each view once. It draws and rescales views without
replacing them, gives every layer its own stacking context, and disposes every
view once with its ResizeObserver and root. Creation, drawing, rescaling, and
disposal errors are reported per layer so later layers can continue.

`layers/background.ts` and `layers/lyrics.ts` adapt the existing layer views.
Their playback, scaling, transition, and media cleanup behavior stays in those
views. No new layer content is implemented by this bootstrap.

The fixture discovery entry in `fixtures/layers.ts` uses the same registry
builder. New layer files in `fixtures/layers/` run through the real
OutputRenderer in `registryExtension.test.ts`, including error isolation and
cleanup. They never enter the production glob.
