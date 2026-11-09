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

## Install on Windows

Download `LoveLightPresenter-Setup-<version>.exe` from this repository's
[published releases](https://github.com/0913vision/llpresenter/releases). Run it
and choose the installation folder. The desktop and Start menu shortcuts are
named **LoveLight Presenter**. Uninstalling keeps the app data, libraries, and
backups. The installer does not include locally prepared Bible text or the
optional AI model. The app currently uses Electron's default icon.

첫 실행 전에
[KoPub 공식 페이지](https://www.kopus.org/biz-electronic-font2/)에서 주일 테마
글꼴(KoPub)을 설치해 주세요.

The installed app checks for published updates after startup. Use **도움말 >
업데이트 확인** to check manually. Installation requires **설치** and waits
until every output is off. **나중에** never installs when you quit. Install
between services and rehearse before using the new version.

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
