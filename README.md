# LoveLight Presenter

LoveLight Presenter is a Windows Electron app that sends lyrics, Bible verses,
and announcements to several screens during a church service. We are rebuilding
it from scratch on the `main` branch. The 2024 code is kept as the tag
`legacy-2024` and is reference only. Never stopping during a service matters
more than features.

- Feature spec: [`docs/spec/`](docs/spec/)
- Design system: [`design/`](design/)
- Stack and quality bar: [`docs/TECH.md`](docs/TECH.md)
- How to contribute: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Development

```bash
npm ci
npm run dev
```

- To change the dev server port and the app data folder, set `LLP_DEV_PORT` and
  `LLP_USER_DATA`.
- `npm ci` runs Electron's `install-electron` as `postinstall`, because Electron
  44 no longer downloads its binary on install and electron-vite needs it. It
  skips the download when the binary is already there.
