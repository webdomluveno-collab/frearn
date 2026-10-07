import { MINIMUM_WITHDRAWAL_CENTS } from "@/lib/withdrawals";

/**
 * CENTRAL SITE CONFIGURATION
 * --------------------------
 * This is the single source of truth for brand + product settings.
 * To rebrand again, edit this file (and globals.css tokens).
 *
 * Nothing in `components/` or `app/` should hardcode the brand name,
 * support email, domain, colors, or payout methods — import from here.
 */

export const siteConfig = {
  // -- Brand --
  name: "Freearn",
  tagline: "Your time. Your rewards.",
  description:
    "Complete surveys and online tasks matched to you. See the reward before you start and track everything in one place.",
  logoText: "Freearn",
  logoMark: "F", // temporary wordmark monogram

  // -- Domains / contact --
  // Public domain and support contact.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://freearn.online",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@freearn.online",

  // -- Theme tokens (mirrored as CSS variables in app/globals.css) --
  brand: {
    // One distinctive accent; restrained fintech palette.
    accentHexLight: "#4F46E5", // indigo-600
    accentHexDark: "#818CF8", // indigo-400
    inkHexLight: "#0F172A", // slate-900 (dark navy/charcoal text)
    inkHexDark: "#F1F5F9",
  },

  // -- Product state --
  isPreLaunch: true,
  waitlistEnabled: true,

  // -- Wallet / withdrawals --
  minimumWithdrawalCents: MINIMUM_WITHDRAWAL_CENTS,
  currency: "USD" as const,
  // Only methods listed in `liveWithdrawalMethods` are submittable.
  // Card stays planned: no card payout provider is integrated (never collect card data).
  futureWithdrawalMethods: ["Card"] as const,
  liveWithdrawalMethods: ["paypal", "skrill", "revolut", "sol", "usdc_solana"] as string[],
  withdrawalNote: "Withdrawals are manually reviewed at launch.",

  // -- Availability --
  availabilityNote:
    "Availability varies by country and profile. We're gradually expanding access around the world.",
  enabledCountries: [] as string[], // empty = pre-launch, region-gated

  nav: [
    { label: "Earn", href: "/#earn-anywhere" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Rewards", href: "/#reward-levels" },
    { label: "FAQ", href: "/faq" },
  ],
  footer: [
    { label: "About", href: "/" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "FAQ", href: "/faq" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "Sign in", href: "/login" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
