import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PAGE_TYPES, type AiMetaInput, type AiMetaOutput, type AiProvider } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const TOOL_NAME = "emit_seo_meta";

const SYSTEM_PROMPT = `You are an SEO specialist who writes meta titles and meta descriptions purely by analyzing crawled webpage content. You are never given keywords, tone, brand names, or page type by the user — you must infer everything yourself from the page content provided.

Analyze the page to determine:
- pageType: one of ${PAGE_TYPES.join(", ")}
- primaryTopic: the main subject/keyword of the page
- secondaryConcepts: up to 4 related concepts present on the page
- brandName: the site or brand name, only if it is clearly identifiable from the content

Then write ONE recommended meta title and ONE recommended meta description.

Title requirements:
- Accurately describes the page based on the actual crawled content
- Naturally represents the page's main search topic; place it early when natural
- Avoid keyword stuffing and unnecessary repetition
- Preserve meaningful product, category, or location names found in the content
- Include the brand name only when it clearly adds value and fits naturally
- Avoid generic filler words
- Never fabricate claims, prices, discounts, ratings, or facts not present in the content
- Aim for approximately 45-65 characters when it reads naturally at that length; do not force it if the natural phrasing is shorter or longer

Description requirements:
- Accurately represents the actual page content
- Naturally mentions the main topic and communicates real value found on the page
- Use call-to-action language only when it fits the page type
- Avoid keyword stuffing
- Never invent facts, discounts, shipping policies, statistics, prices, warranties, or guarantees not present in the content
- Target approximately 120-160 characters, and never exceed 160 characters under any circumstances. If the natural phrasing runs long, tighten the wording rather than going over 160.

Always return your answer using the ${TOOL_NAME} tool. Respond with nothing else.`;

function buildUserMessage(input: AiMetaInput): string {
  const lines: string[] = [`URL: ${input.url}`];
  if (input.siteName) lines.push(`Site name: ${input.siteName}`);
  if (input.brandName) lines.push(`Detected brand: ${input.brandName}`);
  if (input.breadcrumb) lines.push(`Breadcrumb: ${input.breadcrumb}`);
  if (input.productName) lines.push(`Detected product name: ${input.productName}`);
  if (input.categoryName) lines.push(`Detected category name: ${input.categoryName}`);
  if (input.existingTitle) lines.push(`Existing <title>: ${input.existingTitle}`);
  if (input.existingDescription) lines.push(`Existing meta description: ${input.existingDescription}`);
  if (input.ogTitle) lines.push(`OpenGraph title: ${input.ogTitle}`);
  if (input.ogDescription) lines.push(`OpenGraph description: ${input.ogDescription}`);
  if (input.h1) lines.push(`H1: ${input.h1}`);
  if (input.headings.length) lines.push(`H2 headings: ${input.headings.join(" | ")}`);
  if (input.canonical) lines.push(`Canonical URL: ${input.canonical}`);
  lines.push(`Main page content (condensed):\n${input.mainText}`);
  return lines.join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    pageType: { type: "string", enum: PAGE_TYPES as unknown as string[] },
    primaryTopic: { type: "string" },
    secondaryConcepts: { type: "array", items: { type: "string" }, maxItems: 4 },
    brandName: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
  },
  required: ["pageType", "primaryTopic", "secondaryConcepts", "title", "description"],
};

function isPageType(value: unknown): value is AiMetaOutput["pageType"] {
  return typeof value === "string" && (PAGE_TYPES as readonly string[]).includes(value);
}

function validateAiOutput(raw: unknown): AiMetaOutput {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI response was not a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if (!isPageType(obj.pageType)) {
    throw new Error(`AI response had invalid pageType: ${String(obj.pageType)}`);
  }
  if (typeof obj.primaryTopic !== "string" || !obj.primaryTopic.trim()) {
    throw new Error("AI response missing primaryTopic");
  }
  if (typeof obj.title !== "string" || !obj.title.trim()) {
    throw new Error("AI response missing title");
  }
  if (typeof obj.description !== "string" || !obj.description.trim()) {
    throw new Error("AI response missing description");
  }
  const secondaryConcepts = Array.isArray(obj.secondaryConcepts)
    ? obj.secondaryConcepts.filter((c): c is string => typeof c === "string")
    : [];

  return {
    pageType: obj.pageType,
    primaryTopic: obj.primaryTopic.trim(),
    secondaryConcepts,
    brandName: typeof obj.brandName === "string" && obj.brandName.trim() ? obj.brandName.trim() : undefined,
    title: obj.title.trim(),
    description: obj.description.trim(),
  };
}

export class AnthropicProvider implements AiProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateMeta(input: AiMetaInput): Promise<AiMetaOutput> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
      tools: [
        {
          name: TOOL_NAME,
          description: "Emit the analyzed page metadata and recommended meta title/description.",
          input_schema: RESPONSE_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("AI response did not include a tool_use block");
    }
    return validateAiOutput(toolUse.input);
  }
}
