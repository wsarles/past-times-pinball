"use client";

import { useEffect, useMemo, useState } from "react";
import collection from "../data/games.json";

type Game = (typeof collection.games)[number];
type GameType = "ALL" | "SS" | "EM";
type PlanView = "ALL" | "MUST_PLAY" | "UNPLAYED";
type GamePlan = {
  mustPlay?: boolean;
  played?: boolean;
  rating?: number;
  notes?: string;
};
type VisitPlan = Record<string, GamePlan>;
type SortKey =
  | "name-asc"
  | "name-desc"
  | "manufacturer-asc"
  | "manufacturer-desc"
  | "year-desc"
  | "year-asc"
  | "type-asc"
  | "type-desc";

const games = collection.games as Game[];
const STORAGE_KEY = "past-times-pinball-visit-plan-v1";
const firstYear = Math.min(...games.map((game) => game.year));
const lastYear = Math.max(...games.map((game) => game.year));
const manufacturers = [...new Set(games.map((game) => game.manufacturer))].sort((a, b) =>
  a.localeCompare(b),
);

const sortLabels: Record<SortKey, string> = {
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "manufacturer-asc": "Manufacturer A–Z",
  "manufacturer-desc": "Manufacturer Z–A",
  "year-desc": "Year: newest first",
  "year-asc": "Year: oldest first",
  "type-asc": "Type: EM first",
  "type-desc": "Type: SS first",
};

