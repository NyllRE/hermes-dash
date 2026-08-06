export interface HermesStatus {
  version: string;
  gateway_state: string | null;
  gateway_platforms: Record<string, { connected: boolean; display_name?: string }>;
  active_sessions: number;
  active_agents: number;
  auth_required: boolean;
}

export interface HermesSession {
  id: string;
  source: string;
  model?: string;
  title: string;
  started_at: number;
  ended_at?: number | null;
  end_reason?: string | null;
  last_active: number;
  message_count: number;
  preview?: string;
  is_active: boolean;
  archived?: boolean;
  profile?: string;
}

export interface HermesModelInfo {
  model: string;
  provider: string;
  auto_context_length: number;
  effective_context_length: number;
}

export interface HermesMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: ToolCall[] | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  timestamp: number;
  token_count?: number | null;
  finish_reason?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
}

export interface HermesSessionDetail extends HermesSession {
  messages?: HermesMessage[];
}

export type SessionStatusLabel = "running" | "waiting" | "stalled" | "ended";

export interface SessionStatus {
  label: SessionStatusLabel;
  color: "success" | "warning" | "neutral" | "info";
  icon?: string;
}

export interface LocalMessage {
  role: string;
  content: string;
  tool_calls?: StreamingToolCall[];
}

export interface DisplayToolCall {
  id?: string;
  index?: number;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
  name?: string;
  result?: string;
}

export interface DisplayMessage {
  id: string;
  role: string;
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  createdAt: Date;
  reasoning_content?: string | null;
  tool_calls?: DisplayToolCall[];
  tool_name?: string | null;
  tool_call_id?: string | null;
  token_count?: number | null;
  finish_reason?: string | null;
}

// ── Tool type system ──────────────────────────────────────────────

/** All known Hermes tool names, grouped by category in comments. */
export type CoreToolName =
  | "read_file" | "write_file" | "patch" | "search_files"
  | "terminal" | "execute_code" | "web_search" | "web_extract"
  | "memory" | "process" | "todo" | "clarify"
  | "delegate_task" | "cronjob" | "session_search"
  | "read_terminal" | "skill_manage" | "skill_view" | "skills_list"
  | "send_message" | "text_to_speech";

export type VisionMediaToolName =
  | "vision_analyze" | "video_analyze"
  | "image_generate" | "video_generate";

export type BrowserToolName =
  | "browser_navigate" | "browser_snapshot" | "browser_click"
  | "browser_type" | "browser_scroll" | "browser_back"
  | "browser_press" | "browser_get_images" | "browser_vision"
  | "browser_console" | "browser_cdp" | "browser_dialog";

export type ComputerUseToolName = "computer_use";

export type ProjectToolName =
  | "project_list" | "project_create" | "project_switch";

export type XToolName = "x_search";

export type HomeAssistantToolName =
  | "ha_list_entities" | "ha_get_state"
  | "ha_list_services" | "ha_call_service";

export type KanbanToolName =
  | "kanban_show" | "kanban_list" | "kanban_create"
  | "kanban_complete" | "kanban_block" | "kanban_unblock"
  | "kanban_heartbeat" | "kanban_comment" | "kanban_link";

export type MessagingToolName = "discord" | "discord_admin";

export type YuanbaoToolName =
  | "yb_query_group_info" | "yb_query_group_members"
  | "yb_send_dm" | "yb_search_sticker" | "yb_send_sticker";

export type FeishuToolName =
  | "feishu_doc_read" | "feishu_drive_list_comments"
  | "feishu_drive_list_comment_replies" | "feishu_drive_reply_comment"
  | "feishu_drive_add_comment";

export type HealthToolName = "health_report";

export type ToolName =
  | CoreToolName | VisionMediaToolName | BrowserToolName
  | ComputerUseToolName | ProjectToolName | XToolName
  | HomeAssistantToolName | KanbanToolName | MessagingToolName
  | YuanbaoToolName | FeishuToolName | HealthToolName
  | `mcp_${string}`;

export type ToolCategory =
  | "core" | "vision_media" | "browser" | "computer_use"
  | "project" | "x" | "home_assistant" | "kanban"
  | "messaging" | "yuanbao" | "feishu" | "health" | "mcp";

// ── Tool argument types ──────────────────────────────────────────

export interface TerminalArgs {
  command: string;
  timeout?: number;
}

export interface TerminalResult {
  output: string;
  error?: string;
  exit_code: number;
}

