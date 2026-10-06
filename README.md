# Platformer

A Mario-style side-scrolling platformer in TypeScript and HTML5 Canvas (no game engine).

## Play locally

```bash
yarn install
yarn dev
```

Controls: arrows or WASD to move, Z / Space / Up / W to jump, X / Shift to run.

## Develop

```bash
yarn test        # unit tests (Vitest)
yarn typecheck
yarn build       # production build into dist/
```

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main`.
One-time setup after creating the GitHub repo:

1. Push this repo to GitHub (`git remote add origin <url> && git push -u origin main`).
2. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.

The site appears at `https://<user>.github.io/<repo>/`. Assets use relative paths, so the repo name does not matter.
