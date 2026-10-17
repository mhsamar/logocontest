/**
 * Share links (owner, 2026-10-18): Facebook, Pinterest and WhatsApp open their own share pages in a new tab. Nothing
 * is posted from our server; the person sharing decides. Safe for client components.
 */

const enc = encodeURIComponent;

/** Pinterest cuts a pin's description at 500 characters. */
const PIN_TEXT_MAX = 500;

/** The public page of one design: what Facebook and Pinterest open, with the design as its picture. */
export const designPath = (slug: string, number: number) => `/contest/${slug}/design/${number}`;

/** A tall picture (1000×1500) made for Pinterest. */
export const designPinPath = (slug: string, number: number) => `${designPath(slug, number)}/pin`;
export const contestPinPath = (slug: string) => `/contest/${slug}/pin`;

/** Facebook reads the page's own preview (title and picture) from the link. */
export const facebookShareUrl = (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;

/** Pinterest's "Save" page: the picture to pin, the page it links back to and its description. */
export const pinterestShareUrl = (o: { url: string; media: string; description: string }) =>
  `https://www.pinterest.com/pin/create/button/?url=${enc(o.url)}&media=${enc(o.media)}&description=${enc(o.description.slice(0, PIN_TEXT_MAX))}`;

export const whatsappShareUrl = (text: string, url: string) => `https://wa.me/?text=${enc(`${text} ${url}`)}`;
