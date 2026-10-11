import { describe, expect, it } from "vitest";
import { cleanDriveUrl, isLinkType } from "@/lib/handover/options";

describe("AI and EPS as Google Drive links (owner, 2026-10-11)", () => {
  it("only AI and EPS are links; the other four are uploaded", () => {
    expect(isLinkType("ai")).toBe(true);
    expect(isLinkType("eps")).toBe(true);
    for (const t of ["svg", "pdf", "png", "jpg", "extra"] as const) expect(isLinkType(t)).toBe(false);
  });
  it("accepts Google Drive and Docs links", () => {
    expect(cleanDriveUrl(" https://drive.google.com/file/d/1AbC/view?usp=sharing ")).toBe("https://drive.google.com/file/d/1AbC/view?usp=sharing");
    expect(cleanDriveUrl("https://drive.google.com/drive/folders/1AbC")).toBe("https://drive.google.com/drive/folders/1AbC");
    expect(cleanDriveUrl("https://docs.google.com/uc?id=1AbC")).toBe("https://docs.google.com/uc?id=1AbC");
  });
  it("rejects other sites, http, look-alikes and empty links", () => {
    expect(cleanDriveUrl("")).toBeNull();
    expect(cleanDriveUrl("http://drive.google.com/file/d/1AbC/view")).toBeNull();
    expect(cleanDriveUrl("https://dropbox.com/s/abc")).toBeNull();
    expect(cleanDriveUrl("https://drive.google.com.evil.com/file/d/1")).toBeNull();
    expect(cleanDriveUrl("https://user@drive.google.com/file/d/1")).toBeNull();
    expect(cleanDriveUrl("https://drive.google.com/")).toBeNull();
    expect(cleanDriveUrl("drive.google.com/file/d/1")).toBeNull();
    expect(cleanDriveUrl(`https://drive.google.com/file/d/${"a".repeat(500)}`)).toBeNull();
  });
});
