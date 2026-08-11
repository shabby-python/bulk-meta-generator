import "server-only";
import { AnthropicProvider } from "./anthropic";
import type { AiProvider } from "./types";

let cachedProvider: AiProvider | undefined;

/**
 * Returns the configured AI provider. Anthropic is the only implementation
 * today, but callers only depend on the AiProvider interface so another
 * provider can be swapped in without touching call sites.
 */
export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  // Defensive normalization: env var UIs (Vercel's included) commonly pick up
  // a trailing newline, surrounding quotes, or the whole "ANTHROPIC_API_KEY="
  // line (if the value field was pasted from a .env file instead of just the
  // key) — any of which silently turns a valid key into a 401 "invalid" error.
  let apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey?.toUpperCase().startsWith("ANTHROPIC_API_KEY=")) {
    apiKey = apiKey.slice(apiKey.indexOf("=") + 1).trim();
  }
  if (apiKey && ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'")))) {
    apiKey = apiKey.slice(1, -1).trim();
  }
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }
  cachedProvider = new AnthropicProvider(apiKey);
  return cachedProvider;
}
