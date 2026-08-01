import { readFile, writeFile } from "node:fs/promises";

const LOCATION_ID = 20266;
const PINBALL_MAP_SOURCE = `https://pinballmap.com/youngstown/?by_location_id=${LOCATION_ID}`;
const LOCATION_API = `https://pinballmap.com/api/v1/locations/${LOCATION_ID}.json`;
const MACHINE_DETAILS_API = `https://pinballmap.com/api/v1/locations/${LOCATION_ID}/machine_details.json`;
const PINSIDE_SOURCE = "https://pinside.com/pinball/map/where-to-play/17578-past-times-arcade-girard-oh/";
const OPDB_TYPEAHEAD = "https://opdb.org/api/search/typeahead";
const OUTPUT = new URL("../data/games.json", import.meta.url);

function easternDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function normalizeName(name) {
  return name
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/^the\s+|,\s+the$/g, "")
    .replace(/collector'?s edition/g, "ce")
    .replace(/limited (?:rhapsody )?edition|limited version/g, "le")
    .replace(/premium edition/g, "premium")
    .replace(/special edition/g, "se")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Past-Times-Pinball-Finder/2.0",
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function readExistingCollection() {
  try {
    return JSON.parse(await readFile(OUTPUT, "utf8"));
  } catch {
    return { games: [] };
  }
}

async function lookupType(machine) {
  const url = new URL(OPDB_TYPEAHEAD);
  url.searchParams.set("q", machine.name);
  const results = await fetchJson(url);
  const exact = results.find((result) => result.id === machine.opdbId);
  if (exact?.display) return ["lights", "reels"].includes(exact.display) ? "EM" : "SS";

  if (/\(EM\)/i.test(machine.name) || machine.year < 1977) return "EM";
  return "SS";
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

try {
  const [existing, location, machineDetails] = await Promise.all([
    readExistingCollection(),
    fetchJson(LOCATION_API),
    fetchJson(MACHINE_DETAILS_API),
  ]);

  const existingById = new Map(
    existing.games
      .filter((game) => game.pinballMapId)
      .map((game) => [game.pinballMapId, game]),
  );
  const existingByNameAndYear = new Map(
    existing.games.map((game) => [`${normalizeName(game.name)}\u0001${game.year}`, game]),
  );
  const detailsById = new Map(machineDetails.machines.map((machine) => [machine.id, machine]));
  const activeMachines = location.location_machine_xrefs.filter((xref) => !xref.deleted_at);

  const games = await mapWithConcurrency(activeMachines, 8, async (xref) => {
    const details = detailsById.get(xref.machine_id);
    if (!details) throw new Error(`Missing machine details for Pinball Map machine ${xref.machine_id}`);

    const prior =
      existingById.get(xref.machine_id) ??
      existingByNameAndYear.get(`${normalizeName(details.name)}\u0001${details.year}`);
    const machine = {
      name: details.name,
      manufacturer: details.manufacturer,
      year: details.year,
      added: xref.created_at.slice(0, 10),
      pinballMapId: details.id,
      opdbId: details.opdb_id,
      ipdbId: details.ipdb_id,
    };

    return {
      name: machine.name,
      type: prior?.type ?? await lookupType(machine),
      manufacturer: machine.manufacturer,
      year: machine.year,
      added: machine.added,
      pinballMapId: machine.pinballMapId,
      opdbId: machine.opdbId,
      ipdbId: machine.ipdbId,
    };
  });

  games.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (games.length !== location.machine_count) {
    throw new Error(`Pinball Map reports ${location.machine_count} machines but returned ${games.length}`);
  }

  const payload = {
    source: PINBALL_MAP_SOURCE,
    pinsideSource: PINSIDE_SOURCE,
    sourceUpdated: location.date_last_updated,
    refreshedAt: easternDate(),
    games,
  };

  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated data/games.json with ${games.length} machines from Pinball Map.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
