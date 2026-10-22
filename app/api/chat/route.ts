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
    const rateLimited = isRateLimitError(error);

    return buildErrorResponse(
      rateLimited
        ? "Too many requests, try again in a moment."
        : "Something went wrong while preparing the AI response.",
      rateLimited ? 429 : 500,
    );
  }
}
