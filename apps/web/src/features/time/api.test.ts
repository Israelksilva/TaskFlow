import { describe, expect, it } from "vitest";
import { formatClock, formatDuration } from "./api";

describe("formatação de tempo", () => {
  it("formata durações legíveis", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(45 * 60)).toBe("45min");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(5400)).toBe("1h 30min");
    expect(formatDuration(-5)).toBe("0s");
  });

  it("formata o relógio do cronômetro", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(3725.9)).toBe("01:02:05");
  });
});
