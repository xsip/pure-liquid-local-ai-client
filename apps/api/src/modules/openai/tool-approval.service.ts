import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type ToolApprovalDecision = 'approve' | 'deny' | 'always';

interface PendingApproval {
  resolve: (decision: ToolApprovalDecision) => void;
}

/**
 * Gates tool/MCP calls behind a user approval step when a chat has
 * `toolsRequireApproval` enabled. The generation loop in `OpenaiService`
 * awaits `request().promise` before invoking a tool; the frontend resolves
 * it via `POST openai/tool-approval/:requestId`.
 */
@Injectable()
export class ToolApprovalService {
  private readonly pending = new Map<string, PendingApproval>();
  /** Tools marked "always allow" for a given chat, for the lifetime of the process. */
  private readonly alwaysAllowed = new Map<string, Set<string>>();

  request(): { requestId: string; promise: Promise<ToolApprovalDecision> } {
    const requestId = randomUUID();
    const promise = new Promise<ToolApprovalDecision>((resolve) => {
      this.pending.set(requestId, { resolve });
    });
    return { requestId, promise };
  }

  resolve(requestId: string, decision: ToolApprovalDecision): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    this.pending.delete(requestId);
    entry.resolve(decision);
    return true;
  }

  isAlwaysAllowed(chatId: string, toolName: string): boolean {
    return this.alwaysAllowed.get(chatId)?.has(toolName) ?? false;
  }

  markAlwaysAllowed(chatId: string, toolName: string): void {
    const set = this.alwaysAllowed.get(chatId) ?? new Set<string>();
    set.add(toolName);
    this.alwaysAllowed.set(chatId, set);
  }
}
