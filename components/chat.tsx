"use client";

import { useChat } from "@ai-sdk/react";
import { ArrowUp, CircleDashed, Sparkles, StopCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Streamdown } from "streamdown";
import type { UIMessage } from "ai";

const CHAT_STORAGE_KEY = "eldee-chat-messages";

const suggestedPrompts = [
  "Explain the difference between a concept and a theorem with a short example.",
  "Summarize this topic as if I was cramming for a quiz in 5 minutes.",
  "Help me break down this idea into steps and give me a practice question.",
];

function getFriendlyErrorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error ?? "");

  if (!value) return "Something went wrong. Please try again.";
  if (/429|rate limit|too many requests/i.test(value)) {
    return "Too many requests, try again in a moment.";
  }
  if (/401|403|invalid api key|unauthorized|forbidden|api key|missing.*key|not configured/i.test(value)) {
    return "The AI service could not authenticate. Check your Google Gemini API key.";
  }

  return value;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ThinkingIndicator({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none transition-all duration-200 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
      aria-live="polite"
      aria-label="Assistant is thinking"
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-300 shadow-sm shadow-black/10 backdrop-blur-sm">
        <CircleDashed className="h-4 w-4 animate-spin" />
        <span>Thinking…</span>
      </div>
    </div>
  );
}

function MessageContent({ part, isStreaming }: { part: UIMessage["parts"][number]; isStreaming: boolean }) {
  if (part.type === "text") {
    return (
      <div
        className={cn(
          "prose prose-invert max-w-none text-[0.97rem] leading-7 text-slate-100",
          "prose-p:my-1 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-700 prose-pre:bg-slate-950/90 prose-pre:p-3 prose-code:text-[0.9em]",
          part.state === "streaming" ? "text-slate-100" : "text-slate-100",
        )}
      >
        <Streamdown mode={isStreaming ? "streaming" : "static"} parseIncompleteMarkdown>
          {part.text}
        </Streamdown>
      </div>
    );
  }

  if (part.type === "reasoning") {
    return (
      <div className="rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
        <div className="mb-1 font-medium uppercase tracking-[0.08em] text-slate-400">Reasoning</div>
        <div>{part.text}</div>
      </div>
    );
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type === "file") {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-sky-300 hover:border-sky-600"
      >
        {part.filename ?? "Attachment"}
      </a>
    );
  }

  return null;
}

export function Chat() {
  const { messages, status, sendMessage, stop, error, clearError, regenerate, setMessages } = useChat();
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPinned, setIsPinned] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const isStreaming = status === "streaming";
  const isBusy = status === "submitted" || status === "streaming";
  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const hasVisibleText =
    !!lastAssistantMessage &&
    lastAssistantMessage.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    );
  const showThinking = status === "submitted" || (isStreaming && !hasVisibleText);
  const friendlyError = error ? getFriendlyErrorMessage(error) : "";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedMessages = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as UIMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        window.localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    }

    setHasHydrated(true);
  }, [setMessages]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;

    if (messages.length === 0) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [hasHydrated, messages]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 120;
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsPinned(nearBottom);
      setShowJumpToLatest(!nearBottom && messages.length > 0);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    if (isPinned) {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    }
  }, [messages.length, isPinned, status]);

  useEffect(() => {
    const textarea = formRef.current?.querySelector("textarea");
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isStreaming || status === "submitted") {
      stop();
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) return;

    setInput("");
    await sendMessage({ text: trimmed });
  };

  const resetChat = () => {
    if (status === "submitted" || status === "streaming") {
      stop();
    }

    setMessages([]);
    clearError();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  };

  const handleRetry = () => {
    clearError();
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (lastAssistant) {
      void regenerate({ messageId: lastAssistant.id });
    }
  };

  const jumpToLatest = () => {
    const container = listRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    setIsPinned(true);
    setShowJumpToLatest(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!input.trim() || isBusy) return;
      formRef.current?.requestSubmit();
    }
  };

  return (
    <main className="flex h-[100dvh] flex-col bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden border-x border-slate-900 bg-slate-950/95">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur-sm sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                <Sparkles className="h-5 w-5 text-amber-300" />
                Eldee
              </div>
              <button
                type="button"
                onClick={resetChat}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                New chat
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            aria-live="polite"
            className="relative flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            {messages.length === 0 && (
              <div className="mx-auto max-w-xl pt-8">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
                  <p className="mb-2 text-sm uppercase tracking-[0.12em] text-sky-300">Welcome</p>
                  <h1 className="text-2xl font-semibold text-white">Ask Eldee anything about your course.</h1>
                  <p className="mt-2 text-sm text-slate-300">
                    I can explain concepts, turn dense notes into a study guide, and ask a follow-up when something needs clarity.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={async () => {
                          await sendMessage({ text: prompt });
                        }}
                        className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-sky-600 hover:bg-slate-800"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
              {messages.map((message) => {
                const isAssistant = message.role === "assistant";

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full",
                      isAssistant ? "justify-start" : "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-2xl border px-3 py-2 shadow-sm transition-all duration-200 ease-out sm:max-w-[85%] animate-[fadeIn_220ms_ease-out]",
                        isAssistant
                          ? "border-slate-700 bg-slate-900/90 text-slate-100"
                          : "border-sky-700 bg-sky-600/90 text-white",
                      )}
                    >
                      {isAssistant && (
                        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                          Eldee
                        </div>
                      )}

                      <div className="space-y-2">
                        {message.parts.map((part, index) => (
                          <div key={`${message.id}-${index}`}>
                            <MessageContent part={part} isStreaming={status === "streaming" && isAssistant} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {showThinking && (
                <div className="flex w-full justify-start">
                  <div className="max-w-[90%] rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2 shadow-sm sm:max-w-[85%]">
                    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      Eldee
                    </div>
                    <ThinkingIndicator visible={showThinking} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {showJumpToLatest && (
            <div className="pointer-events-none sticky bottom-0 flex justify-center pb-3">
              <button
                type="button"
                onClick={jumpToLatest}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-sm text-slate-100 shadow-lg shadow-slate-950/30 transition hover:border-sky-600 hover:bg-slate-800"
              >
                Jump to latest
              </button>
            </div>
          )}

          {friendlyError && (
            <div className="border-t border-red-800/70 bg-red-950/70 px-4 py-3 text-sm text-red-100 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <span>{friendlyError}</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-full border border-red-400/50 bg-red-900/80 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-800"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          <form
            ref={formRef}
            onSubmit={handleFormSubmit}
            className="border-t border-slate-800 bg-slate-950/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-5"
          >
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-700 bg-slate-900/90 p-2 shadow-lg shadow-slate-950/30">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask Eldee to explain a concept…"
                className="max-h-40 min-h-[44px] flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2 text-base text-slate-50 placeholder:text-slate-400 focus:outline-none"
                aria-label="Message input"
                aria-invalid={!!friendlyError}
                disabled={isBusy}
              />

              <button
                type={isStreaming ? "button" : "submit"}
                onClick={isStreaming ? () => stop() : undefined}
                disabled={!input.trim() && !isStreaming}
                className={cn(
                  "inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium transition-all duration-200",
                  isStreaming
                    ? "bg-rose-600 text-white hover:bg-rose-500"
                    : input.trim()
                      ? "bg-sky-500 text-white hover:bg-sky-400"
                      : "bg-slate-700 text-slate-400",
                )}
                aria-label={isStreaming ? "Stop generating response" : "Send message"}
              >
                {isStreaming ? <StopCircle className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
