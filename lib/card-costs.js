const VARIABLE = /[xX?]/;

// Collapse the entire variable component (e.g. 4-X), not just X itself.
export function calculateCardCost(record) {
  if (!record) return { mana: null, total: null };
  if (record.noCost) return { mana: 0, total: 0 };

  const entries = Object.entries(record.cost || {});
  const variable = record.variableCost === true || entries.some(([, value]) => VARIABLE.test(String(value)));
  if (!entries.length) return { mana: null, total: variable ? "X" : null };

  let mana = 0;
  let total = 0;
  let hasVariableComponent = false;
  for (const [type, raw] of entries) {
    const isVariable = typeof raw === "string" && VARIABLE.test(raw);
    const value = isVariable ? 1 : raw;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return { mana: null, total: variable ? "X" : null };
    }
    hasVariableComponent ||= isVariable;
    mana += value * (type === "mana" ? 1 : type === "zanszilank" ? 0.5 : 0);
    total += value;
  }

  // A variable flag without its typed expression cannot establish a mana cost.
  return { mana: variable && !hasVariableComponent ? null : mana, total: variable ? "X" : total };
}

export function createCostIndex(records, supplements = []) {
  const index = new Map();
  for (const record of records) {
    const id = Number(record.id);
    if (!Number.isSafeInteger(id) || index.has(id)) throw new Error(`Hibás vagy ismétlődő költségazonosító: ${record.id}`);
    index.set(id, record);
  }
  for (const supplement of supplements) {
    const id = Number(supplement.id);
    const original = index.get(id);
    // Prefer a subsequently completed user dataset over the review supplement.
    if (!original || (!original.noCost && !Object.keys(original.cost || {}).length)) {
      index.set(id, { ...original, ...supplement });
    }
  }
  return index;
}
