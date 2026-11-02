import { describe, expect, it } from "vitest";
import { folderOf, isDriveFolderUrl, KEEP_DAYS } from "@/lib/handover/options";

// Owner, 2026-11-02: every final file in one Google Drive folder, kept at least a month.

describe("final files in one Drive folder", () => {
  it("only a Drive folder link counts", () => {
    expect(isDriveFolderUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp")).toBe(true);
    expect(isDriveFolderUrl("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOp?usp=sharing")).toBe(true);
    expect(isDriveFolderUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view")).toBe(false);
    expect(isDriveFolderUrl("https://evil.com/drive/folders/1AbCdEfGhIjKlMnOp")).toBe(false);
    expect(KEEP_DAYS).toBeGreaterThanOrEqual(30);
  });

  it("a delivery is one folder when every file is that same folder", () => {
    const f = "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp";
    expect(folderOf([{ type: "ai", link: f }, { type: "png", link: f }])).toBe(f);
    expect(folderOf([{ type: "ai", link: f }, { type: "png", link: null }])).toBeNull();
    expect(folderOf([{ type: "ai", link: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view" }])).toBeNull();
    expect(folderOf([])).toBeNull();
  });
});
