export function localDate(date?: Date): string;
export function isoDate(value: string): string;
export function comparisonPeriods<T extends { data: string }>(
  current: T[],
  previous: T[],
  month: string,
  today?: string,
): {
  available: boolean;
  isCurrent: boolean;
  current: T[];
  previous: T[];
  currentThrough: string | null;
  previousThrough: string | null;
};
