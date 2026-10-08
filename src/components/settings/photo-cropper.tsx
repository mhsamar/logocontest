"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/client";

const OUTPUT = 512; // profile photos are stored as 512×512

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

/** Crops and resizes in the browser, so an image of any size uploads as a square file of `output` px. */
export async function cropToBlob(src: string, area: Area, output = OUTPUT, quality = 0.9): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = output;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, output, output);
  const as = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  // WebP where the browser can make it, otherwise JPEG.
  const webp = await as("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await as("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

export function PhotoCropper({ src, onCancel, onSave, saving }: { src: string | null; onCancel: () => void; onSave: (area: Area) => void; saving: boolean }) {
  const { t } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <Modal
      open={src !== null}
      onClose={onCancel}
      title={t("settings.photo.cropTitle")}
      closeLabel={t("common.close")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => area && onSave(area)} loading={saving} disabled={!area}>
            {t("settings.photo.save")}
          </Button>
        </div>
      }
    >
      {src && (
        <div>
          <div className="relative h-72 overflow-hidden rounded-lg bg-ink sm:h-80">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-muted">
            <span>{t("settings.photo.zoom")}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-11 flex-1 accent-primary"
            />
          </label>
          <p className="text-xs text-muted">{t("settings.photo.cropHint")}</p>
        </div>
      )}
    </Modal>
  );
}
