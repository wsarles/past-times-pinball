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

Try the direct refresh first:

```bash
npm run refresh
```

If Pinside blocks the automated request, open the [Past Times game list](https://pinside.com/pinball/map/where-to-play/17578-past-times-arcade-girard-oh/), select and copy the page, then run this on macOS:

```bash
pbpaste | npm run refresh -- -
```

You can also save the page as HTML or plain text and pass its filename:

```bash
npm run refresh -- ~/Downloads/past-times.html
```

After refreshing, run `npm run build:pages`, verify the count, and commit the updated `data/games.json`.

Machine data is attributed and linked to Pinside in the site footer. Past Times notes that games may rotate off the floor for maintenance.
