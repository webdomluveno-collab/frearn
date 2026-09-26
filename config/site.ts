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
  name: "Frearn",
  tagline: "Your time. Your rewards.",
  description:
    "Complete surveys and online tasks matched to you. See the reward before you start and track everything in one place.",
  logoText: "Frearn",
  logoMark: "F", // temporary wordmark monogram

  // -- Domains / contact --
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://frearn.online",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@frearn.online",

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
  minimumWithdrawalCents: 500, // $5.00 — change centrally
  currency: "USD" as const,
  // Anticipated future methods. Do NOT present all as live; UI marks availability per country.
  // Only methods listed in `liveWithdrawalMethods` are shown as available.
  futureWithdrawalMethods: ["USDT", "USDC", "PayPal", "Gift cards", "Local methods"] as const,
  liveWithdrawalMethods: [] as string[], // empty in pre-launch
  withdrawalNote: "Available withdrawal methods may vary by country.",

  // -- Availability --
  availabilityNote:
    "Availability varies by country and profile. We're gradually expanding access around the world.",
  enabledCountries: [] as string[], // empty = pre-launch, region-gated

  nav: [
    { label: "Earn", href: "/#earn-types" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Rewards", href: "/#rewards" },
    { label: "FAQ", href: "/faq" },
  ],
  footer: [
    { label: "About", href: "/#top" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "FAQ", href: "/faq" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "Sign in", href: "/login" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
