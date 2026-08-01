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

Refresh the list from the current [Past Times Pinball Map entry](https://pinballmap.com/youngstown/?by_location_id=20266):

```bash
npm run refresh
```

After refreshing, run `npm run build:pages`, verify the count, and commit the updated `data/games.json`.

Pinball Map is the machine-list source. Pinside remains linked for additional machine information. Past Times notes that games may rotate off the floor for maintenance.
