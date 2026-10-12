import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import Papa from "papaparse";
import { calculateCardCost, createCostIndex } from "../lib/card-costs.js";
import { aggregateCostCurve } from "../public/cost-curves.js";

test("fixed costs: mana, half shards, all other resources and explicit zero", () => {
  assert.deepEqual(calculateCardCost({ cost: { mana: 2, zanszilank: 3, nekron: 4, builder: 1, szk: 2 } }), { mana: 3.5, total: 12 });
  assert.deepEqual(calculateCardCost({ cost: { nekron: 2, builder: 3, szk: 1 } }), { mana: 0, total: 6 });
  assert.deepEqual(calculateCardCost({ cost: { mana: 0 } }), { mana: 0, total: 0 });
  assert.deepEqual(calculateCardCost({ noCost: true }), { mana: 0, total: 0 });
});

test("the entire X or ? component becomes one before weighting", () => {
  for (const expression of ["X", "4-X", "X+2", "?"]) {
    assert.deepEqual(calculateCardCost({ cost: { mana: expression } }), { mana: 1, total: "X" });
    assert.deepEqual(calculateCardCost({ cost: { zanszilank: expression } }), { mana: 0.5, total: "X" });
  }
  assert.deepEqual(calculateCardCost({ cost: { mana: "X", zanszilank: 1 } }), { mana: 1.5, total: "X" });
  assert.deepEqual(calculateCardCost({ cost: { mana: 2, nekron: "X" } }), { mana: 2, total: "X" });
});

test("missing and malformed costs never become zero", () => {
  for (const record of [null, {}, { cost: {} }, { cost: { mana: -1 } }, { cost: { mana: null } }]) {
    assert.deepEqual(calculateCardCost(record), { mana: null, total: null });
  }
  assert.deepEqual(calculateCardCost({ variableCost: true }), { mana: null, total: "X" });
  assert.deepEqual(calculateCardCost({ variableCost: true, cost: { mana: 2 } }), { mana: null, total: "X" });
});

test("supplements join by ID and do not replace completed source records", () => {
  const index = createCostIndex([{ id: 1, variableCost: true }, { id: 2, cost: { mana: 3 } }], [
    { id: 1, cost: { zanszilank: "X" } }, { id: 2, cost: { mana: 4 } }, { id: 3, cost: { mana: 0 } }
  ]);
  assert.equal(calculateCardCost(index.get(1)).mana, 0.5);
  assert.equal(calculateCardCost(index.get(2)).mana, 3);
  assert.equal(calculateCardCost(index.get(3)).total, 0);
  assert.throws(() => createCostIndex([{ id: 1 }, { id: 1 }]));
});

test("curves use metric weights, numeric ordering, empty bins and a final X bin", () => {
  const result = aggregateCostCurve([
    { costSummary: { total: 10 }, TOP: 1.25 },
    { costSummary: { total: 2 }, TOP: 3.5 },
    { costSummary: { total: "X" }, TOP: 2 },
    { costSummary: { total: 2 }, TOP: 0.5 },
    { name: "Missing", TOP: 7 },
    { name: "Zero", TOP: 0 }
  ], "TOP", "total");
  assert.deepEqual(result.labels, ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "X"]);
  assert.equal(result.values[2], 4);
  assert.equal(result.total, 7.25);
  assert.deepEqual(result.missing, ["Missing"]);
  assert.equal(result.missingValue, 7);
  assert.deepEqual(aggregateCostCurve([], "TOP", "mana").labels, []);
  assert.deepEqual(aggregateCostCurve([{ costSummary: { mana: 1.5 }, SUM: 2 }], "SUM", "mana").labels, ["0", "0,5", "1", "1,5"]);
});

const readJson = (name) => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const metadata = readJson("cards.json");
const index = createCostIndex(readJson("cards_2023-2026.json").cards, readJson("card-cost-supplements.json").cards);
const frontend = fs.readFileSync(new URL("../public/script.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/m, "").split("\nsetupViewNavigation();")[0];
const context = vm.createContext({ Chart: { register() {}, defaults: { font: {} } }, ChartDataLabels: {} });
vm.runInContext(`${frontend}\nthis.filterCards = getSelectedCards; this.filterState = state.filter;`, context);

for (const format of ["classic", "tm"]) {
  test(`${format}: all report rows join with costs; each filter and metric conserves totals`, () => {
    const rows = Papa.parse(fs.readFileSync(new URL(`../data/topcards-${format}.csv`, import.meta.url), "utf8"), { header: true, skipEmptyLines: true }).data;
    const cards = rows.map((row) => {
      const match = metadata.find((card) => card.name.toLowerCase() === row.Lap.toLowerCase());
      assert.ok(match, row.Lap);
      const costSummary = calculateCardCost(index.get(match.ID));
      assert.notEqual(costSummary.mana, null, row.Lap);
      assert.notEqual(costSummary.total, null, row.Lap);
      const main = Number(row["Főpakli összesen"]);
      const side = Number(row["Side összesen"]);
      return { ...row, ...match, costSummary, flag: match.flags || [], icons: match.type,
        "Főpakli összesen": main, "Side összesen": side, SUM: main + side,
        TOP: main * Number(row["Főpakli top%"].replace("%", "")) / 100 };
    });
    for (const colors of [[], ["Rhatt"], ["Rhatt", "Elenios"]]) {
      for (const flag of ["Összes", "reakció"]) {
        for (const icon of ["Összes", "ősmágia", "nonexistent"]) {
          Object.assign(context.filterState, { selectedColors: colors, selectedFlag: flag, selectedIcon: icon });
          const selected = context.filterCards(cards);
          const expected = cards.filter((c) => (!colors.length || colors.some((color) => c.color.includes(color)))
            && (flag === "Összes" || c.flag.includes(flag)) && (icon === "Összes" || c.icons.includes(icon)));
          assert.deepEqual(Array.from(selected, (c) => c.ID), expected.map((c) => c.ID));
          for (const metric of ["Főpakli összesen", "Side összesen", "SUM", "TOP"]) {
            for (const key of ["mana", "total"]) {
              const curve = aggregateCostCurve(selected, metric, key);
              assert.equal(curve.missing.length, 0);
              assert.ok(Math.abs(curve.values.reduce((a, b) => a + b, 0) - expected.reduce((sum, c) => sum + c[metric], 0)) < 1e-8);
            }
          }
        }
      }
    }
  });
}
