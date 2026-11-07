/**
 * dsh-chat-search — browser half.
 *
 * A right-sidebar magnifier opens a centered search dialog over full
 * conversation history. Clicking a hit opens the target session through the
 * harness UI service (`uiWorkspace.openSession`, with `unarchiveSession` for
 * archived sessions) and then scrolls to and flashes the matching message.
 *
 * Hand-written ModuleLoader bundle — no build step required.
 */
window.__ModuleLoader__.load({
  id: "dsh-chat-search",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var h = react.createElement;
    var inject = ["slots"];
    var services = null;

    var CSS = [
      ".cs-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;padding:16px;box-sizing:border-box;font-size:13px;color:var(--dsw-alias-label-primary)}",
      ".cs-bar{display:flex;gap:8px;flex:none}",
      ".cs-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;outline:none;box-sizing:border-box}",
      ".cs-input:focus{border-color:var(--dsw-alias-state-business-primary,#3964fe)}",
      ".cs-btn{flex:none;border:1px solid var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff;border-radius:8px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer}",
      ".cs-btn:disabled{opacity:.6;cursor:default}",
      ".cs-status{color:var(--dsw-alias-label-tertiary);font-size:12px;flex:none;word-break:break-all;overflow-wrap:anywhere;white-space:pre-wrap;max-height:140px;overflow:auto}",
      ".cs-list{display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:0;padding-right:2px;max-height:52vh}",
      ".cs-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03))}",
      ".cs-title{font-size:13px;font-weight:600;margin:0 0 4px;word-break:break-word}",
      ".cs-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-bottom:8px}",
      ".cs-badge{display:inline-block;font-size:10px;padding:0 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);margin-left:6px}",
      ".cs-hit{border-left:2px solid var(--dsw-alias-border-l2);padding:4px 0 4px 10px;margin:6px 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));word-break:break-word;cursor:pointer;border-radius:0 6px 6px 0}",
      ".cs-hit:hover{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06))}",
      ".cs-cat{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-right:6px;text-transform:uppercase}",
      ".cs-mark{background:rgba(77,107,254,.25);color:inherit;border-radius:3px;padding:0 2px}",
      ".cs-collapsed{display:flex;align-items:center;justify-content:center;padding:18px 0}",
      ".cs-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px;box-sizing:border-box}",
      ".cs-modal{width:min(720px,94vw);max-height:72vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2,#1b1f27);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.45);overflow:hidden;color:var(--dsw-alias-label-primary)}",
      ".cs-head{display:flex;align-items:center;justify-content:space-between;flex:none}",
      ".cs-head-title{font-size:13px;font-weight:600}",
      ".cs-collapse{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:16px;line-height:1;cursor:pointer;padding:0 4px}",
      ".cs-iconbtn{width:40px;height:40px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));cursor:pointer;display:flex;align-items:center;justify-content:center}",
      ".cs-iconbtn:hover{border-color:var(--dsw-alias-state-business-primary,#3964fe);color:var(--dsw-alias-state-business-primary,#3964fe)}",
      ".cs-target{outline:2px solid var(--dsw-alias-state-business-primary,#3964fe)!important;outline-offset:2px;border-radius:6px}",
    ].join("");

    function fmtTime(t) {
      if (!t) return "";
      var d = new Date(t);
      if (isNaN(d.getTime())) return "";
      function p(n) { return (n < 10 ? "0" : "") + n; }
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
        " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function highlighted(text, query) {
      var lower = String(text).toLowerCase();
      var needle = String(query).toLowerCase();
      if (!needle) return [text];
      var nodes = [];
      var i = 0, idx, key = 0;
      while ((idx = lower.indexOf(needle, i)) !== -1) {
        if (idx > i) nodes.push(h("span", { key: "t" + key++ }, text.slice(i, idx)));
        nodes.push(h("span", { className: "cs-mark", key: "m" + key++ }, text.slice(idx, idx + needle.length)));
        i = idx + needle.length;
      }
      if (i < text.length) nodes.push(h("span", { key: "t" + key++ }, text.slice(i)));
      return nodes;
    }

    function isArchived(sessionId) {
      try {
        var spaces = services && services.workspaces && services.workspaces.list && services.workspaces.list.getSnapshot();
        if (!spaces || !Array.isArray(spaces.archivedSessionIds)) return false;
        return spaces.archivedSessionIds.indexOf(sessionId) !== -1;
      } catch {
        return false;
      }
    }

    function findSessionRow(sessionId) {
      var rows = document.querySelectorAll("[data-row-key], [data-session-id], [data-session]");
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.getAttribute("data-row-key") === "session:" + sessionId ||
            row.getAttribute("data-session-id") === sessionId ||
            row.getAttribute("data-session") === sessionId) return row;
      }
      return null;
    }

    function findMessageRow(hit, query) {
      var key = hit && hit.nodeKey ? String(hit.nodeKey) : "";
      var rows = document.querySelectorAll("[data-chat-anchor-key], [data-chat-node-key]");
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var attr = row.getAttribute("data-chat-anchor-key") || row.getAttribute("data-chat-node-key");
        if (key && attr === key) return row;
      }
      var turnRows = document.querySelectorAll("[data-chat-turn]");
      var fallback = null;
      for (var j = 0; j < turnRows.length; j++) {
        var tr = turnRows[j];
        if (hit && hit.turn !== null && hit.turn !== undefined &&
            String(tr.getAttribute("data-chat-turn")) === String(hit.turn)) {
          if (!fallback) fallback = tr;
          var kind = tr.getAttribute("data-chat-flow-kind") || "";
          if (!hit.role || kind.indexOf(hit.role) !== -1 || tr.classList.contains(hit.role)) return tr;
        }
      }
      if (fallback) return fallback;
      var needle = String(query || "").toLowerCase();
      if (needle) {
        for (var k = 0; k < turnRows.length; k++) {
          if (String(turnRows[k].textContent || "").toLowerCase().indexOf(needle) !== -1) return turnRows[k];
        }
      }
      return null;
    }

    function waitFor(predicate, timeoutMs) {
      return new Promise(function (resolve) {
        var started = Date.now();
        function check() {
          var value = null;
          try { value = predicate(); } catch { value = null; }
          if (value) { resolve(value); return; }
          if (Date.now() - started >= timeoutMs) { resolve(null); return; }
          setTimeout(check, 120);
        }
        check();
      });
    }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function flash(element) {
      element.classList.remove("cs-target");
      void element.offsetWidth;
      element.classList.add("cs-target");
      setTimeout(function () { element.classList.remove("cs-target"); }, 2600);
    }

    async function openThroughUi(sessionId) {
      var ui = services && services.uiWorkspace;
      if (!ui) return false;
      try {
        if (isArchived(sessionId) && typeof ui.unarchiveSession === "function") {
          await ui.unarchiveSession(sessionId);
          await sleep(250);
        }
        if (typeof ui.openSession === "function") {
          await ui.openSession(sessionId);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    }

    function openThroughDom(sessionId) {
      var row = findSessionRow(sessionId);
      if (!row) {
        var collapsed = document.querySelectorAll('[data-row-key^="workspace:"][aria-expanded="false"], [data-row-key^="overflow:"][aria-expanded="false"]');
        for (var i = 0; i < collapsed.length; i++) collapsed[i].click();
        row = findSessionRow(sessionId);
      }
      if (row) {
        try { row.click(); return true; } catch { return false; }
      }
      return false;
    }

    async function jumpToHit(sessionId, hit, query) {
      var opened = await openThroughUi(sessionId);
      if (!opened) openThroughDom(sessionId);
      var target = await waitFor(function () { return findMessageRow(hit, query); }, 8000);
      if (!target) return false;
      try { target.scrollIntoView({ behavior: "smooth", block: "center" }); }
      catch { target.scrollIntoView(true); }
      flash(target);
      return true;
    }

    function SearchPanel() {
      var qState = react.useState("");
      var q = qState[0], setQ = qState[1];
      var sState = react.useState("");
      var status = sState[0], setStatus = sState[1];
      var rState = react.useState(null);
      var results = rState[0], setResults = rState[1];
      var bState = react.useState(false);
      var busy = bState[0], setBusy = bState[1];
      var lqState = react.useState("");
      var lastQuery = lqState[0], setLastQuery = lqState[1];
      var eState = react.useState(false);
      var expanded = eState[0], setExpanded = eState[1];

      function run() {
        var query = String(q || "").trim();
        if (!query || busy) return;
        setBusy(true);
        setStatus("搜索中…");
        setResults(null);
        setLastQuery(query);
        fetch("/chat-search/api?q=" + encodeURIComponent(query) + "&limit=50")
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function (data) {
            setBusy(false);
            var scanned = data.meta && data.meta.files != null ? "（扫描 " + data.meta.files + " 个会话）" : "";
            if (!data.results || !data.results.length) {
              setStatus("没有找到包含「" + query + "」的消息" + scanned);
              setResults([]);
            } else {
              setStatus("命中 " + data.results.length + " 个会话" + scanned);
              setResults(data.results);
            }
          })
          .catch(function (err) {
            setBusy(false);
            setStatus("搜索失败：" + err.message);
          });
      }

      function jump(sessionId, hit) {
        setStatus("正在打开对话…");
        jumpToHit(sessionId, hit, lastQuery).then(function (ok) {
          if (ok) setExpanded(false);
          else setStatus("已打开对话，但没能定位到那条消息。可能消息还在加载，再点一次试试。");
        });
      }

      if (!expanded) {
        return h("div", { className: "cs-collapsed" },
          h("button", {
            className: "cs-iconbtn",
            type: "button",
            title: "搜索对话内容",
            onClick: function () { setExpanded(true); },
          },
            h("svg", {
              width: 20, height: 20, viewBox: "0 0 24 24",
              fill: "none", stroke: "currentColor", strokeWidth: 2,
              strokeLinecap: "round",
            },
              h("circle", { cx: 11, cy: 11, r: 7 }),
              h("line", { x1: 16.5, y1: 16.5, x2: 21, y2: 21 })
            )
          )
        );
      }

      var body = h("div", { className: "cs-root" },
        h("div", { className: "cs-head" },
          h("span", { className: "cs-head-title" }, "对话搜索"),
          h("button", {
            className: "cs-collapse",
            type: "button",
            title: "关闭",
            onClick: function () { setExpanded(false); },
          }, "×")
        ),
        h("div", { className: "cs-bar" },
          h("input", {
            className: "cs-input",
            type: "search",
            value: q,
            placeholder: "搜索全部对话，点结果跳转…",
            onChange: function (e) { setQ(e.target.value); },
            onKeyDown: function (e) { if (e.key === "Enter") run(); },
          }),
          h("button", { className: "cs-btn", type: "button", disabled: busy, onClick: run }, busy ? "…" : "搜索")
        ),
        status ? h("div", { className: "cs-status" }, status) : null,
        results && results.length
          ? h("div", { className: "cs-list" }, results.map(function (r) {
              return h("div", { className: "cs-card", key: r.id },
                h("div", { className: "cs-title" },
                  r.title,
                  isArchived(r.id) ? h("span", { className: "cs-badge" }, "已归档") : null
                ),
                h("div", { className: "cs-meta" },
                  fmtTime(r.time) + " · " + (r.workspace || "") + " · 匹配 " + r.count + " 处"),
                (r.hits || []).map(function (hit, i) {
                  return h("div", {
                    className: "cs-hit",
                    key: i,
                    title: "跳到这条消息",
                    onClick: function () { jump(r.id, hit); },
                  },
                    hit.cat ? h("span", { className: "cs-cat" }, hit.cat) : null,
                    highlighted(hit.snippet, lastQuery)
                  );
                })
              );
            }))
          : null
      );

      return h("div", {
        className: "cs-overlay",
        onClick: function (e) { if (e.target === e.currentTarget) setExpanded(false); },
      }, h("div", { className: "cs-modal" }, body));
    }

    function apply(ctx) {
      if (typeof document !== "undefined" && !document.getElementById("dsh-chat-search-css")) {
        var style = document.createElement("style");
        style.id = "dsh-chat-search-css";
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      if (typeof ctx.inject === "function") {
        ctx.inject(["uiWorkspace", "sessions", "workspaces"], function (child) {
          services = child;
        });
      }
      ctx.slots.inject("sidebar.panellist", function () {
        return ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: "dsh-chat-search",
            order: 30,
            label: function () { return "对话搜索"; },
          },
          SearchPanel,
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
