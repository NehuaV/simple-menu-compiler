import type { TranslationSettings } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Generic OpenAI-compatible Chat Completions client.
//
// Works against any provider that implements the protocol:
//   POST {baseUrl}/chat/completions
//   { model, messages, temperature, response_format }
//
// Returns the assistant message content as a string. The translator layer is
// responsible for asking for JSON and parsing it.
// ─────────────────────────────────────────────────────────────────────────────

export class TranslationApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "TranslationApiError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  /**
   * Structured-output schema. When provided, the request asks the server to
   * constrain output to this JSON Schema (supported by OpenAI gpt-4o+,
   * LM Studio, and most modern OpenAI-compatible servers). If the server
   * rejects `json_schema`, the client transparently retries with no
   * response_format and falls back to lenient JSON extraction.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

/** Normalize a base URL: trim trailing slashes; allow `…/v1` or bare host. */
function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/\/v\d+$/.test(url)) {
    url = `${url}/v1`;
  }
  return url;
}

/**
 * Compose a helpful explanation for a `fetch()` rejection. The browser hides
 * the real reason, so we infer from the URL host whether this is most likely
 * a CORS issue (LM Studio / localhost) vs. a network reachability issue.
 */
function diagnoseFetchFailure(url: string, message: string): string {
  const lower = message.toLowerCase();
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // ignore malformed URLs — fall through
  }
  const isLocal =
    host === "127.0.0.1" || host === "localhost" || host.endsWith(".local");

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    if (isLocal) {
      return [
        "Most likely a CORS rejection or a stopped server.",
        "Checks for LM Studio:",
        "  1. Server is running (Developer tab → Start Server).",
        "  2. CORS is enabled (Developer tab → Settings → Enable CORS).",
        "  3. The port matches (default 1234).",
        `  4. Try swapping http://127.0.0.1 ↔ http://localhost — the browser treats them as different origins.`,
      ].join("\n");
    }
    return [
      "Most likely a CORS rejection from the remote endpoint, or the host is unreachable.",
      "Notes:",
      "  • OpenAI's api.openai.com does NOT permit direct browser calls — you must proxy /v1/chat/completions through your own server.",
      "  • If using a hosted provider, confirm the endpoint allows requests from this origin.",
    ].join("\n");
  }
  return "Open the browser DevTools network tab for the underlying cause.";
}

export async function chatCompletion(
  settings: TranslationSettings,
  req: ChatRequest,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }

  const buildBody = (includeSchema: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: settings.model || "local-model",
      messages: req.messages,
      temperature: req.temperature ?? settings.temperature,
      stream: false,
    };
    if (includeSchema && req.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: req.jsonSchema.name,
          strict: true,
          schema: req.jsonSchema.schema,
        },
      };
    }
    return body;
  };

  const send = async (
    includeSchema: boolean,
  ): Promise<{ response: Response; bodyText: unknown }> => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers,
        body: JSON.stringify(buildBody(includeSchema)),
        signal,
      });
    } catch (err) {
      // Browsers report CORS rejections and DNS / refused-connection errors
      // indistinguishably as TypeError("Failed to fetch") for security
      // reasons. Inflate the message with the most likely diagnosis so
      // users don't have to dig through the DevTools console.
      const rawMessage = err instanceof Error ? err.message : String(err);
      const hint = diagnoseFetchFailure(url, rawMessage);
      throw new TranslationApiError(
        `${rawMessage} when contacting ${url}.\n\n${hint}`,
      );
    }
    let bodyText: unknown = undefined;
    if (!response.ok) {
      try {
        bodyText = await response.clone().json();
      } catch {
        try {
          bodyText = await response.clone().text();
        } catch {
          bodyText = undefined;
        }
      }
    }
    return { response, bodyText };
  };

  // First attempt: with structured output if a schema was requested.
  let { response, bodyText } = await send(!!req.jsonSchema);

  // If the server rejects `response_format`, retry without it. This handles
  // providers that don't support `json_schema` / `json_object` (older
  // llama.cpp servers, some Ollama models, etc.) — the prompt + the
  // lenient extractor still get us JSON in practice.
  if (
    !response.ok &&
    req.jsonSchema &&
    looksLikeResponseFormatRejection(response.status, bodyText)
  ) {
    ({ response, bodyText } = await send(false));
  }

  if (!response.ok) {
    throw new TranslationApiError(
      `${response.status} ${response.statusText} from ${url}`,
      response.status,
      bodyText,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new TranslationApiError(
      "Empty response from chat completion endpoint",
      response.status,
      data,
    );
  }
  return content;
}

