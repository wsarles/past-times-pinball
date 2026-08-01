import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const SOURCE = "https://pinside.com/pinball/map/where-to-play/17578-past-times-arcade-girard-oh/";
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

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function toText(raw) {
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return decodeEntities(
    raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<(?:br|\/p|\/div|\/li|\/a|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function parseGames(raw) {
  const text = toText(raw).replace(/\r/g, "").replace(/\u00a0/g, " ");
  const lines = text.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const games = [];
  const metadata = /^(EM|SS)\s+(.+),\s+(\d{4})\s+-\s+Added on\s+(\d{4}-\d{2}-\d{2})/;
  const junk = /^(image|photo:|games list|there are|last updated|sign in|view biz|past times arcade)$/i;

  for (let index = 1; index < lines.length; index += 1) {
    const match = lines[index].match(metadata);
    if (!match) continue;

    let titleIndex = index - 1;
    while (titleIndex >= 0 && junk.test(lines[titleIndex])) titleIndex -= 1;
    const name = lines[titleIndex]?.replace(/^Image:\s*/i, "").trim();
    if (!name) continue;

    games.push({
      name,
      type: match[1],
      manufacturer: match[2].trim(),
      year: Number(match[3]),
      added: match[4],
    });
  }

  const unique = [...new Map(games.map((game) => [`${game.name}\u0001${game.type}\u0001${game.manufacturer}\u0001${game.year}`, game])).values()];
  return unique.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

async function readSource(argument) {
  if (argument === "-") {
    let input = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) input += chunk;
    return input;
  }
  if (argument) return readFile(argument, "utf8");

  const response = await fetch(SOURCE, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 Past-Times-Pinball-Finder/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Pinside returned ${response.status}. Copy the page, then run: pbpaste | npm run refresh -- -`);
  }
  return response.text();
}

try {
  const raw = await readSource(process.argv[2]);
  const games = parseGames(raw);
  if (games.length < 300) throw new Error(`Only found ${games.length} machines; refusing to replace the current list.`);

  const updated = raw.match(/Last updated on\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ?? easternDate();
  const payload = {
    source: SOURCE,
    sourceUpdated: updated,
    refreshedAt: easternDate(),
    games,
  };

  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated data/games.json with ${games.length} machines.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
