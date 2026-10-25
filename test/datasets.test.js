import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import Papa from "papaparse";

let server;
let baseUrl;
const metadata = JSON.parse(readFileSync(new URL("../data/cards.json", import.meta.url), "utf8"));
const normalizedName = (name) => name.replace(/\(epikus\)/g, "").trim().toLowerCase();
before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: "0" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  baseUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Test server did not start")), 15000);
    server.once("error", reject);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Test server exited: ${code}\n${output}`));
    });
    server.stderr.on("data", (chunk) => { output += chunk; });
    server.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Server running on port (\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
  });
});
after(() => server?.kill());

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200);
  return response.json();
}

for (const dataset of ["period", "nationals-2026"]) {
  for (const format of ["classic", "tm"]) {
    test(`${dataset}/${format}: API selects the correct CSVs and preserves metric calculations`, async () => {
      const query = `format=${format}&dataset=${dataset}`;
      const info = await get(`/api/format-info?${query}`);
      assert.equal(info.period, dataset === "nationals-2026" ? "2026 Nemzeti Bajnokság"
        : format === "classic" ? "2026.06.15 - 2026.10.25." : "2026.08.01 - 2026.10.25.");
      for (const [prefix, endpoint] of [["topcards", "cards"], ["orange", "orange-cards"]]) {
        const suffix = dataset === "period" ? format : `2026${format}`;
        const csv = readFileSync(new URL(`../data/${prefix}-${suffix}.csv`, import.meta.url), "utf8");
        const rows = Papa.parse(csv, { header: true, skipEmptyLines: true }).data.filter((row) => {
          if (prefix === "orange") return true;
          const card = metadata.find((item) => normalizedName(item.name) === normalizedName(row.Lap));
          // The existing TOP100 view excludes followers and rules, which have their own view.
          return !card?.type?.some((type) => /követő|szabálylap/i.test(type));
        });
        const cards = await get(`/api/${endpoint}?${query}`);
        assert.equal(cards.length, rows.length);
        for (const [i, card] of cards.entries()) {
          const row = rows[i];
          assert.equal(card.Lap, row.Lap);
          assert.ok(card.ID, `Missing metadata: ${row.Lap}`);
          const main = Number(row["Főpakli összesen"]);
          const side = Number(row["Side összesen"]);
          assert.equal(card["Főpakli összesen"], main);
          assert.equal(card["Side összesen"], side);
          assert.equal(card.SUM, main + side);
          assert.equal(card.TOP, main * (Number(row["Főpakli top%"].replace("%", "")) / 100));
        }
      }
    });
  }
}

test("existing API URLs and invalid selections fall back to the regular classic dataset", async () => {
  for (const endpoint of ["format-info", "cards", "orange-cards"]) {
    const expected = await get(`/api/${endpoint}?format=classic&dataset=period`);
    assert.deepEqual(await get(`/api/${endpoint}`), expected);
    assert.deepEqual(await get(`/api/${endpoint}?format=unknown&dataset=unknown`), expected);
    assert.deepEqual(await get(`/api/${endpoint}?format=toString&dataset=constructor`), expected);
  }
});
