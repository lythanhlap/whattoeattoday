export function formatQuantity(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

export function scaleQuantity(quantity, factor = 1) {
  if (quantity === null || quantity === undefined || factor === 1) return quantity;
  const raw = String(quantity).trim();
  const match = raw.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?$/);
  if (!match) return quantity;

  const numerator = Number(match[1].replace(',', '.'));
  const denominator = match[2] ? Number(match[2].replace(',', '.')) : 1;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return quantity;

  return formatQuantity((numerator / denominator) * factor);
}
