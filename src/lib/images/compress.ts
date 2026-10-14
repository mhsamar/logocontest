/**
 * Every picture people upload is made light in the browser first (owner, 2026-10-14): a photo of any size goes in, a
 * small file comes out, without a visible loss. The long side is brought down to `maxSide`, it is saved as WebP (or
 * JPEG where a storage place takes only JPEG, or the browser can't write WebP), and the quality only steps down while
 * the file is still above `targetKb`. A picture that is already small and fine is sent as it is. Final design files
 * (handover) never come here: the client gets exactly what the designer made.
 */

export type ImageOut = "image/webp" | "image/jpeg";

export type CompressOptions = {
  /** Longest side in pixels. */
  maxSide: number;
  /** Aim for at most this many KB. */
  targetKb: number;
  /** The formats this upload place accepts, best first. */
  out?: ImageOut[];
  /** Never go below this quality (0–1). */
  minQuality?: number;
};

/** Pictures the browser can usually draw (HEIC only on Apple devices). SVG and GIF are left as they are. */
const DRAWABLE = /^image\/(jpeg|png|webp|heic|heif|bmp|avif)$/;
const SENDABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export const isCompressible = (file: { type: string; name: string }) => DRAWABLE.test(file.type) || /\.(heic|heif)$/i.test(file.name);

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void } | null> {
  try {
    // Phone photos turned the right way up (EXIF orientation).
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  }
}

const encode = (canvas: HTMLCanvasElement, type: ImageOut, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const QUALITIES = [0.86, 0.8, 0.74, 0.68, 0.62];

/** The picture made light, or the original file when it can't be drawn (the server still checks it) or is already fine. */
export async function compressImage(file: File, opts: CompressOptions): Promise<File> {
  if (!isCompressible(file)) return file;
  const out = opts.out ?? ["image/webp", "image/jpeg"];
  const minQuality = opts.minQuality ?? 0.62;
  const target = opts.targetKb * 1024;
  const pic = await decode(file);
  if (!pic) return file;
  try {
    const longest = Math.max(pic.width, pic.height);
    // Already small, the right size and a format this place takes: nothing to do.
    if (file.size <= target && longest <= opts.maxSide && SENDABLE.has(file.type) && (out as string[]).includes(file.type)) return file;

    let side = Math.min(opts.maxSide, longest);
    for (let round = 0; round < 4; round++) {
      const scale = side / longest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(pic.width * scale));
      canvas.height = Math.max(1, Math.round(pic.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      let best: Blob | null = null;
      for (const type of out) {
        // JPEG has no see-through parts: white behind them.
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (type === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(pic.source, 0, 0, canvas.width, canvas.height);
        for (const q of QUALITIES.filter((x) => x >= minQuality)) {
          const blob = await encode(canvas, type, q);
          // A browser that can't write this format hands back PNG instead: try the next format.
          if (!blob || blob.type !== type) break;
          best = blob;
          if (blob.size <= target) break;
        }
        if (best) break;
      }
      if (!best) return file;
      if (best.size <= target || round === 3) {
        // Never send something bigger than what was picked, when that one could be sent as it is.
        if (best.size >= file.size && SENDABLE.has(file.type) && (out as string[]).includes(file.type) && longest <= opts.maxSide) return file;
        const ext = best.type === "image/webp" ? "webp" : "jpg";
        return new File([best], `${file.name.replace(/\.[a-z0-9]+$/i, "") || "image"}.${ext}`, { type: best.type, lastModified: Date.now() });
      }
      side = Math.round(side * 0.8);
    }
    return file;
  } finally {
    pic.close();
  }
}

/** The usual settings for each kind of upload. */
export const COMPRESS = {
  /** Payment screenshots, report evidence: readable text, small file. */
  screenshot: { maxSide: 1600, targetKb: 350 },
  /** Brief examples, portfolio, chat pictures, logo checks. */
  picture: { maxSide: 2000, targetKb: 600 },
  /** Site pictures set by an admin. */
  site: { maxSide: 2400, targetKb: 900 },
} satisfies Record<string, CompressOptions>;