export interface VisionToolArgs {
  image_url: string;
  question: string;
}

export interface BrowserNavigateArgs {
  url: string;
}

export interface BrowserClickArgs {
  ref: string;
}

export interface BrowserTypeArgs {
  ref: string;
  text: string;
}

export interface BrowserScrollArgs {
  direction: "up" | "down";
  amount?: number;
}

export interface BrowserSnapshotArgs {
  target?: string;
}

export interface BrowserPressArgs {
  key: string;
}

export interface FileReadArgs {
  path: string;
}

export interface FileWriteArgs {
  path: string;
  content: string;
}

export interface PatchArgs {
  path: string;
  old_string: string;
  new_string: string;
}

export interface SearchFilesArgs {
  query: string;
  path?: string;
}

export interface WebSearchArgs {
  query: string;
}

export interface MemoryArgs {
  key: string;
  value: string;
}

export interface TodoArgs {
  action: "add" | "update" | "delete" | "list";
  task?: string;
  id?: string;
  status?: string;
}

export interface ClarifyArgs {
  question: string;
  options?: string[];
}

export interface CronjobArgs {
  action: "create" | "pause" | "resume" | "delete" | "list";
  id?: string;
  schedule?: string;
  command?: string;
}

export interface SessionSearchArgs {
  query: string;
  limit?: number;
}

export interface SessionSearchResult {
  results?: Array<{
    session?: { title: string };
    title?: string;
  }>;
  analysis?: string;
}

export interface DelegateTaskArgs {
  task: string;
  context?: string;
}

export interface ComputerUseArgs {
  action:
    | "capture" | "click" | "double_click" | "right_click" | "middle_click"
    | "drag" | "scroll" | "type" | "key" | "set_value"
    | "wait" | "list_apps" | "focus_app";
  x?: number;
  y?: number;
  key?: string;
  text?: string;
  app_name?: string;
  scroll_x?: number;
  scroll_y?: number;
}

export interface DiscordArgs {
  action: "send" | "edit" | "react" | "reply";
  channel_id?: string;
  message_id?: string;
  content?: string;
  emoji?: string;
}

export interface HealthReportResult {
  status: string;
  issues?: Array<{
    severity: "error" | "warning" | "info";
    message: string;
  }>;
}

/** Union of all typed tool argument shapes, keyed by tool name. */
export interface ToolArgsMap {
  terminal: TerminalArgs;
  vision_analyze: VisionToolArgs;
  browser_navigate: BrowserNavigateArgs;
  browser_click: BrowserClickArgs;
  browser_type: BrowserTypeArgs;
  browser_scroll: BrowserScrollArgs;
  browser_snapshot: BrowserSnapshotArgs;
  browser_press: BrowserPressArgs;
  read_file: FileReadArgs;
  write_file: FileWriteArgs;
  patch: PatchArgs;
  search_files: SearchFilesArgs;
  web_search: WebSearchArgs;
  memory: MemoryArgs;
  todo: TodoArgs;
  clarify: ClarifyArgs;
  cronjob: CronjobArgs;
  session_search: SessionSearchArgs;
  delegate_task: DelegateTaskArgs;
  computer_use: ComputerUseArgs;
  discord: DiscordArgs;
}

/** Union of all typed tool result shapes, keyed by tool name. */
export interface ToolResultMap {
  terminal: TerminalResult;
  session_search: SessionSearchResult;
  health_report: HealthReportResult;
}

/** Resolve args type for a given tool name. Falls back to Record. */
export type ToolArgsFor<N extends string> =
  N extends keyof ToolArgsMap ? ToolArgsMap[N] : Record<string, unknown>;

/** Resolve result type for a given tool name. Falls back to Record. */
export type ToolResultFor<N extends string> =
  N extends keyof ToolResultMap ? ToolResultMap[N] : Record<string, unknown>;

/** A tool call attached to an assistant message (OpenAI format). */
export interface ToolCall {
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
}

/** A tool call with its result attached (after pairing). */
export interface ToolCallWithResult<N extends string = string> extends ToolCall {
  result?: string;
  parsedArgs?: ToolArgsFor<N>;
  parsedResult?: ToolResultFor<N>;
  index?: number;
}

/** A tool call being assembled during SSE streaming (has index for ordering). */
export interface StreamingToolCall extends ToolCall {
  index: number;
}

/** Tool-role message referencing a tool call result. */
export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
  tool_name?: string;
}
