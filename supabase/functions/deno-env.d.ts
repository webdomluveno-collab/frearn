/**
 * Minimal ambient declaration for the Deno Edge Functions runtime.
 * Lets the repo TypeScript check (`tsc --noEmit`) and linters understand
 * `Deno.env` / `Deno.serve` without pulling in remote Deno types.
 * The deployed runtime provides the real implementations.
 */
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
