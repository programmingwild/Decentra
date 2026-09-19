import { describe, expect, it } from "vitest";
import {
  msToClock,
  msToDuration,
  fmtDateLong,
  humanizeKey,
  fmtDeadline,
  parseDeadline,
  initials,
  speakerColor,
  dayGroup,
} from "./format";

describe("msToClock", () => {
  it("formats seconds and minutes", () => {
    expect(msToClock(0)).toBe("0:00");
    expect(msToClock(42_170)).toBe("0:42");
    expect(msToClock(2_541_000)).toBe("42:21");
  });
  it("adds hours past one hour and clamps negatives", () => {
    expect(msToClock(3_723_000)).toBe("1:02:03");
    expect(msToClock(-500)).toBe("0:00");
  });
});

describe("msToDuration", () => {
  it("handles empty and minute/hour ranges", () => {
    expect(msToDuration(null)).toBe("—");
    expect(msToDuration(0)).toBe("—");
    expect(msToDuration(2_880_000)).toBe("48 min");
    expect(msToDuration(5_400_000)).toBe("1h 30m");
  });
});

describe("parseDeadline", () => {
  const from = new Date(2026, 8, 5); // Sat Sep 5 2026 local
  it("returns null for empty or ambiguous input", () => {
    expect(parseDeadline(null)).toBeNull();
    expect(parseDeadline("")).toBeNull();
    expect(parseDeadline("sometime soon")).toBeNull();
  });
  it("parses ISO dates", () => {
    expect(parseDeadline("2026-09-11", from)?.getDate()).toBe(11);
  });
  it("parses relative words", () => {
    expect(parseDeadline("tomorrow", from)?.getDate()).toBe(6);
    expect(parseDeadline("friday", from)?.getDay()).toBe(5);
  });
});

describe("fmtDateLong", () => {
  it("formats locale-stable long dates and blanks", () => {
    expect(fmtDateLong("2026-08-24")).toBe("Aug 24, 2026");
    expect(fmtDateLong(null)).toBe("");
    expect(fmtDateLong("not-a-date")).toBe("");
  });
});

describe("humanizeKey", () => {
  it("turns enum keys into formal labels", () => {
    expect(humanizeKey("due_soon")).toBe("Due Soon");
    expect(humanizeKey("completed")).toBe("Completed");
    expect(humanizeKey("decision.confirmed")).toBe("Decision Confirmed");
    expect(humanizeKey("TRANSCRIPT_DERIVED")).toBe("Transcript Derived");
    expect(humanizeKey(null)).toBe("");
  });
});

describe("fmtDeadline", () => {
  it("labels overdue, today and missing", () => {
    expect(fmtDeadline(null)).toMatchObject({ due: null, overdue: false });
    expect(fmtDeadline("2000-01-01").overdue).toBe(true);
  });
});

describe("dayGroup", () => {
  it("handles null and today", () => {
    expect(dayGroup(null)).toBe("UNDATED");
    expect(dayGroup(new Date())).toBe("Today");
  });
});

describe("initials + speakerColor", () => {
  it("derives initials deterministically", () => {
    expect(initials("Arun Kumar")).toBe("AK");
    expect(initials("x")).toBe("X");
    expect(initials(null)).toBe("?");
  });
  it("assigns stable colors per speaker", () => {
    expect(speakerColor("Rahul")).toEqual(speakerColor("Rahul"));
    expect(speakerColor(null).fg).toBeTruthy();
  });
});
