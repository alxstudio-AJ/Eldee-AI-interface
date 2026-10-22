import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { NextResponse } from "next/server";

import { aiConfig, model, systemPrompt } from "@/lib/ai/config";

function isRateLimitError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: number }).status) : undefined;

  return status === 429 || /rate limit|429/i.test(message);
}

function buildErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getErrorStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: number }).status);
    if (!Number.isNaN(status)) return status;
  }

  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/401|unauthorized|invalid api key|api key|forbidden|403/i.test(text)) return 401;
  if (/429|rate limit|too many requests/i.test(text)) return 429;

  return 500;
}

function getErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");

  if (/401|unauthorized|invalid api key|api key|forbidden|403/i.test(text)) {
    return "The AI service could not authenticate. Check your Google Gemini API key.";
  }

  if (/429|rate limit|too many requests/i.test(text)) {
    return "Too many requests, try again in a moment.";
  }

  if (/failed to fetch|network|fetch/i.test(text)) {
    return "The AI service is temporarily unavailable. Please try again in a moment.";
  }

  return "Something went wrong while preparing the AI response.";
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return buildErrorResponse(
      "The AI service is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY in the environment.",
      500,
    );
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];

    if (messages.length === 0) {
      return buildErrorResponse("No messages were sent to the assistant.", 400);
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxOutputTokens,
      abortSignal: request.signal,
      maxRetries: 2,
      onError: ({ error }) => {
        if (isRateLimitError(error)) {
          console.warn("Gemini rate limit reached in chat route.");
          return;
        }

        console.error("Gemini streaming error", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat route error:", error);

    const status = getErrorStatus(error);
    return buildErrorResponse(getErrorMessage(error), status);
  }
}
