/** Explicit acceptance criteria, independent of the implementation's minimum values. */
export const METHOD_CASES = [
  { method: "revolut", label: "Revolut", minimum: 10, destination: "@someone", destinationLabel: "Revolut @username" },
  { method: "ltc", label: "Litecoin", minimum: 100, destination: "LZMFwFq4SR2TjJj6bvA6GHnXMNhUTX4Bbh", destinationLabel: "Litecoin wallet address" },
  { method: "sol", label: "SOL", minimum: 100, destination: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ", destinationLabel: "Solana wallet address" },
  { method: "usdc_solana", label: "USDC (Solana)", minimum: 100, destination: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ", destinationLabel: "Solana wallet address" },
  { method: "usdc_bep20", label: "USDC (BEP20)", minimum: 100, destination: "0x1234567890abcdef1234567890abcdef12345678", destinationLabel: "BNB Smart Chain wallet address" },
  { method: "cfx", label: "CFX (Conflux native)", minimum: 10, destination: "cfx:aakkfzezns4h8ymx1cgmcnd4x3aev6e2hexz250ym5", destinationLabel: "Conflux Core Space address" },
  { method: "rvn", label: "RVN (Ravencoin native)", minimum: 10, destination: "R"+"a".repeat(33), destinationLabel: "Ravencoin wallet address" },
  { method: "0g", label: "0G (native)", minimum: 10, destination: "0x1234567890abcdef1234567890abcdef12345678", destinationLabel: "0G mainnet wallet address" },
  { method: "iotx", label: "IOTX (IoTeX native)", minimum: 10, destination: "io1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszq", destinationLabel: "IoTeX wallet address" },
  { method: "xno", label: "XNO (Nano native)", minimum: 10, destination: "nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs", destinationLabel: "Nano wallet address" },
  { method: "skrill", label: "Skrill", minimum: 100, destination: "user@example.com", destinationLabel: "Skrill email" },
] as const;
