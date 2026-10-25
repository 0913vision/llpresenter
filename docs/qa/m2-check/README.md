# M2 check sample

Copy `sample/` to a new user data folder outside the clone before starting the
app. Set `LLP_USER_DATA` to the copied folder, which contains both `app.json`
and `LoveLight/`. Follow [the second Korean check sheet](../m2-check2.md) for
the current sample. [The first sheet](../m2-check.md) describes `m2-check1`.

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

The first two songs share the looping video as their default background. The
third uses the still image. Entering a song by clicking its slide applies its
background; moving within a song keeps playback, and consecutive songs with the
same background do not restart it. The second song gained its explicit video
background for `m2-check2`; the first tag retains its original fixture.
