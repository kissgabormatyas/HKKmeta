export function aggregateCostCurve(cards, valueKey, costKey) {
  const counts = new Map();
  const missing = [];
  let missingValue = 0;
  let total = 0;
  for (const card of cards) {
    const value = Number(card[valueKey]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const cost = card.costSummary?.[costKey];
    if (cost !== "X" && !(typeof cost === "number" && Number.isFinite(cost) && cost >= 0)) {
      missing.push(card.name || card.Lap);
      missingValue += value;
      continue;
    }
    counts.set(cost, (counts.get(cost) || 0) + value);
    total += value;
  }

  // Keep empty numeric bins so distances on the cost axis remain meaningful.
  const numbers = [...counts.keys()].filter((cost) => typeof cost === "number");
  const step = costKey === "mana" ? 0.5 : 1;
  const maximum = numbers.length ? Math.max(...numbers) : -1;
  for (let cost = 0; cost <= maximum; cost += step) {
    if (!counts.has(cost)) counts.set(cost, 0);
  }
  const entries = [...counts].sort(([a], [b]) => a === "X" ? 1 : b === "X" ? -1 : a - b);
  return {
    labels: entries.map(([cost]) => String(cost).replace(".", ",")),
    values: entries.map(([, value]) => value),
    total,
    missing,
    missingValue
  };
}
