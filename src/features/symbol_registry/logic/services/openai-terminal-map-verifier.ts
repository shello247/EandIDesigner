import OpenAI from "openai";
import {
  terminalMapVerificationJsonSchema,
  terminalMapVerificationResultSchema,
  type SymbolMetadata,
  type TerminalMapVerificationIssue,
  type TerminalMapVerificationResult
} from "../../data/schema";

export type VerifyTerminalMapInput = {
  symbolName: string;
  manufacturer?: string | null;
  model?: string | null;
  svg: string;
  metadata: SymbolMetadata;
  sourceInputSummary?: string | null;
};

function compactSvg(svg: string): string {
  const compacted = svg.replace(/\s+/g, " ").trim();
  const maxLength = 60000;

  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, maxLength)}\n\n[SVG truncated for review]`;
}

function toOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeIssue(
  issue: TerminalMapVerificationIssue
): TerminalMapVerificationIssue {
  return {
    ...issue,
    terminalKey: toOptionalString(issue.terminalKey),
    evidence: toOptionalString(issue.evidence),
    suggestedFix: toOptionalString(issue.suggestedFix)
  };
}

export function normalizeTerminalMapVerificationOutput(
  output: unknown
): TerminalMapVerificationResult {
  const parsed = terminalMapVerificationResultSchema.parse(output);

  return {
    ...parsed,
    issues: parsed.issues.map(normalizeIssue)
  };
}

function createMockVerification(
  input: VerifyTerminalMapInput
): TerminalMapVerificationResult {
  const requiredTerminals = input.metadata.terminals.filter(
    (terminal) => terminal.requiredForWiring
  );

  return {
    confidence: requiredTerminals.length > 0 ? "medium" : "low",
    summary:
      "Mock AI verification completed. Review source datasheets before final engineering approval.",
    issues: [],
    suggestedTerminals: input.metadata.terminals,
    reviewNotes: [
      "Mock mode was used; no live OpenAI request was sent.",
      `${input.metadata.terminals.length} terminal row(s) were included in the review.`
    ]
  };
}

function buildPrompt(input: VerifyTerminalMapInput): string {
  return [
    "You are verifying an engineering SVG symbol terminal map.",
    "Compare the visible SVG labels and terminal layout against the current terminal metadata and source notes.",
    "Flag missing terminals, incorrect labels, wrong functions, anchor mismatches, ambiguous terminals, and wiring-relevant terminals marked not required.",
    "Do not invent datasheet facts. If evidence is weak, mark confidence low or medium and explain what must be manually checked.",
    "Return suggestedTerminals as the corrected full terminal table only when a correction is justified. Otherwise return the current terminal table.",
    "Use empty strings for terminalKey, evidence, or suggestedFix when not applicable.",
    "Return only structured JSON matching the supplied schema.",
    "",
    `Symbol: ${input.symbolName}`,
    input.manufacturer ? `Manufacturer: ${input.manufacturer}` : "",
    input.model ? `Model: ${input.model}` : "",
    `Source notes:\n${input.sourceInputSummary?.trim() || "No source notes available."}`,
    `Current terminal metadata JSON:\n${JSON.stringify(input.metadata, null, 2)}`,
    `SVG XML:\n${compactSvg(input.svg)}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractOutputText(response: unknown): string {
  const maybeResponse = response as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
  };

  if (maybeResponse.output_text) {
    return maybeResponse.output_text;
  }

  const message = maybeResponse.output?.find((item) => item.type === "message");
  const text = message?.content?.find((content) => typeof content.text === "string")
    ?.text;

  if (!text) {
    throw new Error("OpenAI response did not include text output.");
  }

  return text;
}

export async function verifyTerminalMapWithAi(
  input: VerifyTerminalMapInput
): Promise<TerminalMapVerificationResult> {
  if (process.env.OPENAI_TERMINAL_MAP_MOCK === "true") {
    return createMockVerification(input);
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to verify terminal maps with AI.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model =
    process.env.OPENAI_TERMINAL_MAP_MODEL ||
    process.env.OPENAI_SYMBOL_MODEL ||
    "gpt-5.5";

  const response = await client.responses.create({
    model,
    reasoning: { effort: "medium" },
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: buildPrompt(input) }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "terminal_map_verification_result",
        strict: true,
        schema: terminalMapVerificationJsonSchema
      }
    }
  } as never);

  return normalizeTerminalMapVerificationOutput(JSON.parse(extractOutputText(response)));
}
