/**
 * AdGem Web Offerwall URL builder.
 *
 * Pure function with NO secrets: the AdGem dashboard wall URL carries only the
 * public App ID and the authenticated player's UUID. There is deliberately no
 * `import "server-only"` here so the builder is unit-testable anywhere — a
 * guard test pins that no secret reference may ever appear in this file.
 * The playerId MUST come from the trusted server session (see
 * app/api/providers/adgem/wall/route.ts), never from browser input.
 */

export const ADGEM_WALL_BASE_URL = "https://adunits.adgem.com/wall";

/**
 * AdGem App/Property ID. Public (it appears in the wall URL), mirroring the
 * CPX convention: optional `ADGEM_APP_ID` override with the documented
 * dashboard value as a safe fallback, so no manual configuration is required.
 */
export function adgemAppId(): string {
  return process.env.ADGEM_APP_ID?.trim() || "33683";
}

export interface BuildAdgemWallInput {
  /** Stable Supabase auth UUID from the trusted server session. */
  playerId: string;
}

/** Build the personalized offerwall URL with safe URL construction (no string concat). */
export function buildAdgemWallUrl(input: BuildAdgemWallInput): string {
  if (!input.playerId) throw new Error("playerId is required to build the AdGem wall URL.");
  const url = new URL(ADGEM_WALL_BASE_URL);
  url.searchParams.set("appid", adgemAppId());
  url.searchParams.set("playerid", input.playerId);
  return url.toString();
}