function displayName(name: string) {
  if (name.endsWith(", The")) return `The ${name.slice(0, -5)}`;
  if (name.endsWith(", A")) return `A ${name.slice(0, -3)}`;
  return name;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function pinsideMachineUrl(game: Game) {
  return `https://pinside.com/pinball/machine/?query=${encodeURIComponent(game.name)}`;
}

function gameKey(game: Game) {
  return String(game.pinballMapId);
}

export function PinballFinder() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<GameType>("ALL");
  const [manufacturer, setManufacturer] = useState("ALL");
  const [fromYear, setFromYear] = useState("");
  const [throughYear, setThroughYear] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [offlineReady, setOfflineReady] = useState(false);
  const [visitPlan, setVisitPlan] = useState<VisitPlan>({});
  const [planReady, setPlanReady] = useState(false);
  const [planView, setPlanView] = useState<PlanView>("ALL");
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [randomGameId, setRandomGameId] = useState<number | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => setOfflineReady(true))
      .catch(() => setOfflineReady(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setVisitPlan(JSON.parse(saved) as VisitPlan);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setPlanReady(true);
    }
  }, []);

  useEffect(() => {
    if (planReady) localStorage.setItem(STORAGE_KEY, JSON.stringify(visitPlan));
  }, [planReady, visitPlan]);

  const lowerYear = fromYear ? Number(fromYear) : null;
  const upperYear = throughYear ? Number(throughYear) : null;
  const invalidRange = lowerYear !== null && upperYear !== null && lowerYear > upperYear;

  const filteredGames = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const visible = games.filter((game) => {
      const searchable = `${game.name} ${displayName(game.name)} ${game.manufacturer} ${game.year} ${game.type}`.toLocaleLowerCase();
      const plan = visitPlan[gameKey(game)];
      return (
        (!needle || searchable.includes(needle)) &&
        (type === "ALL" || game.type === type) &&
        (manufacturer === "ALL" || game.manufacturer === manufacturer) &&
        (lowerYear === null || game.year >= lowerYear) &&
        (upperYear === null || game.year <= upperYear) &&
        (planView !== "MUST_PLAY" || plan?.mustPlay) &&
        (planView !== "UNPLAYED" || !plan?.played) &&
        !invalidRange
      );
    });

    return visible.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return compareText(displayName(b.name), displayName(a.name));
        case "manufacturer-asc":
          return compareText(a.manufacturer, b.manufacturer) || compareText(displayName(a.name), displayName(b.name));
        case "manufacturer-desc":
          return compareText(b.manufacturer, a.manufacturer) || compareText(displayName(a.name), displayName(b.name));
        case "year-desc":
          return b.year - a.year || compareText(displayName(a.name), displayName(b.name));
        case "year-asc":
          return a.year - b.year || compareText(displayName(a.name), displayName(b.name));
        case "type-asc":
          return compareText(a.type, b.type) || compareText(displayName(a.name), displayName(b.name));
        case "type-desc":
          return compareText(b.type, a.type) || compareText(displayName(a.name), displayName(b.name));
        default:
          return compareText(displayName(a.name), displayName(b.name));
      }
    });
  }, [query, type, manufacturer, lowerYear, upperYear, invalidRange, sort, planView, visitPlan]);

  const mustPlayCount = games.filter((game) => visitPlan[gameKey(game)]?.mustPlay).length;
  const playedCount = games.filter((game) => visitPlan[gameKey(game)]?.played).length;
  const ratedCount = games.filter((game) => visitPlan[gameKey(game)]?.rating).length;
  const randomGame = games.find((game) => game.pinballMapId === randomGameId) ?? null;

  const hasFilters = Boolean(
    query || type !== "ALL" || manufacturer !== "ALL" || fromYear || throughYear || planView !== "ALL",
  );

  function clearFilters() {
    setQuery("");
    setType("ALL");
    setManufacturer("ALL");
    setFromYear("");
    setThroughYear("");
    setPlanView("ALL");
  }

  function updateGamePlan(game: Game, patch: Partial<GamePlan>) {
    const key = gameKey(game);
    setVisitPlan((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function pickNextGame() {
    const unplayed = filteredGames.filter((game) => !visitPlan[gameKey(game)]?.played);
    const queued = unplayed.filter((game) => visitPlan[gameKey(game)]?.mustPlay);
    const candidates = queued.length ? queued : unplayed;
    if (!candidates.length) {
      setRandomGameId(null);
      return;
    }
    const alternatives = candidates.length > 1
      ? candidates.filter((game) => game.pinballMapId !== randomGameId)
      : candidates;
    const selected = alternatives[Math.floor(Math.random() * alternatives.length)];
    setRandomGameId(selected.pinballMapId);
  }

  function toggleColumn(field: "name" | "manufacturer" | "year" | "type") {
    const ascending: Record<typeof field, SortKey> = {
      name: "name-asc",
      manufacturer: "manufacturer-asc",
      year: "year-asc",
      type: "type-asc",
    };
    const descending: Record<typeof field, SortKey> = {
      name: "name-desc",
      manufacturer: "manufacturer-desc",
      year: "year-desc",
      type: "type-desc",
    };
    setSort((current) => (current === ascending[field] ? descending[field] : ascending[field]));
  }

  return (
    <main className="finder-shell">
      <div className="museum-strip" aria-hidden="true">
        <span>✦</span><span>Past Times Museum Collection</span><span className="strip-center">Est. 2023</span><span className="strip-end">Pinball Heritage · Preserve & Play</span><span>✦</span>
      </div>

      <div className="page-frame">
        <header className="hero">
          <div>
            <p className="eyebrow">Girard, Ohio · Machine index</p>
            <h1>Past Times<br />Pinball Finder</h1>
          </div>
          <div className="hero-aside">
            <div className="collection-stamp">
              <span className="starburst" aria-hidden="true">✷</span>
              <strong>{games.length}</strong> machines
              <span aria-hidden="true">•</span>
              Updated {new Date(`${collection.sourceUpdated}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <nav className="location-links" aria-label="Past Times location links">
              <a href={collection.source} target="_blank" rel="noreferrer">Pinball Map <span aria-hidden="true">↗</span></a>
              <a href={collection.pinsideSource} target="_blank" rel="noreferrer">Pinside listing <span aria-hidden="true">↗</span></a>
            </nav>
          </div>
        </header>

        <a className="source-banner" href={collection.source} target="_blank" rel="noreferrer">
          <span><strong>Machine lineup powered by Pinball Map</strong> · Community-maintained location data</span>
          <span>View Past Times on Pinball Map ↗</span>
        </a>

        <section className="visit-planner" aria-labelledby="visit-planner-heading">
          <div className="planner-heading">
            <div>
              <p className="eyebrow">Saved only on this device</p>
              <h2 id="visit-planner-heading">Plan your visit</h2>
            </div>
            <div className="planner-stats" aria-live="polite">
              <span><strong>{mustPlayCount}</strong> must-play</span>
              <span><strong>{playedCount}</strong> played</span>
              <span><strong>{ratedCount}</strong> rated</span>
            </div>
          </div>

          <div className="planner-controls">
            <div className="planner-views" aria-label="Visit plan view">
              {([
                ["ALL", "All machines"],
                ["MUST_PLAY", "Must-play queue"],
                ["UNPLAYED", "Unplayed"],
              ] as [PlanView, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={planView === value ? "active" : ""}
                  aria-pressed={planView === value}
                  onClick={() => setPlanView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="random-button" type="button" onClick={pickNextGame}>
              Pick my next game
            </button>
          </div>

          {randomGame && (
            <div className="random-pick" role="status">
              <span className="starburst" aria-hidden="true">✷</span>
              <div>
                <small>Your next game</small>
                <strong>{displayName(randomGame.name)}</strong>
                <span>{randomGame.manufacturer} · {randomGame.year} · {randomGame.type}</span>
              </div>
              <button
                type="button"
                onClick={() => updateGamePlan(randomGame, { played: true })}
                disabled={visitPlan[gameKey(randomGame)]?.played}
              >
                {visitPlan[gameKey(randomGame)]?.played ? "Played" : "Mark played"}
              </button>
            </div>
          )}
        </section>

        <section className="search-section" aria-label="Search and filter games">
          <label className="search-box">
            <span className="search-icon" aria-hidden="true"></span>
            <span className="sr-only">Search games</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${games.length} games…`}
              autoComplete="off"
            />
          </label>

          <div className="filter-grid">
            <fieldset className="filter-block type-filter">
              <legend>Type</legend>
              <div className="segmented">
                {(["ALL", "SS", "EM"] as GameType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={type === value ? "active" : ""}
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                  >
                    {value === "ALL" ? "All" : value}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="filter-block">
              <span>Manufacturer</span>
              <select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}>
                <option value="ALL">All manufacturers</option>
                {manufacturers.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>

            <fieldset className={`filter-block year-filter ${invalidRange ? "invalid" : ""}`}>
              <legend>Manufactured</legend>
              <div className="year-inputs">
                <label><span>From</span><input aria-label="From year" inputMode="numeric" type="number" min={firstYear} max={lastYear} placeholder={String(firstYear)} value={fromYear} onChange={(event) => setFromYear(event.target.value)} /></label>
                <span aria-hidden="true">—</span>
                <label><span>Through</span><input aria-label="Through year" inputMode="numeric" type="number" min={firstYear} max={lastYear} placeholder={String(lastYear)} value={throughYear} onChange={(event) => setThroughYear(event.target.value)} /></label>
              </div>
              <small>{invalidRange ? "The starting year must come first." : "Leave either end blank for older or newer games."}</small>
            </fieldset>

            <label className="filter-block">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                {(Object.entries(sortLabels) as [SortKey, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <div className="result-tally" aria-live="polite">
              <span className="starburst" aria-hidden="true">✷</span>
              <strong>{filteredGames.length}</strong> {filteredGames.length === 1 ? "game" : "games"}
              <span className="starburst" aria-hidden="true">✷</span>
            </div>
          </div>

          <div className="filter-actions">
            <p>{fromYear && !throughYear ? `${fromYear} or newer` : !fromYear && throughYear ? `${throughYear} or older` : fromYear && throughYear ? `${fromYear} through ${throughYear}` : `Full collection: ${firstYear}–${lastYear}`}</p>
            <button type="button" onClick={clearFilters} disabled={!hasFilters}>Clear filters</button>
          </div>
        </section>

        <section className="results" aria-label="Pinball machines">
          <div className="table-heading" aria-hidden="true">
            <button type="button" onClick={() => toggleColumn("name")}>Name</button>
            <button type="button" onClick={() => toggleColumn("manufacturer")}>Manufacturer</button>
            <button type="button" onClick={() => toggleColumn("year")}>Year</button>
            <button type="button" onClick={() => toggleColumn("type")}>Type</button>
            <span>Visit plan</span>
          </div>

          <ol className="game-list">
            {filteredGames.map((game, index) => {
              const key = gameKey(game);
              const gamePlan = visitPlan[key] ?? {};

              return (
                <li
                  id={"game-" + game.pinballMapId}
                  className={[
                    "game-item",
                    gamePlan.played ? "played" : "",
                    gamePlan.mustPlay ? "must-play" : "",
                  ].filter(Boolean).join(" ")}
                  key={key}
                >
                  <div className="game-row">
                    <span className="row-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="row-star" aria-hidden="true">✷</span>
                    <strong className="game-name">
                      <a
                        href={pinsideMachineUrl(game)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={"View " + displayName(game.name) + " on Pinside"}
                      >
                        {displayName(game.name)} <span aria-hidden="true">↗</span>
                      </a>
                    </strong>
                    <span className="game-maker">{game.manufacturer}</span>
                    <span className="game-year">{game.year}</span>
                    <span className={"type-badge " + game.type.toLowerCase()}>{game.type}</span>
                    <div className="game-plan-actions">
                      <button
                        type="button"
                        className={gamePlan.mustPlay ? "active" : ""}
                        aria-pressed={Boolean(gamePlan.mustPlay)}
                        aria-label={(gamePlan.mustPlay ? "Remove " : "Add ") + displayName(game.name) + (gamePlan.mustPlay ? " from" : " to") + " must-play queue"}
                        onClick={() => updateGamePlan(game, { mustPlay: !gamePlan.mustPlay })}
                      >
                        {gamePlan.mustPlay ? "★ Must-play" : "☆ Must-play"}
                      </button>
                      <button
                        type="button"
                        className={gamePlan.played ? "active" : ""}
                        aria-pressed={Boolean(gamePlan.played)}
                        onClick={() => updateGamePlan(game, { played: !gamePlan.played })}
                      >
                        {gamePlan.played ? "✓ Played" : "Mark played"}
                      </button>
                      <button
                        type="button"
                        aria-expanded={expandedGame === key}
                        onClick={() => setExpandedGame(expandedGame === key ? null : key)}
                      >
                        {gamePlan.notes || gamePlan.rating ? "Notes •" : "Notes"}
                      </button>
                    </div>
                  </div>

                  {expandedGame === key && (
                    <div className="game-notes-panel">
                      <fieldset>
                        <legend>Your rating</legend>
                        <div className="rating-buttons">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              className={gamePlan.rating === rating ? "active" : ""}
                              aria-label={"Rate " + displayName(game.name) + " " + rating + " out of 5"}
                              aria-pressed={gamePlan.rating === rating}
                              onClick={() => updateGamePlan(game, {
                                rating: gamePlan.rating === rating ? undefined : rating,
                              })}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <label>
                        <span>Private notes</span>
                        <textarea
                          value={gamePlan.notes ?? ""}
                          placeholder="What stood out? What should you try next game?"
                          onChange={(event) => updateGamePlan(game, { notes: event.target.value })}
                        />
                      </label>
                      <small>Saved only in this browser.</small>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {!filteredGames.length && (
            <div className="empty-state">
              <span aria-hidden="true">✷</span>
              <h2>No machines match those filters.</h2>
              <button type="button" onClick={clearFilters}>Show the full collection</button>
            </div>
          )}
        </section>

        <footer>
          <p>{offlineReady ? "✓ Ready to use offline" : "Works offline after your first visit"}</p>
          <p>Machine list from <a href={collection.source} target="_blank" rel="noreferrer">Past Times on Pinball Map</a>. EM/SS classifications are maintained locally. Games may rotate for maintenance.</p>
        </footer>
      </div>
    </main>
  );
}