/** Heuristic: detect a 400-class rejection caused by `response_format`. */
function looksLikeResponseFormatRejection(
  status: number,
  body: unknown,
): boolean {
  if (status < 400 || status >= 500) return false;
  const text =
    typeof body === "string"
      ? body
      : body && typeof body === "object"
        ? JSON.stringify(body)
        : "";
  return /response_format|json_schema|json_object/i.test(text);
}

/**
 * Best-effort JSON extraction. Some local models wrap their output in a
 * Markdown code fence or leak a stray prose preamble; this peels both off.
 */
export function extractJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? (fenced[1] ?? "").trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall back to finding the first '{' or '[' and the matching closer.
    const start = candidate.search(/[{[]/);
    if (start >= 0) {
      const end = Math.max(
        candidate.lastIndexOf("}"),
        candidate.lastIndexOf("]"),
      );
      if (end > start) {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      }
    }
    throw new TranslationApiError(
      `Model did not return parseable JSON. Raw output: ${raw.slice(0, 200)}…`,
    );
  }
}

/**
 * Fetch the list of models the server reports via `GET /v1/models`.
 * Works for LM Studio (returns currently-loaded models), OpenAI, OpenRouter,
 * Groq, and any other OpenAI-compatible provider.
 *
 * Returns an empty array if the endpoint is missing (some Ollama / vLLM
 * builds don't expose it) — the caller can still let the user type a model
 * name manually.
 */
export async function listModels(
  settings: TranslationSettings,
  signal?: AbortSignal,
): Promise<string[]> {
  const url = `${normalizeBaseUrl(settings.baseUrl)}/models`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers,
      signal,
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    throw new TranslationApiError(
      `${rawMessage} when contacting ${url}.\n\n${diagnoseFetchFailure(
        url,
        rawMessage,
      )}`,
    );
  }

  if (response.status === 404) {
    // Provider doesn't expose `/v1/models`; not an error, just no list.
    return [];
  }
  if (!response.ok) {
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      try {
        body = await response.text();
      } catch {
        body = undefined;
      }
    }
    throw new TranslationApiError(
      `${response.status} ${response.statusText} from ${url}`,
      response.status,
      body,
    );
  }

  const data = (await response.json()) as {
    data?: { id?: string }[];
    models?: { id?: string }[];
  };
  const rows = data.data ?? data.models ?? [];
  const ids: string[] = [];
  for (const row of rows) {
    if (row && typeof row.id === "string" && row.id.length > 0) {
      ids.push(row.id);
    }
  }
  ids.sort((a, b) => a.localeCompare(b));
  return ids;
}

/**
 * Probe the endpoint with a no-op request. Useful as a "Test connection"
 * affordance from the settings dialog.
 */
export async function pingEndpoint(
  settings: TranslationSettings,
  signal?: AbortSignal,
): Promise<{ ok: true; sample: string } | { ok: false; error: string }> {
  try {
    const reply = await chatCompletion(
      settings,
      {
        messages: [
          { role: "system", content: "You are a connectivity check." },
          {
            role: "user",
            content: 'Reply with the single word "OK" and nothing else.',
          },
        ],
        temperature: 0,
      },
      signal,
    );
    return { ok: true, sample: reply.trim().slice(0, 32) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
