// Tool icon mapping for the Hermes dashboard.
// All icons from https://icones.js.org — Phosphor (ph:) and Material Design (mdi:) preferred.
// Used by UChatTool in session/[id].vue and chat/[id].vue.

const toolIconMap: Record<string, string> = {
  // === Copied from session/[id].vue switch (kept as-is) ===
  session_search: "ic:round-manage-search",
  vision_analysis: "material-symbols-light:eye-tracking",
  search_files: "tdesign:folder-search-filled",
  terminal: "hugeicons:bash",
  read_file: "ph:file-text",
  write_file: "ph:pencil-line",
  patch: "ph:file-diff",
  execute_code: "ph:code",
  web_search: "ph:globe",
  web_extract: "ph:link-simple",
  memory: "ph:database",

  // --- New additions ---
  process: "ph:list-bullets",
  todo: "ph:clipboard-text",
  clarify: "ph:question",
  delegate_task: "ph:users-three",
  cronjob: "ph:clock",
  send_message: "ph:paper-plane-right",
  text_to_speech: "ph:speaker-high",
  read_terminal: "ph:terminal-window",
  skill_manage: "ph:wrench",
  skill_view: "ph:book-open",
  skills_list: "ph:list",

  // --- Vision & Media ---
  vision_analyze: "ph:eye",
  video_analyze: "ph:video",
  image_generate: "ph:image",
  video_generate: "ph:video-camera",

  // --- Browser ---
  browser_navigate: "ph:compass",
  browser_snapshot: "ph:tree-structure",
  browser_click: "ph:cursor-click",
  browser_type: "ph:keyboard",
  browser_scroll: "ph:arrows-down-up",
  browser_back: "ph:arrow-left",
  browser_press: "ph:key-return",
  browser_get_images: "ph:images",
  browser_vision: "ph:camera",
  browser_console: "ph:terminal",
  browser_cdp: "ph:bug",
  browser_dialog: "ph:warning-circle",

  // --- Computer Use ---
  computer_use: "ph:monitor",

  // --- Project ---
  project_list: "ph:columns",
  project_create: "ph:plus-square",
  project_switch: "ph:arrows-horizontal",

  // --- X / Twitter ---
  x_search: "ph:twitter-logo",

  // --- Home Assistant ---
  ha_list_entities: "ph:lightbulb",
  ha_get_state: "ph:info",
  ha_list_services: "ph:list",
  ha_call_service: "ph:plug",

  // --- Kanban ---
  kanban_show: "ph:columns",
  kanban_list: "ph:list",
  kanban_create: "ph:plus",
  kanban_complete: "ph:check-circle",
  kanban_block: "ph:prohibit",
  kanban_unblock: "ph:x-circle",
  kanban_heartbeat: "ph:heartbeat",
  kanban_comment: "ph:chat-text",
  kanban_link: "ph:link",

  // --- Messaging ---
  discord: "ph:discord-logo",
  discord_admin: "ph:shield",

  // --- Yuanbao ---
  yb_query_group_info: "ph:info",
  yb_query_group_members: "ph:users",
  yb_send_dm: "ph:paper-plane-right",
  yb_search_sticker: "ph:sticker",
  yb_send_sticker: "ph:sticker",

  // --- Feishu / Lark ---
  feishu_doc_read: "ph:file-text",
  feishu_drive_list_comments: "ph:chat-dots",
  feishu_drive_list_comment_replies: "ph:arrow-bend-right-up",
  feishu_drive_reply_comment: "ph:arrow-bend-right",
  feishu_drive_add_comment: "ph:chat-plus",

  // --- Health ---
  health_report: "ph:heartbeat",

  // --- MCP (dynamic tools) ---
  // Generic fallback: mcp_* tools get mapped here if no specific override set
};

/**
 * Resolve the icon name for a Hermes tool call name.
 * Returns the mapped icon or a default bolt icon as fallback.
 */
export function toolIcon(name: string): string {
  return toolIconMap[name] || "i-lucide-bolt";
}
