import "server-only";
import { Resolver } from "node:dns/promises";
import type { PublicAnswer, ServerAnswer, Signals } from "./rules";

/**
 * Asking BTCL's .bd servers and two public resolvers (owner, 2026-10-21). The .bd servers are asked directly, by
 * address (checked 2026-10-21), so a .bd problem can't hide them. Every question has its own short time limit.
 */
export const BD_SERVERS = [
  { name: "dns.bd", ip: "123.49.12.112" },
  { name: "surma.btcl.net.bd", ip: "203.112.194.232" },
  { name: "jamuna.btcl.net.bd", ip: "203.112.194.231" },
  { name: "bd-ns.anycast.pch.net", ip: "204.61.216.108" },
] as const;

/** A well-known .bd name: if the .bd servers say it doesn't exist either, all of .bd is broken, not only us. */
export const CONTROL_NAME = "btcl.com.bd";

function resolverAt(ip: string): Resolver {
  const r = new Resolver({ timeout: 2500, tries: 1 });
  r.setServers([ip]);
  return r;
}

/** The .bd servers only refer to the domain's own name servers: "no data" is the healthy answer, "not found" is not. */
async function askServer(ip: string, name: string): Promise<ServerAnswer> {
  try {
    await resolverAt(ip).resolveNs(name);
    return "referral";
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENODATA") return "referral";
    if (code === "ENOTFOUND") return "nxdomain";
    return "unreached";
  }
}

async function bdSerial(): Promise<number | null> {
  try {
    return (await resolverAt(BD_SERVERS[0].ip).resolveSoa("bd")).serial;
  } catch {
    return null;
  }
}

const DOH = ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"];

/** One public resolver's JSON answer for the name's address. A busy or broken resolver gives no signal. */
async function askPublic(base: string, name: string): Promise<PublicAnswer> {
  try {
    const res = await fetch(`${base}?name=${encodeURIComponent(name)}&type=A`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) return "nosignal";
    const j = (await res.json()) as { Status?: number; Answer?: unknown[] };
    if (j.Status === 0) return j.Answer?.length ? "good" : "nosignal";
    if (j.Status === 3) return "nxdomain";
    if (j.Status === 2) return "servfail";
    return "nosignal";
  } catch {
    return "nosignal";
  }
}

export async function collectSignals(name: string, backupHost: string | null): Promise<{ signals: Signals; serial: number | null }> {
  const [us, control, publicUs, publicBackup, serial] = await Promise.all([
    Promise.all(BD_SERVERS.map((s) => askServer(s.ip, name))),
    Promise.all(BD_SERVERS.map((s) => askServer(s.ip, CONTROL_NAME))),
    Promise.all(DOH.map((d) => askPublic(d, name))),
    backupHost ? Promise.all(DOH.map((d) => askPublic(d, backupHost))) : Promise.resolve([] as PublicAnswer[]),
    bdSerial(),
  ]);
  return { signals: { us, control, publicUs, publicBackup }, serial };
}
