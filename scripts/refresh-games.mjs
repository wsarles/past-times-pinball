import { writeFile } from "node:fs/promises";
import {
  CROSSOVER_DEFAULTS,
  CROSSOVER_EXCEPTIONS,
  EM_THROUGH_YEAR,
  SS_FROM_YEAR,
} from "../data/em-ss-crossover.mjs";

const LOCATION_ID = 20266;
const PINBALL_MAP_SOURCE = `https://pinballmap.com/youngstown/?by_location_id=${LOCATION_ID}`;
const LOCATION_API = `https://pinballmap.com/api/v1/locations/${LOCATION_ID}.json`;
const MACHINE_DETAILS_API = `https://pinballmap.com/api/v1/locations/${LOCATION_ID}/machine_details.json`;
const PINSIDE_SOURCE = "https://pinside.com/pinball/map/where-to-play/17578-past-times-arcade-girard-oh/";
const OUTPUT = new URL("../data/games.json", import.meta.url);
const PINBALL_MAP_API_TOKEN = process.env.PINBALL_MAP_API_TOKEN?.trim();

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

async function fetchPinballMapJson(url) {
  if (!PINBALL_MAP_API_TOKEN) {
    throw new Error(
      "PINBALL_MAP_API_TOKEN is required. Add it to your environment or GitHub Actions secrets.",
    );
  }

  const requestUrl = new URL(url);
  requestUrl.searchParams.set("api_token", PINBALL_MAP_API_TOKEN);

  const response = await fetch(requestUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "Past-Times-Pinball-Finder/3.0",
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function classifyType(machine) {
  if (machine.year <= EM_THROUGH_YEAR) return "EM";
  if (machine.year >= SS_FROM_YEAR) return "SS";

  const defaultType = CROSSOVER_DEFAULTS[machine.year];
  if (!defaultType) {
    throw new Error(`No EM/SS crossover default for ${machine.year}.`);
  }

  return CROSSOVER_EXCEPTIONS.get(machine.pinballMapId) ?? defaultType;
}

function machineComments(xref) {
  const comments = xref.sorted_machine_conditions ?? xref.machine_conditions ?? [];

  return comments
    .filter((entry) => entry.comment?.trim())
    .map((entry) => ({
      comment: entry.comment.trim(),
      createdAt: entry.created_at,
      username: entry.username || null,
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

try {
  const [location, machineDetails] = await Promise.all([
    fetchPinballMapJson(LOCATION_API),
    fetchPinballMapJson(MACHINE_DETAILS_API),
  ]);

  const detailsById = new Map(machineDetails.machines.map((machine) => [machine.id, machine]));
  const activeMachines = location.location_machine_xrefs.filter((xref) => !xref.deleted_at);

  const games = activeMachines.map((xref) => {
    const details = detailsById.get(xref.machine_id);
    if (!details) throw new Error(`Missing machine details for Pinball Map machine ${xref.machine_id}`);

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
      type: classifyType(machine),
      manufacturer: machine.manufacturer,
      year: machine.year,
      added: machine.added,
      pinballMapId: machine.pinballMapId,
      opdbId: machine.opdbId,
      ipdbId: machine.ipdbId,
      comments: machineComments(xref),
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
    typeClassification: {
      emThroughYear: EM_THROUGH_YEAR,
      ssFromYear: SS_FROM_YEAR,
      crossoverRulesFile: "data/em-ss-crossover.mjs",
    },
    games,
  };

  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated data/games.json with ${games.length} machines from Pinball Map.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
