/**
 * Anti-fraud architecture hooks (non-invasive).
 * No fingerprinting is implemented. Fields below are collected
 * server-side where already available (e.g. request IP country)
 * and stored for future risk scoring.
 */
export interface FraudSignals {
  registrationIpCountry?: string;
  currentIpCountry?: string;
  accountCountry?: string;
  vpnProxyRisk?: "unknown" | "low" | "medium" | "high";
  deviceHash?: string;
  duplicatePayoutDestination?: boolean;
  completionsLastHour?: number;
  riskScore?: number; // 0–100
}

export function emptySignals(): FraudSignals {
  return { vpnProxyRisk: "unknown", riskScore: 0 };
}

export function flagReasons(s: FraudSignals): string[] {
  const out: string[] = [];
  if (
    s.registrationIpCountry &&
    s.accountCountry &&
    s.registrationIpCountry !== s.accountCountry
  )
    out.push("registration_country_mismatch");
  if (s.vpnProxyRisk === "high") out.push("vpn_proxy_suspected");
  if (s.duplicatePayoutDestination) out.push("duplicate_payout_destination");
  if ((s.completionsLastHour ?? 0) > 20) out.push("suspicious_velocity");
  return out;
}
