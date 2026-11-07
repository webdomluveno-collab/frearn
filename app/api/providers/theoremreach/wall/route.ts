import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import {
  buildTheoremreachEntryUrl,
  isTheoremreachDebugPilotUserAllowed,
  isTheoremreachPilotDebugEnabled,
  isTheoremreachPilotEnabled,
  isTheoremreachPilotUserAllowed,
  isTheoremreachPostbackEnabled,
  isTheoremreachRewardProcessingEnabled,
  isTheoremreachWallConfigured,
  isTheoremreachWallEnabledForUser,
  parseTheoremreachPilotUserIds,
} from "@/lib/providers/theoremreach/server";

/**
 * A non-sensitive, single-code explanation for authenticated callers.
 * Never echo env values, secrets, identifiers, URLs or exception details.
 */
function unavailableReason(userId: string): string {
  if (!isTheoremreachPostbackEnabled()) return "postback_disabled";
  if (!isTheoremreachWallConfigured()) return "wall_credentials_missing";
  if (isTheoremreachPilotEnabled()) {
    if (!isTheoremreachPilotUserAllowed(userId)) {
      // Distinguish an environment variable absent at runtime from a configured
      // list that does not contain this session UUID. Never echo its contents.
      const rawAllowlist = process.env.THEOREMREACH_PILOT_USER_IDS;
      if (!rawAllowlist?.trim()) return "pilot_allowlist_missing_at_runtime";
      if (parseTheoremreachPilotUserIds(rawAllowlist).size === 0) {
        // Diagnostics deliberately reveal only a broad character category,
        // never raw environment values or user IDs.
        if (rawAllowlist.length < 32) return "pilot_allowlist_runtime_value_too_short";
        if (/[^\\x00-\\x7F]/.test(rawAllowlist)) return "pilot_allowlist_runtime_has_non_ascii";
        if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(rawAllowlist)) {
          return "pilot_allowlist_runtime_uuid_wrapped_unrecognized";
        }
        return "pilot_allowlist_runtime_has_no_uuid_text";
      }
      return "pilot_user_not_allowlisted";
    }
    if (!isTheoremreachPilotDebugEnabled() && !isTheoremreachRewardProcessingEnabled()) {
      return "pilot_debug_and_reward_processing_disabled";
    }
    return "pilot_gate_denied";
  }
  if (process.env.THEOREMREACH_WALL_ENABLED !== "true") return "pilot_off_and_public_wall_disabled";
  if (!isTheoremreachRewardProcessingEnabled()) return "reward_processing_disabled";
  return "wall_gate_denied";
}

/**
 * Returns the authenticated user's personal TheoremReach entry URL.
 * Phase 1 (testing only): the signed URL enables dashboard entry-flow
 * testing. No money can move — postback crediting is disabled.
 * Auth required: userId always comes from the trusted server session,
 * never from browser input. This route accepts no user-supplied identity.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isTheoremreachWallEnabledForUser(user.id)) {
    return NextResponse.json(
      { error: "wall_unavailable", reason: unavailableReason(user.id), diagnostics_version: "allowlist-v8" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  try {
    const url = buildTheoremreachEntryUrl({
      userId: user.id,
      debug: isTheoremreachDebugPilotUserAllowed(user.id),
    });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json(
      { error: "wall_unavailable", reason: "signed_url_creation_failed" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
