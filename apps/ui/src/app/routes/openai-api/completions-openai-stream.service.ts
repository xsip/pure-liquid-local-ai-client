import { inject, Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { Router } from '@angular/router';
import {
  ChatCompletionChunkDto,
  CompletionsStreamOpenAiRequest,
  CreateChatMetadataDto,
} from '../../client';
import { AudioTranscriptEvent, OpenAiChatEnd, OpenAiStreamErrorEvent } from './openai-stream-events.model';

export interface McpCallProgressEvent {
  type: 'response.mcp_call.in_progress' | 'response.mcp_call.completed';
  name: string;
  arguments?: Record<string, unknown>;
  output?: string;
}

export interface McpReportProgressEvent {
  type: 'api_report_mcp_progress';
  progressToken: string;
  progress: string | number;
  total?: string | number;
  message?: string;
}

export interface CreatedChatEvent {
  type: 'created_chat';
  result: string;
}

export interface UserMessageEchoEvent {
  type: 'user_message_echo';
  messages: any[];
}

export interface ApiInfoEvent {
  type: 'api.info';
  message: string;
}

export interface ToolApprovalRequiredEvent {
  type: 'response.tool_approval.required';
  requestId: string;
  name: string;
  arguments?: Record<string, unknown>;
}

export type OpenAiEvent =
  | ChatCompletionChunkDto
  | McpCallProgressEvent
  | McpReportProgressEvent
  | CreatedChatEvent
  | UserMessageEchoEvent
  | ApiInfoEvent
  | ToolApprovalRequiredEvent
  | AudioTranscriptEvent
  | OpenAiStreamErrorEvent;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class OpenAiStreamService {
  private _events$ = new ReplaySubject<OpenAiEvent>(Infinity);
  private _messageDelta$ = new ReplaySubject<string>(Infinity);
  private _reasoningDelta$ = new ReplaySubject<string>(Infinity);
  private _chatEnd$ = new ReplaySubject<OpenAiChatEnd>(1);
  private _chatCreated$ = new ReplaySubject<string>(1);
  private _userMessageEcho$ = new ReplaySubject<any[]>(1);
  private _audioTranscript$ = new ReplaySubject<string>(1);

  get events$(): Observable<OpenAiEvent> {
    return this._events$.asObservable();
  }
  get messageDelta$(): Observable<string> {
    return this._messageDelta$.asObservable();
  }
  get reasoningDelta$(): Observable<string> {
    return this._reasoningDelta$.asObservable();
  }
  get chatEnd$(): Observable<OpenAiChatEnd> {
    return this._chatEnd$.asObservable();
  }
  get newChatCreated$(): Observable<string> {
    return this._chatCreated$.asObservable();
  }
  get userMessageEcho$(): Observable<any[]> {
    return this._userMessageEcho$.asObservable();
  }
  get audioTranscript$(): Observable<string> {
    return this._audioTranscript$.asObservable();
  }

  router = inject(Router);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async chat(
    body: CompletionsStreamOpenAiRequest,
    chatId?: string,
    newChatOptions?: {
      name?: string;
      letAiDecideChatName?: boolean;
      useCrypto?: boolean;
      cryptoKey?: string;
      openAiEndpointPreference?: CreateChatMetadataDto.OpenAiEndpointPreferenceEnum;
      useInvoke?: boolean;
      invokeAiModelToUse?: string;
      transcribeAudio?: boolean;
      toolsRequireApproval?: boolean;
      mcpOverrides?: Array<{ mcpId: string; active: boolean; allowedTools: string[] }>;
    },
  ): Promise<void> {
    try {
      const token = localStorage.getItem('jwt_token');
      const params = new URLSearchParams();
      if (chatId) params.set('internalChatId', chatId);
      if (!chatId && newChatOptions) {
        if (newChatOptions.name) params.set('chatName', newChatOptions.name);
        if (newChatOptions.letAiDecideChatName != null)
          params.set('letAiDecideChatName', String(newChatOptions.letAiDecideChatName));
        if (newChatOptions.useCrypto != null)
          params.set('useCrypto', String(newChatOptions.useCrypto));
        if (newChatOptions.cryptoKey) params.set('cryptoKey', newChatOptions.cryptoKey);
        if (newChatOptions.openAiEndpointPreference)
          params.set('openAiEndpointPreference', newChatOptions.openAiEndpointPreference);
        if (newChatOptions.useInvoke != null)
          params.set('useInvoke', String(newChatOptions.useInvoke));
        if (newChatOptions.invokeAiModelToUse)
          params.set('invokeModel', newChatOptions.invokeAiModelToUse);
        if (newChatOptions.transcribeAudio != null)
          params.set('transcribeAudio', String(newChatOptions.transcribeAudio));
        if (newChatOptions.toolsRequireApproval != null)
          params.set('toolsRequireApproval', String(newChatOptions.toolsRequireApproval));
        if (newChatOptions.mcpOverrides?.length)
          params.set('mcpOverrides', JSON.stringify(newChatOptions.mcpOverrides));
      }
      const queryString = params.toString();
      const url = `api/openai/completions-stream${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          localStorage.removeItem('jwt_token');
          this.router.navigate(['/login']);
          return;
        } else if (response.status === 403 || response.status === 500) {
          this._events$.next({
            type: 'api.info',
            message: (await response.json())?.message ?? 'Request failed',
          });
          this._events$.complete();
        }
        return;
      }

      await this.consumeStream(response.body);

      this._events$.complete();
      this._messageDelta$.complete();
      this._reasoningDelta$.complete();
    } catch (err) {
      this._events$.error(err);
    }
  }

  /**
   * Reconnects to a generation already in-flight for `chatId` (e.g. after a
   * page refresh, or when a shared-chat viewer notices the chat just became
   * locked). Replays everything already streamed, then keeps receiving live
   * chunks through the same dispatch pipeline as `chat()`. Resolves once the
   * generation finishes — including immediately, with no data, if nothing
   * was actually in-flight for this chat.
   */
  async resume(chatId: string): Promise<void> {
    try {
      const token = localStorage.getItem('jwt_token');
      const url = `api/openai/completions-stream/resume?internalChatId=${encodeURIComponent(chatId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          localStorage.removeItem('jwt_token');
          this.router.navigate(['/login']);
        }
        this._events$.complete();
        this._messageDelta$.complete();
        this._reasoningDelta$.complete();
        return;
      }

      await this.consumeStream(response.body);

      this._events$.complete();
      this._messageDelta$.complete();
      this._reasoningDelta$.complete();
    } catch (err) {
      this._events$.error(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Stream consumption
  // ---------------------------------------------------------------------------

  private async consumeStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const event = this.parseSseBlock(part);
        if (event) this.dispatch(event);
      }
    }

    if (buffer.trim()) {
      const event = this.parseSseBlock(buffer);
      if (event) this.dispatch(event);
    }
  }

  // ---------------------------------------------------------------------------
  // SSE parsing
  // ---------------------------------------------------------------------------

  private parseSseBlock(block: string): OpenAiEvent | null {
    let dataLine: string | null = null;

    for (const line of block.split('\n')) {
      if (line.startsWith('data:')) {
        dataLine = line.slice('data:'.length).trim();
      }
    }

    if (!dataLine || dataLine === '[DONE]') return null;

    try {
      return JSON.parse(dataLine) as OpenAiEvent;
    } catch {
      console.warn('[OpenAiStreamService] Failed to parse SSE data:', dataLine);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  private dispatch(event: OpenAiEvent): void {
    this._events$.next(event);

    const kind = (event as any).object ?? (event as any).type;

    switch (kind) {
      case 'created_chat':
        this._chatCreated$.next((event as CreatedChatEvent).result);
        this._chatCreated$.complete();
        break;

      case 'user_message_echo':
        this._userMessageEcho$.next((event as UserMessageEchoEvent).messages);
        this._userMessageEcho$.complete();
        break;

      case 'audio_transcript':
        this._audioTranscript$.next((event as AudioTranscriptEvent).transcript);
        break;

      case 'error':
        console.error(
          '[OpenAiStreamService] Stream error:',
          (event as OpenAiStreamErrorEvent).message ??
            (event as OpenAiStreamErrorEvent).error?.message,
        );
        break;

      case 'response.mcp_call.in_progress':
      case 'response.mcp_call.completed':
      case 'api_report_mcp_progress':
        // handled by consumers via events$
        break;

      case 'chat.completion.chunk': {
        const chunk = event as any as ChatCompletionChunkDto;
        const choice = chunk.choices?.[0] as any;
        const delta = choice?.delta as
          | { content?: string; reasoning_content?: string }
          | undefined;
        if (delta?.reasoning_content) {
          this._reasoningDelta$.next(delta.reasoning_content);
        }
        if (delta?.content) {
          this._messageDelta$.next(delta.content);
        }
        // 'tool_calls' isn't the end of the turn — the backend loops back into
        // the model after executing tools, so only finalize on a true stop.
        if (choice?.finish_reason && choice.finish_reason !== 'tool_calls') {
          this._chatEnd$.next({
            responseId: chunk.id,
            model: chunk.model,
          });
          this._chatEnd$.complete();
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  reset(): void {
    this._events$.complete();
    this._chatCreated$.complete();
    this._messageDelta$.complete();
    this._reasoningDelta$.complete();
    this._userMessageEcho$.complete();
    this._audioTranscript$.complete();
    this._events$ = new ReplaySubject<OpenAiEvent>(Infinity);
    this._messageDelta$ = new ReplaySubject<string>(Infinity);
    this._reasoningDelta$ = new ReplaySubject<string>(Infinity);
    this._chatEnd$ = new ReplaySubject<OpenAiChatEnd>(1);
    this._chatCreated$ = new ReplaySubject<string>(1);
    this._userMessageEcho$ = new ReplaySubject<any[]>(1);
    this._audioTranscript$ = new ReplaySubject<string>(1);
  }
}
