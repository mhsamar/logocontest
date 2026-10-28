import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * The site's link (owner, 2026-10-28): it does not fetch the next page ahead of time. Next.js asked the server about
 * every link that came on screen, two billed runs each, about ten times the real page views; pages here are made on
 * each visit, so a click waits for the server either way. Pass `prefetch` to opt back in.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
