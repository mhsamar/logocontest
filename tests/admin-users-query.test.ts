import { describe, expect, it } from "vitest";
import { csvCell, parseUsersQuery, toggleShow, usersHref } from "@/lib/admin/users-query";

describe("admin users filters (owner, 2026-10-12)", () => {
  it("reads the URL and falls back to the defaults", () => {
    expect(parseUsersQuery({})).toEqual({ role: "all", status: "all", show: [], q: "", sort: "newest", page: 1 });
    expect(parseUsersQuery({ role: "designer", status: "banned", show: "look,online,x", q: "  rafi  ", sort: "wins", page: "3" })).toEqual({
      role: "designer",
      status: "banned",
      show: ["online", "look"],
      q: "rafi",
      sort: "wins",
      page: 3,
    });
    expect(parseUsersQuery({ role: "boss", sort: "x", page: "-2" })).toMatchObject({ role: "all", sort: "newest", page: 1 });
  });
  it("builds links, back to page 1 when a filter changes", () => {
    const q = parseUsersQuery({ role: "client", page: "4" });
    expect(usersHref(q)).toBe("/admin/users?role=client");
    expect(usersHref(q, { page: 5 })).toBe("/admin/users?role=client&page=5");
    expect(usersHref(q, { show: toggleShow([], "strikes") })).toBe("/admin/users?role=client&show=strikes");
  });
  it("keeps spreadsheet cells safe", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell(null)).toBe('""');
  });
});
