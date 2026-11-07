# dsh-chat-search

Full-text search over your DeepSeek Harness conversation history, with
click-to-jump results.

DSH's built-in `Ctrl+K` search only matches **session titles**. This plugin
searches the **full message bodies** of every stored conversation and opens the
matching session at the matching message.

## Features

- Full-text search across all workspaces and sessions (archived included)
- Results grouped by session, with keyword highlighting and workspace name
- Click a hit to open its session and scroll to / flash the message
- Archived sessions are unarchived and opened (the DSH UI service has no
  "open archived in place" action)
- Case-insensitive literal substring matching (no regex)
- Read-only, local-only: message bodies never leave your machine

## Install

```bash
dsh plugin --profile desktop add https://gitee.com/vrgu/dsh-chat-search.git
```

or from a local checkout:

```bash
dsh plugin --profile desktop add ./dsh-chat-search
```

Restart DSH after installing.

## Use

1. Press `Ctrl+F` (`Cmd+F` on macOS) anywhere in the DSH Web GUI, or click the
   magnifier icon of the **对话搜索 / Chat Search** panel in the right sidebar.
2. Type a keyword and press Enter.
3. Click any hit to jump to that message.

## How it works

Message bodies are not stored in the projection cache; they live in the
per-session `session.v4.jsonl.zstd` logs under
`$DSH_HOME/sessions/<workspace>/<sessionId>/`. The host half decompresses those
zstd frame sequences and matches `user/message` and `assistant/message` text.

The browser half registers a `sidebar.panellist` slot. On click it opens the
session through the harness UI service (`uiWorkspace.openSession`, with
`unarchiveSession` for archived sessions) and then scrolls to the matching
message row using the chat DOM anchors.

## Limits

- Only user/assistant message prose is searched — reasoning, tool calls and
  tool results are excluded.
- Literal substring match; no regex, fuzzy, or semantic search.
- Archived results are unarchived when opened (the session leaves the archive).

## License

MIT
