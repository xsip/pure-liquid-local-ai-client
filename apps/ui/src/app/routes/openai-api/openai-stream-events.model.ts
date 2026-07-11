/**
 * SSE event shapes shared by the Chat Completions stream client
 * (completions-openai-stream.service.ts) and its consumer (chat-completions.service.ts).
 */

export interface OpenAiStreamErrorEvent {
  type: 'error';
  message?: string;
  error?: { message: string; type: string; param: string };
}

export interface OpenAiStreamApiInfoEvent {
  type: 'api.info';
  message: string;
}

export interface AudioTranscriptEvent {
  type: 'audio_transcript';
  transcript: string;
}

export interface OpenAiChatEnd {
  responseId: string;
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    output_tokens_details?: { reasoning_tokens: number };
  };
}
