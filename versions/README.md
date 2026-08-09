# Mahjong versions

- `v1/`: separated archive folder. The workspace did not contain a saved pre-v2 snapshot, so this is not a byte-for-byte historical copy of the earlier root state.
- `v2/`: current East-perspective implementation.
- `mobile/`: phone-optimized v2 implementation for an approximately 440px-wide iPhone viewport.

Published entry points:

- Repository root: mobile version at `https://raysliang.github.io/MJ/`.
- `desktop/`: desktop version at `https://raysliang.github.io/MJ/desktop/`.

Each folder is independently runnable from its own `index.html` or `launch.bat` and contains its own source, tests, and built bundle.
