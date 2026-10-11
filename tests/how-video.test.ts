import { describe, expect, it } from "vitest";
import { embedUrl, howVideoSchema, parseVideoUrl } from "@/lib/home/how-video";

describe("How it works video links", () => {
  it("reads YouTube links", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "https://youtu.be/dQw4w9WgXcQ",
      "youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      const v = parseVideoUrl(link);
      expect(v, link).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ" });
      expect(howVideoSchema.safeParse(v).success, link).toBe(true);
    }
  });

  it("reads Vimeo links, with the private hash of unlisted videos", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")).toMatchObject({ kind: "vimeo", id: "76979871", hash: "" });
    expect(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")).toMatchObject({ kind: "vimeo", id: "76979871", hash: "8272103f6e" });
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")).toMatchObject({ kind: "vimeo", id: "76979871", hash: "8272103f6e" });
    expect(parseVideoUrl("https://vimeo.com/channels/staffpicks/76979871")).toMatchObject({ kind: "vimeo", id: "76979871" });
    expect(howVideoSchema.safeParse(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")).success).toBe(true);
  });

  it("refuses anything else", () => {
    for (const link of [
      "",
      "hello",
      "https://example.com/video.mp4",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/@channel",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "https://vimeo.com/about",
      "https://player.vimeo.com/76979871",
      '"><script>alert(1)</script>',
    ]) {
      expect(parseVideoUrl(link), link).toBeNull();
    }
  });

  it("builds privacy-friendly embed links that start muted", () => {
    const yt = embedUrl({ url: "https://youtu.be/dQw4w9WgXcQ", kind: "youtube", id: "dQw4w9WgXcQ", hash: "" }, { autoplay: true, muted: true })!;
    expect(yt).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    expect(yt).toContain("autoplay=1");
    expect(yt).toContain("mute=1");
    expect(yt).toContain("playsinline=1");
    expect(yt).toContain("rel=0");
    const vm = embedUrl({ url: "https://vimeo.com/1/abc", kind: "vimeo", id: "76979871", hash: "8272103f6e" }, { autoplay: true, muted: true })!;
    expect(vm).toMatch(/^https:\/\/player\.vimeo\.com\/video\/76979871\?/);
    expect(vm).toContain("muted=1");
    expect(vm).toContain("dnt=1");
    expect(vm).toContain("h=8272103f6e");
    expect(embedUrl({ url: "", kind: "", id: "", hash: "" }, { autoplay: true, muted: true })).toBeNull();
  });
});
