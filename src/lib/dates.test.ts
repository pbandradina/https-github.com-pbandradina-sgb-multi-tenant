import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  countDaysInclusive,
  formatDate,
  formatRangeStr,
  getDaysInMonth,
  getFirstDayOfMonth,
  getNextMonth,
  getPreviousMonth,
  isDateInMonth,
  overlapsMonth,
  parseDateString,
  toDateString
} from "./dates";

describe("formatDate", () => {
  it("formats Date objects as YYYY-MM-DD", () => {
    expect(formatDate(new Date("2026-05-15T10:30:00Z"))).toBe("2026-05-15");
  });

  it("normalizes date strings", () => {
    expect(formatDate("2026-02-28T23:00:00Z")).toBe("2026-02-28");
  });
});

describe("toDateString", () => {
  it("uses local calendar fields and pads month and day", () => {
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toDateString(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });
});

describe("parseDateString", () => {
  it("parses at local midnight by default", () => {
    const date = parseDateString("2026-03-10");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(10);
    expect(date.getHours()).toBe(0);
  });

  it("accepts a custom time to avoid DST edges", () => {
    expect(parseDateString("2026-03-10", "T12:00:00").getHours()).toBe(12);
  });
});

describe("getDaysInMonth", () => {
  it("returns the length of regular months", () => {
    expect(getDaysInMonth(1, 2026)).toBe(31);
    expect(getDaysInMonth(4, 2026)).toBe(30);
  });

  it("handles February in leap and non-leap years", () => {
    expect(getDaysInMonth(2, 2026)).toBe(28);
    expect(getDaysInMonth(2, 2028)).toBe(29);
  });
});

describe("getFirstDayOfMonth", () => {
  it("returns the weekday index of the first day", () => {
    expect(getFirstDayOfMonth(1, 2026)).toBe(4); // 2026-01-01 is a Thursday
    expect(getFirstDayOfMonth(3, 2026)).toBe(0); // 2026-03-01 is a Sunday
  });
});

describe("buildMonthGrid", () => {
  it("pads leading blank cells until the first weekday", () => {
    const grid = buildMonthGrid(1, 2026);
    expect(grid).toHaveLength(4 + 31);
    expect(grid.slice(0, 4)).toEqual([
      { dateStr: "", dayNum: null },
      { dateStr: "", dayNum: null },
      { dateStr: "", dayNum: null },
      { dateStr: "", dayNum: null }
    ]);
    expect(grid[4]).toEqual({ dateStr: "2026-01-01", dayNum: 1 });
    expect(grid[grid.length - 1]).toEqual({ dateStr: "2026-01-31", dayNum: 31 });
  });

  it("emits no padding when the month starts on Sunday", () => {
    const grid = buildMonthGrid(3, 2026);
    expect(grid[0]).toEqual({ dateStr: "2026-03-01", dayNum: 1 });
    expect(grid).toHaveLength(31);
  });
});

describe("month navigation", () => {
  it("wraps backwards across the year boundary", () => {
    expect(getPreviousMonth(1, 2026)).toEqual({ month: 12, year: 2025 });
    expect(getPreviousMonth(7, 2026)).toEqual({ month: 6, year: 2026 });
  });

  it("wraps forwards across the year boundary", () => {
    expect(getNextMonth(12, 2026)).toEqual({ month: 1, year: 2027 });
    expect(getNextMonth(7, 2026)).toEqual({ month: 8, year: 2026 });
  });
});

describe("isDateInMonth", () => {
  it("matches only the exact month and year", () => {
    expect(isDateInMonth("2026-05-01", 5, 2026)).toBe(true);
    expect(isDateInMonth("2026-05-31", 5, 2026)).toBe(true);
    expect(isDateInMonth("2026-06-01", 5, 2026)).toBe(false);
    expect(isDateInMonth("2025-05-15", 5, 2026)).toBe(false);
  });
});

describe("countDaysInclusive", () => {
  it("counts both endpoints", () => {
    expect(countDaysInclusive("2026-05-01", "2026-05-01")).toBe(1);
    expect(countDaysInclusive("2026-05-01", "2026-05-03")).toBe(3);
  });

  it("counts across month boundaries", () => {
    expect(countDaysInclusive("2026-05-15", "2026-06-14")).toBe(31);
  });
});

describe("overlapsMonth", () => {
  it("detects periods that partially cover the month", () => {
    expect(overlapsMonth("2026-04-28", "2026-05-02", 5, 2026)).toBe(true);
    expect(overlapsMonth("2026-05-30", "2026-06-10", 5, 2026)).toBe(true);
    expect(overlapsMonth("2026-01-01", "2026-12-31", 5, 2026)).toBe(true);
  });

  it("rejects periods entirely outside the month", () => {
    expect(overlapsMonth("2026-03-01", "2026-04-30", 5, 2026)).toBe(false);
    expect(overlapsMonth("2026-06-01", "2026-06-10", 5, 2026)).toBe(false);
  });
});

describe("formatRangeStr", () => {
  it("renders a short Brazilian day/month range", () => {
    expect(formatRangeStr("2026-01-05", "2026-02-12")).toBe("05JAN a 12FEV");
    expect(formatRangeStr("2026-12-31", "2026-12-31")).toBe("31DEZ a 31DEZ");
  });
});
