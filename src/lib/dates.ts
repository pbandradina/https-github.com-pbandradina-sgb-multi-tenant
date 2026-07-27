export const MESES_BR = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const MESES_BR_ABREV = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

export const MESES_OPTIONS = MESES_BR.map((label, index) => ({ value: index + 1, label }));

export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Converts a Date (or date-like string) into the canonical "YYYY-MM-DD" key. */
export const toDateKey = (d: Date | string): string => new Date(d).toISOString().split("T")[0];

/** "YYYY-MM-DD" key built from the local calendar fields, without timezone drift. */
export const toLocalDateKey = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const todayKey = (): string => toDateKey(new Date());

/** Parses a "YYYY-MM-DD" key as a local date, defaulting to midday to avoid DST edges. */
export const parseDateKey = (key: string, time = "12:00:00"): Date => new Date(`${key}T${time}`);

export const buildDateKey = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const formatDateBR = (
  value: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const date = typeof value === "string" ? parseDateKey(value) : value;
  return date.toLocaleDateString("pt-BR", options);
};

/** Inclusive check of a date key against a "YYYY-MM-DD" range (keys sort lexicographically). */
export const isDateKeyInRange = (key: string, start: string, end: string): boolean =>
  key >= start && key <= end;

/** Inclusive day count of a "YYYY-MM-DD" range. */
export const countDaysInRange = (start: string, end: string): number => {
  const diff = Math.abs(parseDateKey(end).getTime() - parseDateKey(start).getTime());
  return Math.ceil(diff / MS_POR_DIA) + 1;
};

export const getDaysInMonth = (month: number, year: number): number => new Date(year, month, 0).getDate();

/** Weekday index (0 = Sunday) of the first day of the given month. */
export const getFirstWeekdayOfMonth = (month: number, year: number): number =>
  new Date(year, month - 1, 1).getDay();

export const isDateKeyInMonth = (key: string, month: number, year: number): boolean => {
  const d = parseDateKey(key);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
};

/** Formats a range as "01JAN a 09JAN". */
export const formatDateRangeAbrev = (startKey: string, endKey: string): string => {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const startDay = String(start.getDate()).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");
  return `${startDay}${MESES_BR_ABREV[start.getMonth()]} a ${endDay}${MESES_BR_ABREV[end.getMonth()]}`;
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
