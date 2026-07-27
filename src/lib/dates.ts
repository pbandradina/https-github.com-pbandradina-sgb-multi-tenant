// Date helpers shared by the operational modules.
// All date strings use the ISO "YYYY-MM-DD" format persisted in the database.

export const MS_IN_DAY = 24 * 60 * 60 * 1000;

export const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" }
];

export const MESES_ABREVIADOS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

export function formatDate(d: Date | string): string {
  return new Date(d).toISOString().split("T")[0];
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateString(dateStr: string, time = "T00:00:00"): Date {
  return new Date(dateStr + time);
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function getFirstDayOfMonth(month: number, year: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export interface MonthGridCell {
  dateStr: string;
  dayNum: number | null;
}

export function buildMonthGrid(month: number, year: number): MonthGridCell[] {
  const grid: MonthGridCell[] = [];
  for (let i = 0; i < getFirstDayOfMonth(month, year); i++) {
    grid.push({ dateStr: "", dayNum: null });
  }
  for (let day = 1; day <= getDaysInMonth(month, year); day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    grid.push({ dateStr, dayNum: day });
  }
  return grid;
}

export function getPreviousMonth(month: number, year: number): { month: number; year: number } {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export function getNextMonth(month: number, year: number): { month: number; year: number } {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

export function isDateInMonth(dateStr: string, month: number, year: number): boolean {
  const date = parseDateString(dateStr);
  return date.getMonth() + 1 === month && date.getFullYear() === year;
}

// Inclusive number of days covered by a period, e.g. 01→03 counts as 3 days.
export function countDaysInclusive(startStr: string, endStr: string): number {
  const start = parseDateString(startStr);
  const end = parseDateString(endStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / MS_IN_DAY) + 1;
}

export function overlapsMonth(startStr: string, endStr: string, month: number, year: number): boolean {
  const start = parseDateString(startStr);
  const end = parseDateString(endStr);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  return start <= monthEnd && end >= monthStart;
}

// "05JAN a 12FEV" style label used on FMO cycle cards.
export function formatRangeStr(startStr: string, endStr: string): string {
  const start = parseDateString(startStr, "T12:00:00");
  const end = parseDateString(endStr, "T12:00:00");
  const startDay = String(start.getDate()).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");
  return `${startDay}${MESES_ABREVIADOS[start.getMonth()]} a ${endDay}${MESES_ABREVIADOS[end.getMonth()]}`;
}
