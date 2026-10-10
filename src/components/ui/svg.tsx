/** A one-path line icon (24×24 grid), as used across the design. */
export const Svg = ({ d, size = 18, stroke = "currentColor", width = 2 }: { d: string; size?: number; stroke?: string; width?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
