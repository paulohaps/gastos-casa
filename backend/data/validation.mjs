import { moneyCents } from '../settlements/calculator.mjs';
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validAmount(value) {
  try { const amount = moneyCents(value); return amount > 0 && amount <= 999999999999; } catch { return false; }
}
