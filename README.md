# LoveLight Presenter

LoveLight Presenter is a Windows app that sends lyrics, Bible verses, and
announcements to several screens during a church service. We are rebuilding it
from scratch on the `main` branch.

- Feature spec: [`docs/spec/`](docs/spec/)
- Design system: [`design/`](design/)
- Stack and quality bar: [`docs/TECH.md`](docs/TECH.md)
- Decision log: [`docs/decisions.md`](docs/decisions.md)

## Development

```bash
npm ci
npm run dev
```

- Checks: `npm run typecheck`, `npm test`, `npm run format:check`, and
  `npm run build`.
- Run `npm run format` before you commit.
- To change the dev server port and the app data folder, set `LLP_DEV_PORT` and
  `LLP_USER_DATA`.
