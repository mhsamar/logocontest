import "server-only";
import sharp from "sharp";
import { getFileStorage } from "@/lib/storage";

/** Photos people upload as proof (owner, 2026-10-10): ID documents and copy-claim pictures. */

export const ID_DOCUMENTS_BUCKET = "id-documents";
export const CLAIM_FILES_BUCKET = "claim-files";
/** The browser makes photos small first; this is the most the server accepts. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Checks that the file is a real picture and saves it as JPEG (longest side 2000 px). Re-saving drops the
 * photo's hidden data, such as where a phone photo was taken. Returns false when it isn't a usable picture.
 */
export async function savePhoto(bucket: string, path: string, file: File): Promise<boolean> {
  if (!file.size || file.size > PHOTO_MAX_BYTES) return false;
  try {
    const img = sharp(new Uint8Array(await file.arrayBuffer()), { limitInputPixels: 60_000_000 }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 200 || meta.height < 150) return false;
    const jpeg = await img.resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    await getFileStorage().upload(bucket, path, jpeg, "image/jpeg");
    return true;
  } catch {
    return false;
  }
}

/** Files from a form field, skipping empty ones. */
export const formFiles = (form: FormData, name: string): File[] => form.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
