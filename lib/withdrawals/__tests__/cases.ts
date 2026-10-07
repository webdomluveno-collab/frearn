/** Explicit acceptance criteria, independent of the implementation's minimum values. */
export const METHOD_CASES = [
  { method: "revolut", label: "Revolut", minimum: 10, destination: "@someone", destinationLabel: "Revolut @username" },
  { method: "ltc", label: "Litecoin", minimum: 100, destination: "LZMFwFq4SR2TjJj6bvA6GHnXMNhUTX4Bbh", destinationLabel: "Litecoin wallet address" },
  { method: "sol", label: "SOL", minimum: 100, destination: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ", destinationLabel: "Solana wallet address" },
  { method: "usdc_solana", label: "USDC (Solana)", minimum: 100, destination: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ", destinationLabel: "Solana wallet address" },
  { method: "usdc_bep20", label: "USDC (BEP20)", minimum: 100, destination: "0x1234567890abcdef1234567890abcdef12345678", destinationLabel: "BNB Smart Chain wallet address" },
] as const;
