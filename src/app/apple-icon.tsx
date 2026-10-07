import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// App icon (home screen) and the icon on browser push notifications. Same drawing as LogoMark.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#200e01" }}>
        <svg viewBox="0 0 32 32" width="192" height="192">
          <circle cx="16" cy="14.5" r="7" fill="#ede7c7" />
          <path d="M9.5 23.5h13" stroke="#8b0000" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
