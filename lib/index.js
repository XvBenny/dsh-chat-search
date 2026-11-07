/**
 * dsh-chat-search — full-text search over DSH conversation history.
 *
 * Full message bodies live in the per-session `session.v4.jsonl.zstd` logs
 * under `$DSH_HOME/sessions/<workspace>/<sessionId>/`. Each log is a sequence
 * of independently compressed zstd frames, each holding JSONL events. This
 * host half decompresses them and matches user/assistant message text.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";

export const name = "dsh-chat-search";
export const inject = ["webServer", "connection"];

const ZSTD_MAGIC = 0xfd2fb528;
const CACHE_LIMIT = 120;
const eventCache = new Map();
const sessionIndexCache = new Map();

function sessionsRoots() {
  const roots = [];
  const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
  roots.push(path.join(home, "sessions"));
  if (process.env.APPDATA) roots.push(path.join(process.env.APPDATA, "dsh-desktop", "harness", "sessions"));
  if (process.env.APPDATA) roots.push(path.join(process.env.APPDATA, "@deepseek-ai", "dsh-desktop", "harness", "sessions"));
  roots.push(path.join(process.cwd(), "sessions"));
  const unique = [...new Set(roots)];
  return unique.filter((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });
}

/** Split a buffer into adjacent zstd frames (the log is a frame sequence). */
function scanZstdFrames(buf) {
  const frames = [];
  let i = 0;
  while (i + 4 <= buf.length) {
    if (buf.readUInt32LE(i) === ZSTD_MAGIC) {
      if (frames.length > 0) frames[frames.length - 1].end = i;
      frames.push({ start: i, end: buf.length });
      i += 4;
    } else {
      i++;
    }
  }
  return frames;
}

function parseSessionFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const frames = scanZstdFrames(buf);
  const events = [];
  for (const frame of frames) {
    let text;
    try {
      text = zlib.zstdDecompressSync(buf.subarray(frame.start, frame.end)).toString("utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        /* skip malformed line */
      }
    }
  }
  return events;
}

function loadEvents(filePath, mtimeMs) {
  const cached = eventCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.events;
  const events = parseSessionFile(filePath);
  eventCache.set(filePath, { mtimeMs, events });
  if (eventCache.size > CACHE_LIMIT) {
    const oldest = eventCache.keys().next().value;
    eventCache.delete(oldest);
  }
  return events;
}

function decodeWorkspaceName(dirName) {
  let name = dirName;
  if (name.startsWith("--") && name.endsWith("--")) {
    name = name.slice(2, -2)
      .replace(/~([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/-/g, "/");
  }
  return name;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

function snippetAround(text, index, length, pad = 80) {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

/** Walk the sessions tree once; index each session's log path and mtime. */
function listSessionFiles() {
  const out = [];
  const seen = new Set();
  for (const root of sessionsRoots()) {
    let workspaces;
    try {
      workspaces = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ws of workspaces) {
      if (!ws.isDirectory()) continue;
      const wsPath = path.join(root, ws.name);
      let sessions;
      try {
        sessions = fs.readdirSync(wsPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of sessions) {
        if (!entry.isDirectory() || seen.has(entry.name)) continue;
        const file = path.join(wsPath, entry.name, "session.v4.jsonl.zstd");
        let stat;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        seen.add(entry.name);
        out.push({
          id: entry.name,
          file,
          mtimeMs: stat.mtimeMs,
          workspace: decodeWorkspaceName(ws.name),
        });
      }
    }
  }
  return out;
}

function search(query, limit) {
  const q = query.trim();
  const meta = { roots: sessionsRoots(), files: 0, matchedSessions: 0, totalMatches: 0, errors: [] };
  if (!q) return { query: q, total: 0, results: [], meta };
  const needle = q.toLowerCase();
  const results = [];
  const files = listSessionFiles();
  meta.files = files.length;
  for (const entry of files) {
    let events;
    try {
      events = loadEvents(entry.file, entry.mtimeMs);
    } catch (error) {
      meta.errors.push(`${entry.id}: ${String(error?.message ?? error)}`);
      continue;
    }
    let title = entry.id;
    let nodeCount = 0;
    const hits = [];
    for (const ev of events) {
      if (ev.type === "session/title" && ev.data?.title) {
        title = ev.data.title;
        continue;
      }
      let role = null;
      let text = "";
      let turn = null;
      let nodeKey = null;
      if (ev.type === "user/message") {
        role = "user";
        turn = ev.data?.turn ?? ev.turn ?? 0;
        nodeKey = ev.data?.id ?? String(ev.seq ?? "");
        text = extractText(ev.data?.content);
      } else if (ev.type === "assistant/message") {
        role = "assistant";
        turn = ev.data?.turn ?? 0;
        nodeKey = ev.data?.message?.id ?? ev.data?.id ?? String(ev.seq ?? "");
        text = extractText(ev.data?.message?.content);
      } else {
        continue;
      }
      nodeCount += 1;
      if (!text) continue;
      const index = text.toLowerCase().indexOf(needle);
      if (index === -1) continue;
      hits.push({
        cat: role,
        role,
        turn,
        nodeKey,
        seq: ev.seq ?? null,
        time: ev.time ?? entry.mtimeMs,
        snippet: snippetAround(text, index, q.length),
      });
      if (hits.length >= 30) break;
    }
    if (hits.length) {
      meta.matchedSessions += 1;
      meta.totalMatches += hits.length;
      results.push({
        id: entry.id,
        title,
        workspace: entry.workspace,
        time: entry.mtimeMs,
        count: hits.length,
        hits: hits.slice(0, 10),
      });
    }
  }
  results.sort((a, b) => b.time - a.time);
  return { query: q, total: results.length, results: results.slice(0, limit), meta };
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>对话搜索</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;background:#0f1115;color:#e6e8ee;padding:32px}
input{width:60%;padding:10px;font-size:15px;background:#171a21;color:#e6e8ee;border:1px solid #2a2f3a;border-radius:8px}
button{padding:10px 18px;background:#4d6bfe;color:#fff;border:none;border-radius:8px;cursor:pointer}
pre{white-space:pre-wrap;font-size:13px;color:#c9cede}</style></head>
<body><h2>对话搜索</h2><p><input id="q" placeholder="关键词"><button id="go">搜索</button></p><pre id="out"></pre>
<script>document.getElementById('go').onclick=async()=>{const q=document.getElementById('q').value;
const r=await fetch('/chat-search/api?q='+encodeURIComponent(q));document.getElementById('out').textContent=JSON.stringify(await r.json(),null,2)};</script>
</body></html>`;

export function apply(ctx) {
  const fence = (req) => ctx.connection.requestRejection(req) === undefined;

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: "/chat-search",
        handler: async (req, res) => {
          if (!fence(req)) {
            res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
            res.end("forbidden");
            return;
          }
          const url = new URL(req.url, "http://localhost");
          if (url.pathname === "/chat-search" || url.pathname === "/chat-search/") {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(PAGE);
            return;
          }
          if (url.pathname === "/chat-search/api") {
            const q = url.searchParams.get("q") ?? "";
            const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
            let payload;
            try {
              payload = search(q, limit);
            } catch (error) {
              payload = { query: q, total: 0, results: [], meta: { errors: [String(error?.message ?? error)] } };
            }
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(payload));
            return;
          }
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
        },
      }),
    "dsh-chat-search: /chat-search routes",
  );
}
