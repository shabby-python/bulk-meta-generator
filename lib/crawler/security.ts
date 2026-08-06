import dns from "node:dns";
import ipaddr from "ipaddr.js";

const dnsLookup = dns.promises.lookup;

export const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Cloud metadata endpoints that must never be reachable, even though some fall
 * outside the standard private ranges (e.g. 100.100.100.200 on Alibaba Cloud). */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_EXACT_IPS = new Set([
  "169.254.169.254", // AWS/Azure/GCP metadata
  "100.100.100.200", // Alibaba Cloud metadata
  "::ffff:169.254.169.254",
]);

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

function isDisallowedIp(ip: string): boolean {
  if (BLOCKED_EXACT_IPS.has(ip)) return true;
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.process(ip);
  } catch {
    return true;
  }
  const range = addr.range();
  // ipaddr.js ranges: unicast, private, loopback, linkLocal, multicast,
  // reserved, uniqueLocal, ipv4Mapped, rfc6145, rfc6052, 6to4, teredo,
  // benchmarking, amt, as112, deprecated, orchid2, droneRemoteIdProtocolEntityTags
  const disallowed = new Set([
    "private",
    "loopback",
    "linkLocal",
    "multicast",
    "reserved",
    "uniqueLocal",
    "carrierGradeNat",
    "broadcast",
    "unspecified",
    "benchmarking",
    "amt",
    "as112",
    "orchid2",
  ]);
  if (disallowed.has(range)) return true;

  // Unwrap IPv4-mapped IPv6 addresses and re-check as IPv4.
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return isDisallowedIp(v6.toIPv4Address().toString());
    }
  }
  return false;
}

export function validateUrlStructure(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(`Invalid URL: ${rawUrl}`);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfBlockedError(`Protocol not allowed: ${url.protocol}`);
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) {
    throw new SsrfBlockedError(`Host not allowed: ${hostname}`);
  }
  if (hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    throw new SsrfBlockedError(`Host not allowed: ${hostname}`);
  }
  return url;
}

/**
 * Resolves the hostname and throws if any resolved address is private,
 * loopback, link-local, or otherwise internal. Must be re-run on every
 * redirect hop, since redirects can point anywhere.
 */
export async function assertSafeDestination(rawUrl: string): Promise<URL> {
  const url = validateUrlStructure(rawUrl);
  const hostname = url.hostname;

  // A literal IP in the URL — validate directly, no DNS involved.
  if (ipaddr.isValid(hostname)) {
    if (isDisallowedIp(hostname)) {
      throw new SsrfBlockedError(`IP address not allowed: ${hostname}`);
    }
    return url;
  }

  let records: { address: string }[];
  try {
    records = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfBlockedError(`DNS resolution failed for host: ${hostname}`);
  }
  if (records.length === 0) {
    throw new SsrfBlockedError(`DNS resolution returned no records for host: ${hostname}`);
  }
  for (const record of records) {
    if (isDisallowedIp(record.address)) {
      throw new SsrfBlockedError(
        `Host ${hostname} resolves to a blocked address: ${record.address}`
      );
    }
  }
  return url;
}
