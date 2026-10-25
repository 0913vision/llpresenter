# M2 check sample

Copy `sample/` to a new user data folder outside the clone before starting the
app. Set `LLP_USER_DATA` to the copied folder, which contains both `app.json`
and `LoveLight/`. Follow [the Korean check sheet](../m2-check.md).

The service has five rows: two section headers and three songs. Every lyric is
invented for this fixture. The first song uses the ten-slide `주일용`
arrangement, the second uses its five original slides, and the third uses the
three-slide `전체` arrangement. Labels include an empty interlude and long lines
to make layout problems easier to spot.

The media are original procedural canvas drawings made for this fixture, with no
downloaded source material:

| File under `sample/LoveLight/미디어/` | Format                    | Size            | Use                                             |
| ------------------------------------- | ------------------------- | --------------- | ----------------------------------------------- |
| `새벽빛-반복.webm`                    | VP8, 1280x720, 12 seconds | 1,123,968 bytes | Silent looping blue and violet light background |
| `노을.png`                            | PNG, 1920x1080            | 152,343 bytes   | Still sunset background                         |

Media paths in `media.json` are relative to the media folder. The sample has no
absolute machine paths, personal data, recovery state, or output enabled at
launch. The app may create logs, backups, settings, and recovery files in the
copy. Keep those runtime files out of this fixture.

The current slice does not automatically show a song's background on a slide
click. QA checks media decoding separately through the existing live command
API; the user sheet covers the available UI.
