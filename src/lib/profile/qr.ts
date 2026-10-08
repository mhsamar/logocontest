import "server-only";
import QRCode from "qrcode";

const COLORS = { dark: "#200E01", light: "#FFFFFF" }; // ink on white, so any scanner reads it

/** QR code as an SVG string (for showing on the page). */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: COLORS });
}

/** QR code as a PNG (for downloading and printing). */
export function qrPng(text: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", width: size, margin: 2, errorCorrectionLevel: "M", color: COLORS });
}
