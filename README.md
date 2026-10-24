# LoveLight Presenter

LoveLight Presenter is a Windows app that sends lyrics, Bible verses, and
announcements to several screens during a church service. We are rebuilding it
from scratch on the `main` branch.

- What we're building and where it stands: [`docs/HANDOFF.md`](docs/HANDOFF.md)
- Feature spec: [`docs/spec/`](docs/spec/)
- Design system and drafts: [`design/`](design/)
- Technical decisions and quality bar: [`docs/TECH.md`](docs/TECH.md)
- Implementation plan and workflow: [`docs/PLAN.md`](docs/PLAN.md),
  [`docs/WORKFLOW.md`](docs/WORKFLOW.md)

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
