import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface McpToolHeaders {
  authorization?: string;
  chatId?: string;
  requestId?: string;
}

export interface McpToolContentPart {
  type: string;
  text?: string;
  mimeType?: string;
  data?: string;
}

export interface OpenAiFunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Connects to configured MCP servers as a client, replacing the backend's
 * built-in MCP orchestration (disabled by LM Studio for localhost servers).
 * Each call opens a short-lived connection so per-request auth headers can
 * be forwarded, mirroring what apps/api/src/tools/api.tools.ts reads off
 * the raw request headers.
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private readonly serverUrls: string[];

  constructor(private readonly configService: ConfigService) {
    const selfMcpUrl = this.configService.get<string>(
      'SELF_MCP_URL',
      'http://192.128.0.34:8888/tools/mcp',
    );
    const extraUrls = this.configService
      .get<string>('MCP_SERVER_URLS', '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    this.serverUrls = [selfMcpUrl, ...extraUrls];
  }

  private async connect(
    headers: McpToolHeaders,
    endpoint?: string,
    customHeaders?: Record<string, string>,
  ): Promise<Client> {
    const client = new Client({
      name: 'pure-liquid-local-ai-client-mcp-client',
      version: '1.0.0',
    });

    const requestHeaders: Record<string, string> = { ...customHeaders };
    if (headers.authorization)
      requestHeaders.authorization = headers.authorization;
    if (headers.chatId) requestHeaders.chatid = headers.chatId;
    if (headers.requestId) requestHeaders.requestid = headers.requestId;

    const transport = new StreamableHTTPClientTransport(
      new URL(endpoint ?? this.serverUrls[0]),
      { requestInit: { headers: requestHeaders } },
    );

    await client.connect(transport);
    return client;
  }

  async listTools(
    headers: McpToolHeaders,
    allowedToolNames?: string[],
    endpoint?: string,
    customHeaders?: Record<string, string>,
  ): Promise<OpenAiFunctionTool[]> {
    const client = await this.connect(headers, endpoint, customHeaders);
    try {
      const { tools } = await client.listTools();
      return tools
        .filter(
          (tool) => !allowedToolNames || allowedToolNames.includes(tool.name),
        )
        .map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: (tool.inputSchema ?? {
              type: 'object',
              properties: {},
            }) as Record<string, unknown>,
          },
        }));
    } finally {
      await client.close();
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    headers: McpToolHeaders,
    endpoint?: string,
    customHeaders?: Record<string, string>,
  ): Promise<string | McpToolContentPart[]> {
    const client = await this.connect(headers, endpoint, customHeaders);
    try {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as McpToolContentPart[];

      // Image parts must reach the caller untouched so it can build a
      // multimodal data-URI message instead of collapsing them to text/JSON.
      const hasImagePart = (content ?? []).some((part) => part.type === 'image');
      if (hasImagePart) return content ?? [];

      const textParts = (content ?? [])
        .filter((part) => part.type === 'text' && part.text)
        .map((part) => part.text as string);

      if (textParts.length > 0) return textParts.join('\n');
      return JSON.stringify(content ?? result);
    } catch (error: any) {
      this.logger.error(`MCP tool call failed for "${name}": ${error.message}`);
      return JSON.stringify({ error: error.message ?? 'Tool call failed' });
    } finally {
      await client.close();
    }
  }

  /**
   * Connects to an arbitrary MCP server (used when a user registers a custom
   * server) and returns its display name plus the tool names it exposes.
   */
  async discoverServer(
    endpoint: string,
    customHeaders?: Record<string, string>,
  ): Promise<{ name: string; tools: string[] }> {
    const client = await this.connect({}, endpoint, customHeaders);
    try {
      const version = client.getServerVersion();
      const { tools } = await client.listTools();
      return {
        name: version?.name ?? endpoint,
        tools: tools.map((tool) => tool.name),
      };
    } finally {
      await client.close();
    }
  }
}
