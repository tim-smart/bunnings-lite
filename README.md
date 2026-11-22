# bunnings-lite

A lightweight Bunnings client built on `@effect/ui`: product search with
filters, product pages, a store picker, and favourites that sync between
devices through an encrypted event log.

The client is a client-rendered SPA built on the experimental `@effect/ui`
package. It replaced the earlier React client, and reads the same browser
storage, so favourites, the chosen store and sync settings carry over.
`server/` is the API it talks to.

## Setup

The toolchain comes from the flake (`nix develop`, or `direnv allow`): Node
and pnpm.

```bash
pnpm install
```

`@effect/ui` and `@effect/ui-kit` are pinned to the same pkg.pr.new build,
and take `effect` as a peer. Bump them together.
Keep `effect` and the other `@effect/*` packages on one version, so there is
one copy of `effect`.

`server/` is its own package, with its own lockfile. The Docker workflow
builds it into the `timsmart/bunnings-api` image on every push to `main`.
The client deploys to Vercel, where `vercel.json` sends every path outside
`api/` to `index.html`.

## Commands

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Vite dev server                                        |
| `pnpm build`     | Production build into `dist/`, with the service worker |
| `pnpm preview`   | Serves the production build                            |
| `pnpm typecheck` | `effect-tsgo tsc --noEmit`                             |
| `pnpm test`      | Component tests (vitest, `src/**/*.test.ts`)           |
| `pnpm test:e2e`  | Playwright specs in `tests/`                           |

The Playwright specs start their own dev server on port 4173 and a sync
server on 65533, and mock the product API over the WebSocket. They need a
Chromium: either `pnpm exec playwright install chromium`, or point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` at one that is already installed.

## Configuration

| Variable                 | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `VITE_API_URL`           | WebSocket URL of the API's RPC endpoint, for example `ws://localhost:3000/rpc` |
| `VITE_HONEYCOMB_API_KEY` | Optional. Sends traces to Honeycomb when set                                   |

## Layout

The code follows "Organizing an app" in
`node_modules/@effect/ui/ai-docs/src/10_ui/index.md`, which is also the only
reliable reference for these modules.

```text
src/
  main.ts       browser entry: mounts App, provides platform Layers only
  App.ts        root component: finishes a pending sync join, then the shell
  Shell.ts      header, drawers and the page for the route; shared services
  routes.ts     AppRoute
  pages/        one file per route
    SearchPage.ts            /
    product/ProductPage.ts   /product/:id
  search/ product/ stores/ favorites/ sync/
                features, each split into domain/ services/ queries/ components/
  rpc/          the API client and the logged-in session
  browser/      browser APIs as services (viewport, share, install prompt)
  design/       class recipes, icons and view helpers shared by components
```

Pages import features and features never import pages. A component provides
the Layers it needs and is exported under its plain name, with the bare
component as `XNoDeps`. Search text and filters live in the URL query.
