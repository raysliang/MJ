# Current Build

The root app is the only supported build and is optimized for mobile-sized viewports.

- Local entrypoint: `index.html`
- Source: `src/main.js`, `src/mahjong.js`, and `src/styles.css`
- Generated bundle: `dist/mj.js`
- Published app: `https://raysliang.github.io/MJ/`

The former `/versions/mobile/` URL is retained only as a redirect to the root app. There are no separate v1 or v2 runnable copies.

Model comparison URLs:

- `/heuristic/` runs the immediate discard heuristic.
- `/rollout/` runs the future-aware one-turn rollout.

Mortal and Akochan are external Riichi Mahjong engines with different rules and runtime requirements; they are not bundled as browser models.
