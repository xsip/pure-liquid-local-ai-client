/**
 * Shared chat message interface and utility functions used across
 * both the LM Studio and OpenAI chat services.
 */

export interface ChatMessage {
  role:
    | 'user'
    | 'ai'
    | 'error'
    | 'info'
    | 'tool_call'
    | 'reasoning'
    | 'prompt_processing'
    | 'mcp_list_tools';
  text?: string;
  image?: string;
  /** Data URL (audio/wav base64) for a recorded voice message. */
  audio?: string;
  /** True when `audio` was transcribed server-side and should stay hidden
   * behind its transcript (shown as `text`) instead of an audio player. */
  audioHidden?: boolean;
  file?: string;
  date?: Date;
  username?: string;
  /** Model name used to generate this AI message. */
  usedModel?: string;
  stats?: string;
  streaming?: boolean;
  toolName?: string;
  toolArguments?: object;
  toolOutput?: string;
  toolFailed?: boolean;
  providerLabel?: string;
  collapsed?: boolean;
  total?: number;
  progressMessage?: string;
  progress?: number; // 0–1, used by prompt_processing
  itemId?: string; // track by OpenAI item id
}

/**
 * Returns the index of the last message matching the predicate, or -1.
 */
export function lastIndexWhere(
  msgs: ChatMessage[],
  pred: (m: ChatMessage) => boolean,
): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (pred(msgs[i])) return i;
  }
  return -1;
}

/**
 * Returns a new message array with the last message matching `pred`
 * shallow-merged with `patch`. Returns the original array unchanged
 * if no match is found.
 */
export function patchLast(
  msgs: ChatMessage[],
  pred: (m: ChatMessage) => boolean,
  patch: Partial<ChatMessage>,
): ChatMessage[] {
  const idx = lastIndexWhere(msgs, pred);
  if (idx === -1) return msgs;
  const copy = [...msgs];
  copy[idx] = { ...copy[idx], ...patch };
  return copy;
}

/**
 * Returns a new message array with the last message whose `itemId`
 * matches shallow-merged with `patch`.
 */
export function patchByItemId(
  msgs: ChatMessage[],
  itemId: string,
  patch: Partial<ChatMessage>,
): ChatMessage[] {
  return patchLast(msgs, (m) => m.itemId === itemId, patch);
}

/**
 * Marks all currently-streaming messages as no longer streaming,
 * collapsing tool_call / reasoning entries.
 * Optionally applies `stats` to the last AI message.
 */
export function finalizeStreamingMessages(
  msgs: ChatMessage[],
  stats?: string,
): ChatMessage[] {
  return msgs.map((m) => {
    if (m.role === 'ai' && m.streaming) return { ...m, streaming: false, stats };
    if ((m.role === 'tool_call' || m.role === 'reasoning') && m.streaming) {
      return { ...m, streaming: false, collapsed: true };
    }
    return m;
  });
}

/**
 * Safely parses a JSON value. Returns the object unchanged if it is
 * already an object, parses string values, and returns `undefined` for
 * anything else or on parse errors.
 */
export function safeParseJson(value: unknown): object | undefined {
  if (typeof value === 'object' && value !== null) return value as object;
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
