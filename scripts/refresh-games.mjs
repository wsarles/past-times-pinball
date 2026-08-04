import { readFile, writeFile } from "node:fs/promises";

const LOCATION_ID = 20266;
const PINBALL_MAP_SOURCE = `https://pinballmap.com/youngstown/?by_location_id=${LOCATION_ID}`;
const LOCATION_API = `https://pinballmap.com/api/v1/locations/${LOCATION_ID}.json`;
const MACHINE_DETAILS_API = `https://pinballmap.com/api/v1/locations/${LOCATION_ID}/machine_details.json`;
const PINSIDE_SOURCE = "https://pinside.com/pinball/map/where-to-play/17578-past-times-arcade-girard-oh/";
const OUTPUT = new URL("../data/games.json", import.meta.url);
const TYPE_RULES_FILE = new URL("../data/machine-types.json", import.meta.url);
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

async function readTypeRules() {
  const rules = JSON.parse(await readFile(TYPE_RULES_FILE, "utf8"));

  if (
    !Number.isInteger(rules.emThroughYear) ||
    !Number.isInteger(rules.ssFromYear) ||
    rules.emThroughYear + 1 >= rules.ssFromYear ||
    !Array.isArray(rules.transitionMachines)
  ) {
    throw new Error("data/machine-types.json has invalid cutoff years or transitionMachines.");
  }

  return rules;
}

function buildTransitionTypeMap(rules) {
  const transitionById = new Map();

  for (const entry of rules.transitionMachines) {
    if (
      !Number.isInteger(entry.pinballMapId) ||
      !Number.isInteger(entry.year) ||
      typeof entry.name !== "string" ||
      !["EM", "SS"].includes(entry.type)
    ) {
      throw new Error("data/machine-types.json contains an invalid transition machine.");
    }
    if (entry.year <= rules.emThroughYear || entry.year >= rules.ssFromYear) {
      throw new Error(
        `${entry.name} (${entry.year}) is outside the transition-year range in data/machine-types.json.`,
      );
    }
    if (transitionById.has(entry.pinballMapId)) {
      throw new Error(
        `Pinball Map machine ${entry.pinballMapId} is duplicated in data/machine-types.json.`,
      );
    }
    transitionById.set(entry.pinballMapId, entry);
  }

  return transitionById;
}

function classifyType(machine, rules, transitionById) {
  if (machine.year <= rules.emThroughYear) return "EM";
  if (machine.year >= rules.ssFromYear) return "SS";

  const entry = transitionById.get(machine.pinballMapId);
  if (!entry) {
    throw new Error(
      `No EM/SS classification for ${machine.name} (${machine.year}, Pinball Map ID ${machine.pinballMapId}). Add it to data/machine-types.json.`,
    );
  }
  if (entry.name !== machine.name || entry.year !== machine.year) {
    throw new Error(
      `The classification for Pinball Map ID ${machine.pinballMapId} is stale. Expected ${entry.name} (${entry.year}) but received ${machine.name} (${machine.year}).`,
    );
  }

  return entry.type;
}

try {
  const [location, machineDetails, typeRules] = await Promise.all([
    fetchPinballMapJson(LOCATION_API),
    fetchPinballMapJson(MACHINE_DETAILS_API),
    readTypeRules(),
  ]);

  const detailsById = new Map(machineDetails.machines.map((machine) => [machine.id, machine]));
  const transitionById = buildTransitionTypeMap(typeRules);
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
      type: classifyType(machine, typeRules, transitionById),
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
    typeClassification: {
      emThroughYear: typeRules.emThroughYear,
      ssFromYear: typeRules.ssFromYear,
      transitionFile: "data/machine-types.json",
    },
    games,
  };

  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated data/games.json with ${games.length} machines from Pinball Map.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
