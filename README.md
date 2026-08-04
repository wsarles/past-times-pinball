# Past Times Pinball Finder

A mobile-first, offline-capable finder for the pinball machines at Past Times Arcade in Girard, Ohio. The collection can be searched and filtered by manufacturer, SS/EM type, and an inclusive year range. Every column can also be sorted.

## Run locally

```bash
npm install
npm run dev
```

## Build the GitHub Pages site

```bash
npm run build:pages
```

The static site is written to `docs/`. The included GitHub Actions workflow builds and deploys it whenever `main` is updated. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Refresh the machine list

Pinball Map requires an approved API token. Keep it outside the repository and use the environment variable `PINBALL_MAP_API_TOKEN`.

### Refresh and deploy from GitHub

1. In **Settings → Secrets and variables → Actions**, add a repository secret named `PINBALL_MAP_API_TOKEN`.
2. Open **Actions → Deploy GitHub Pages → Run workflow**.
3. Leave **Refresh the machine list** enabled and run it.

The workflow refreshes from the current [Past Times Pinball Map entry](https://pinballmap.com/youngstown/?by_location_id=20266), builds the site, and deploys it. It has read-only repository access, so the refreshed files are not committed back to `main`.

### Refresh locally

```bash
PINBALL_MAP_API_TOKEN="your-token" npm run refresh
npm run build:pages
```

Verify the machine count, then commit the updated `data/games.json` and `docs/` files.

Pinball Map is the machine-list source. Pinside remains linked for additional machine information. Past Times notes that games may rotate off the floor for maintenance.
