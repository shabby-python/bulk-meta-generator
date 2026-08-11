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

  // Trim defensively: env var UIs (Vercel's included) commonly introduce a
  // trailing newline or stray whitespace when a key is pasted in, which
  // otherwise turns a valid key into an "API key is invalid" 401.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }
  cachedProvider = new AnthropicProvider(apiKey);
  return cachedProvider;
}
