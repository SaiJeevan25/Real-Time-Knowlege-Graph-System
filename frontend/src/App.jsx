import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import dagre from "dagre";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

/* ─────────────────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────────────────── */
const G = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; overflow: hidden; }
    :root { --font: 'Inter', system-ui, sans-serif; --mono: 'JetBrains Mono', monospace; }

    .dark {
      --bg: #060a12; --surf: #0b1120; --surf2: #0f1829; --surf3: #152035;
      --bd: #1d2d45; --bd2: #263c58; --tx: #c8d8f8; --tx2: #7a9abf; --tx3: #3a5470;
      --accent: #3b82f6; --agl: rgba(59,130,246,.18);
      --green: #10d9a0; --amber: #f59e0b; --violet: #a78bfa; --red: #f87171;
      --kp-bg: #080e1a; --kp-surf: #0c1525;
    }
    .light {
      --bg: #edf2fc; --surf: #ffffff; --surf2: #f5f8ff; --surf3: #eaf0fb;
      --bd: #cdd9f0; --bd2: #b0c4e8; --tx: #0d1c34; --tx2: #4a6a90; --tx3: #9ab0cc;
      --accent: #1d4ed8; --agl: rgba(29,78,216,.1);
      --green: #059669; --amber: #d97706; --violet: #7c3aed; --red: #dc2626;
      --kp-bg: #f0f5ff; --kp-surf: #ffffff;
    }

    body { font-family: var(--font); background: var(--bg); color: var(--tx); }

    .react-flow__renderer { overflow: visible !important; }
    .react-flow__controls {
      background: var(--surf) !important; border: 1px solid var(--bd) !important;
      border-radius: 10px !important; box-shadow: 0 4px 20px rgba(0,0,0,.25) !important; overflow: hidden;
    }
    .react-flow__controls-button {
      background: var(--surf) !important; border: none !important;
      border-bottom: 1px solid var(--bd) !important; fill: var(--tx2) !important;
      width: 34px !important; height: 34px !important; transition: background .15s;
    }
    .react-flow__controls-button:hover { background: var(--surf2) !important; }
    .react-flow__minimap {
      border: 1px solid var(--bd) !important; border-radius: 10px !important;
      background: var(--surf) !important; overflow: hidden;
    }
    .react-flow__attribution { display: none !important; }
    .react-flow__edge-path { transition: stroke .2s, stroke-width .2s; }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 4px; }

    @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }
    @keyframes slide-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slide-in { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
    @keyframes bar-grow { from{width:0} }
    @keyframes fade-in  { from{opacity:0} to{opacity:1} }
    @keyframes kp-appear{ from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

    .anim-pulse  { animation: pulse 2.2s ease-in-out infinite; }
    .anim-slide  { animation: slide-up .22s ease both; }
    .anim-slidein{ animation: slide-in .26s cubic-bezier(.22,1,.36,1) both; }
    .anim-bar    { animation: bar-grow .8s cubic-bezier(.22,1,.36,1) both; }
    .anim-kp     { animation: kp-appear .28s cubic-bezier(.22,1,.36,1) both; }

    .mono { font-family: var(--mono) !important; }
    .badge {
      display: inline-flex; align-items: center;
      font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: .08em;
      padding: 3px 8px; border-radius: 5px;
    }
    .pill {
      display: inline-flex; align-items: center; gap: 5px;
      font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: .1em;
      padding: 4px 10px; border-radius: 20px; cursor: pointer;
      border: 1px solid var(--bd); background: transparent; color: var(--tx2);
      transition: all .14s; white-space: nowrap;
    }
    .pill:hover { border-color: var(--bd2); color: var(--tx); }
    .pill.on { border-color: var(--accent); background: var(--agl); color: var(--accent); }
    .sec-label {
      font-family: var(--mono); font-size: 10px; font-weight: 700;
      letter-spacing: .14em; color: var(--tx3); text-transform: uppercase;
    }
    .stat-card { background: var(--surf2); border: 1px solid var(--bd); border-radius: 10px; padding: 14px 16px; }
    .conn-item {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      border-radius: 8px; background: var(--surf2); border: 1px solid var(--bd);
      transition: background .14s; cursor: default;
    }
    .conn-item:hover { background: var(--surf3); }
    .legend-item {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px;
      border-radius: 9px; cursor: pointer; border: 1px solid transparent;
      transition: all .15s; margin-bottom: 4px;
    }
    .legend-item:hover { background: var(--surf2); }

    /* ── Knowledge Panel ── */
    .kp-wrap {
      position: absolute; bottom: 0; left: 0; right: 0;
      z-index: 40; pointer-events: none;
    }
    .kp-panel {
      pointer-events: all;
      background: var(--kp-bg);
      border-top: 1px solid var(--bd);
      border-left: 1px solid var(--bd);
      border-right: 1px solid var(--bd);
      border-radius: 18px 18px 0 0;
      box-shadow: 0 -8px 40px rgba(0,0,0,.35);
      overflow: hidden;
      transition: height .32s cubic-bezier(.22,1,.36,1);
    }
    .kp-header {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 20px 12px;
      border-bottom: 1px solid var(--bd);
      background: var(--surf);
      cursor: pointer; user-select: none;
    }
    .kp-header:hover { background: var(--surf2); }
    .kp-body {
      display: flex; gap: 0;
      overflow: hidden;
    }
    .kp-col {
      overflow-y: auto; overflow-x: hidden;
      padding: 16px;
    }
    .kp-col + .kp-col { border-left: 1px solid var(--bd); }

    /* Knowledge cards */
    .kcard {
      border-radius: 10px;
      border: 1px solid var(--bd);
      background: var(--kp-surf);
      padding: 13px 15px;
      margin-bottom: 10px;
      transition: border-color .15s;
    }
    .kcard:hover { border-color: var(--bd2); }
    .kcard:last-child { margin-bottom: 0; }

    .kcard-tag {
      font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: .12em;
      text-transform: uppercase; padding: 2px 7px; border-radius: 4px;
      display: inline-flex; align-items: center; gap: 4px;
    }

    /* Relation line */
    .rel-line {
      display: flex; align-items: stretch; gap: 10px;
      margin-bottom: 8px;
    }
    .rel-line:last-child { margin-bottom: 0; }
    .rel-stem {
      width: 2px; border-radius: 2px; flex-shrink: 0;
      margin: 2px 0;
    }
    .rel-body { flex: 1; min-width: 0; }
    .rel-verb {
      font-family: var(--mono); font-size: 9px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase;
      margin-bottom: 3px;
    }
    .rel-entity {
      font-size: 13px; font-weight: 600; color: var(--tx);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Timeline dot */
    .tl-row {
      display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px;
    }
    .tl-row:last-child { margin-bottom: 0; }
    .tl-left { display: flex; flex-direction: column; align-items: center; gap: 0; flex-shrink: 0; width: 28px; }
    .tl-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 2px solid var(--kp-bg); }
    .tl-line { width: 2px; flex: 1; background: var(--bd); min-height: 20px; }
    .tl-content { flex: 1; min-width: 0; padding-top: 1px; }

    /* Entity chip */
    .ent-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px 3px 5px; border-radius: 20px;
      border: 1px solid var(--bd);
      background: var(--surf2);
      margin: 3px; cursor: pointer;
      transition: all .14s;
      font-size: 12px; font-weight: 600; color: var(--tx);
      max-width: 160px;
    }
    .ent-chip:hover { border-color: var(--bd2); background: var(--surf3); }
    .ent-chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  `}</style>
);

/* ─── Layout ────────────────────────────────────────────────────────── */
const NW = 220, NH = 64;
function layoutGraph(nodes, edges, dir = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: dir, ranksep: 140, nodesep: 70, marginx: 60, marginy: 60 });
  nodes.forEach((n) => g.setNode(n.id, { width: NW, height: NH }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NW / 2, y: p.y - NH / 2 } };
  });
}

/* ─── Entity config ─────────────────────────────────────────────────── */
const ENT = {
  ORG:  { color: "#10d9a0", bg: "rgba(16,217,160,.1)",  ring: "rgba(16,217,160,.3)",  label: "Organization" },
  PER:  { color: "#3b82f6", bg: "rgba(59,130,246,.1)",  ring: "rgba(59,130,246,.3)",  label: "Person"       },
  LOC:  { color: "#f59e0b", bg: "rgba(245,158,11,.1)",  ring: "rgba(245,158,11,.3)",  label: "Location"     },
  MISC: { color: "#a78bfa", bg: "rgba(167,139,250,.1)", ring: "rgba(167,139,250,.3)", label: "Other"        },
};

const CAT_COLORS = {
  business:    "#10d9a0", ai:          "#3b82f6", politics:    "#f59e0b",
  finance:     "#a78bfa", sports:      "#f87171", health:      "#34d399",
  cyber:       "#fb923c", space:       "#60a5fa", environment: "#4ade80",
  education:   "#c084fc", misc:        "#94a3b8",
};

/* ─── Custom Node ───────────────────────────────────────────────────── */
function EntityNode({ data, selected }) {
  const { label, type, degree = 0 } = data;
  const ent = ENT[type] || { color: "#64748b", bg: "rgba(100,116,139,.1)", ring: "rgba(100,116,139,.3)", label: type };
  return (
    <div style={{
      width: NW, minHeight: NH,
      background: selected ? ent.bg : "var(--surf)",
      border: `1.5px solid ${selected ? ent.color : "var(--bd)"}`,
      borderLeft: `4px solid ${ent.color}`,
      borderRadius: 12,
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "12px 14px 12px 16px",
      boxShadow: selected
        ? `0 0 0 3px ${ent.ring}, 0 8px 32px rgba(0,0,0,.35)`
        : "0 2px 20px rgba(0,0,0,.22)",
      cursor: "pointer",
      transition: "box-shadow .2s, border-color .2s, background .2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div className="anim-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: ent.color, boxShadow: `0 0 8px ${ent.color}`, flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: ent.color }}>{type}</span>
        </div>
        {degree > 0 && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 600, color: "var(--tx3)", background: "var(--surf3)", border: "1px solid var(--bd)", borderRadius: 4, padding: "1px 5px" }}>
            {degree}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".02em", color: "var(--tx)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Custom Edge ───────────────────────────────────────────────────── */
function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, selected, data }) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const col = selected ? "var(--accent)" : data?.dimmed ? "var(--bd)" : "var(--bd2)";
  const w = selected ? 2.2 : 1.4;
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: col, strokeWidth: w, transition: "stroke .2s, stroke-width .2s" }} markerEnd={`url(#arrow-${selected ? "sel" : "def"})`} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
            color: selected ? "var(--accent)" : "var(--tx2)", background: "var(--surf)",
            border: `1px solid ${selected ? "var(--accent)" : "var(--bd)"}`, borderRadius: 5,
            padding: "2px 7px", whiteSpace: "nowrap", transition: "color .2s, border-color .2s",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)",
          }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { entity: EntityNode };
const edgeTypes = { custom: CustomEdge };

function ArrowDefs() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <marker id="arrow-def" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 Z" fill="var(--bd2)" />
        </marker>
        <marker id="arrow-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 Z" fill="var(--accent)" />
        </marker>
      </defs>
    </svg>
  );
}

/* ─── Stat card ─────────────────────────────────────────────────────── */
function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `2px solid ${color}` }}>
      <p className="sec-label" style={{ marginBottom: 8 }}>{label}</p>
      <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)" }}>{value ?? "—"}</p>
    </div>
  );
}

/* ─── Bar row ───────────────────────────────────────────────────────── */
function BarRow({ label, count, total, color, active, onClick }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="legend-item" onClick={onClick} style={{ border: `1px solid ${active ? color + "45" : "transparent"}`, background: active ? `${color}0c` : "transparent" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 7px ${color}`, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)" }}>{label}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--tx2)" }}>{pct}%</span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color, minWidth: 22, textAlign: "right" }}>{count}</span>
          </div>
        </div>
        <div style={{ height: 3, background: "var(--bd)", borderRadius: 2, overflow: "hidden" }}>
          <div className="anim-bar" style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, boxShadow: `0 0 8px ${color}80` }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Toggle ────────────────────────────────────────────────────────── */
function Toggle({ on, onChange, label }) {
  return (
    <button onClick={() => onChange(!on)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "var(--tx2)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", padding: "6px 0" }}>
      <div style={{ width: 34, height: 18, borderRadius: 9, position: "relative", background: on ? "var(--accent)" : "var(--bd2)", transition: "background .25s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .22s cubic-bezier(.4,0,.2,1)", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
      </div>
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   KNOWLEDGE PANEL — the new component
═══════════════════════════════════════════════════════════════════════ */
function KnowledgePanel({ node, edges, allNodes, knowledge, onClose, onJump }) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("events"); // events | relations | context

  if (!node) return null;

  const ent = ENT[node.data.type] || { color: "#64748b", bg: "rgba(100,116,139,.1)", label: node.data.type };

  // All edges touching this node
  const nodeEdges = edges.filter(e => e.source === node.id || e.target === node.id);

  // Outgoing and incoming split
  const outEdges = nodeEdges.filter(e => e.source === node.id);
  const inEdges  = nodeEdges.filter(e => e.target === node.id);

  // All connected node objects
  const connectedNodeIds = new Set(nodeEdges.map(e => e.source === node.id ? e.target : e.source));
  const connectedNodes = allNodes.filter(n => connectedNodeIds.has(n.id));

  // Knowledge events for this node (from /knowledge endpoint or derived from edges)
  const nodeEvents = (knowledge?.events || []).filter(ev =>
    ev.entities?.some(id => id === node.id)
  );

  // Category color helper
  const catColor = (cat) => CAT_COLORS[cat?.toLowerCase()] || "#94a3b8";

  // Format timestamp
  const fmtTime = (ts) => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
             " · " + d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch { return ts; }
  };

  const panelH = open ? 320 : 52;

  const tabs = [
    { id: "events",    label: "Events",    count: nodeEvents.length      },
    { id: "relations", label: "Relations", count: nodeEdges.length        },
    { id: "context",   label: "Network",   count: connectedNodes.length   },
  ];

  return (
    <div className="kp-wrap">
      <div className="kp-panel anim-slidein" style={{ height: panelH }}>
        {/* Header */}
        <div className="kp-header" onClick={() => setOpen(v => !v)}>
          {/* Entity colour pip + name */}
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: ent.color, boxShadow: `0 0 8px ${ent.color}`, flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {node.data.label}
            </span>
            <span className="badge" style={{ background: ent.bg, color: ent.color, border: `1px solid ${ent.color}30`, flexShrink: 0 }}>
              {ent.label}
            </span>
          </div>

          {/* Tabs (visible only when open) */}
          {open && (
            <div style={{ display: "flex", gap: 4, marginRight: 12 }} onClick={e => e.stopPropagation()}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                    padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid",
                    borderColor: activeTab === t.id ? ent.color : "var(--bd)",
                    background: activeTab === t.id ? `${ent.color}18` : "transparent",
                    color: activeTab === t.id ? ent.color : "var(--tx2)",
                    transition: "all .14s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {t.label.toUpperCase()}
                  {t.count > 0 && (
                    <span style={{ opacity: .65, fontWeight: 400 }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Chevron + close */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: .4, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .28s" }}>
              <polyline points="2,4 7,10 12,4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              style={{ background: "var(--surf3)", border: "1px solid var(--bd)", borderRadius: 6, width: 24, height: 24, cursor: "pointer", color: "var(--tx2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        {open && (
          <div className="kp-body" style={{ height: panelH - 53 }}>

            {/* ── EVENTS TAB ── */}
            {activeTab === "events" && (
              <div className="kp-col" style={{ flex: 1 }}>
                {nodeEvents.length === 0 ? (
                  <EmptyState icon="📡" msg="No events captured for this entity yet." sub="Events appear here as the knowledge stream processes new data." />
                ) : (
                  nodeEvents.map((ev, i) => (
                    <div key={i} className="kcard anim-kp" style={{ animationDelay: `${i * 0.04}s` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                        <span className="kcard-tag" style={{ background: `${catColor(ev.category)}18`, color: catColor(ev.category), border: `1px solid ${catColor(ev.category)}30` }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: catColor(ev.category), display: "inline-block" }} />
                          {ev.category?.toUpperCase() || "EVENT"}
                        </span>
                        {ev.timestamp && (
                          <span className="mono" style={{ fontSize: 9, color: "var(--tx3)", whiteSpace: "nowrap" }}>{fmtTime(ev.timestamp)}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--tx)", marginBottom: ev.entities?.length > 1 ? 10 : 0 }}>
                        {ev.text}
                      </p>
                      {/* Other entities in this event */}
                      {ev.entities && ev.entities.filter(id => id !== node.id).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginTop: 6 }}>
                          <span className="mono" style={{ fontSize: 9, color: "var(--tx3)", width: "100%", marginBottom: 4 }}>ALSO INVOLVES</span>
                          {ev.entities.filter(id => id !== node.id).map(eid => {
                            const en = allNodes.find(n => n.id === eid);
                            const ee = ENT[en?.data?.type] || { color: "#64748b" };
                            return (
                              <button key={eid} className="ent-chip" onClick={() => onJump(eid)}>
                                <span className="ent-chip-dot" style={{ background: ee.color }} />
                                {en?.data?.label || eid}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── RELATIONS TAB ── */}
            {activeTab === "relations" && (
              <div className="kp-col" style={{ flex: 1 }}>
                {nodeEdges.length === 0 ? (
                  <EmptyState icon="🔗" msg="No relationships found." sub="This entity hasn't been linked to others yet." />
                ) : (
                  <>
                    {/* Outgoing */}
                    {outEdges.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <p className="sec-label" style={{ marginBottom: 10, color: "var(--green)" }}>
                          ↗ OUTGOING — {outEdges.length}
                        </p>
                        {outEdges.map((e, i) => {
                          const target = allNodes.find(n => n.id === e.target);
                          const te = ENT[target?.data?.type] || { color: "#64748b" };
                          return (
                            <div key={e.id} className="rel-line anim-kp" style={{ animationDelay: `${i * 0.04}s` }}>
                              <div className="rel-stem" style={{ background: te.color }} />
                              <div className="rel-body">
                                {e.label && <div className="rel-verb" style={{ color: "var(--tx3)" }}>{e.label}</div>}
                                <button className="ent-chip" onClick={() => onJump(e.target)} style={{ maxWidth: "100%", display: "flex" }}>
                                  <span className="ent-chip-dot" style={{ background: te.color }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target?.data?.label || e.target}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Incoming */}
                    {inEdges.length > 0 && (
                      <div>
                        <p className="sec-label" style={{ marginBottom: 10, color: "var(--accent)" }}>
                          ↙ INCOMING — {inEdges.length}
                        </p>
                        {inEdges.map((e, i) => {
                          const src = allNodes.find(n => n.id === e.source);
                          const se = ENT[src?.data?.type] || { color: "#64748b" };
                          return (
                            <div key={e.id} className="rel-line anim-kp" style={{ animationDelay: `${i * 0.04}s` }}>
                              <div className="rel-stem" style={{ background: se.color }} />
                              <div className="rel-body">
                                {e.label && <div className="rel-verb" style={{ color: "var(--tx3)" }}>{e.label}</div>}
                                <button className="ent-chip" onClick={() => onJump(e.source)} style={{ maxWidth: "100%", display: "flex" }}>
                                  <span className="ent-chip-dot" style={{ background: se.color }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src?.data?.label || e.source}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── NETWORK / CONTEXT TAB ── */}
            {activeTab === "context" && (
              <div className="kp-col" style={{ flex: 1 }}>
                {connectedNodes.length === 0 ? (
                  <EmptyState icon="🌐" msg="No network connections yet." sub="This entity is isolated in the current graph." />
                ) : (
                  <>
                    <p className="sec-label" style={{ marginBottom: 12 }}>
                      {connectedNodes.length} CONNECTED ENTITIES
                    </p>
                    {/* Group by type */}
                    {Object.entries(ENT).map(([typeKey, typeVal]) => {
                      const group = connectedNodes.filter(n => n.data.type === typeKey);
                      if (group.length === 0) return null;
                      return (
                        <div key={typeKey} style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: typeVal.color }} />
                            <span className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: typeVal.color }}>
                              {typeVal.label.toUpperCase()} · {group.length}
                            </span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap" }}>
                            {group.map(n => (
                              <button key={n.id} className="ent-chip" onClick={() => onJump(n.id)}>
                                <span className="ent-chip-dot" style={{ background: typeVal.color }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.data.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Degree stats */}
                    <div style={{ marginTop: 6, padding: "12px 14px", background: "var(--surf2)", borderRadius: 10, border: "1px solid var(--bd)" }}>
                      <p className="sec-label" style={{ marginBottom: 10 }}>CONNECTIVITY STATS</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {[
                          { k: "Total",    v: nodeEdges.length,  c: ent.color      },
                          { k: "Outgoing", v: outEdges.length,   c: "var(--green)" },
                          { k: "Incoming", v: inEdges.length,    c: "var(--accent)"},
                        ].map(({ k, v, c }) => (
                          <div key={k} style={{ textAlign: "center" }}>
                            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                            <div className="sec-label" style={{ marginTop: 2 }}>{k}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, msg, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "24px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 12, opacity: .5 }}>{icon}</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx2)", marginBottom: 6 }}>{msg}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--tx3)", lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [theme,     setTheme]    = useState("dark");
  const [nodes,     setNodes,    onNodesChange] = useNodesState([]);
  const [edges,     setEdges,    onEdgesChange] = useEdgesState([]);
  const [stats,     setStats]    = useState({});
  const [knowledge, setKnowledge]= useState({ events: [] });
  const [search,    setSearch]   = useState("");
  const [selected,  setSelected] = useState(null);
  const [dir,       setDir]      = useState("LR");
  const [filter,    setFilter]   = useState("ALL");
  const [focus,     setFocus]    = useState(false);
  const [minimap,   setMinimap]  = useState(true);
  const [animEdge,  setAnimEdge] = useState(false);
  const [live,      setLive]     = useState("connecting");
  const prevHash                 = useRef("");
  const rfRef                    = useRef(null);

  const buildGraph = useCallback((data) => {
    const deg = {};
    data.edges.forEach((e) => {
      deg[e.source] = (deg[e.source] || 0) + 1;
      deg[e.target] = (deg[e.target] || 0) + 1;
    });
    const ns = data.nodes.map((n) => ({
      id: n.id, type: "entity",
      data: { label: n.label.toUpperCase(), type: n.type || "MISC", degree: deg[n.id] || 0 },
      position: { x: 0, y: 0 },
    }));
    const es = data.edges.map((e, i) => ({
      id: `e${i}`, source: e.source, target: e.target,
      label: e.label || "", type: "custom", data: { dimmed: false },
    }));
    return { ns, es };
  }, []);

  const load = useCallback(async () => {
    try {
      const [gR, aR, kR] = await Promise.all([
        axios.get("http://localhost:8000/graph"),
        axios.get("http://localhost:8000/analytics"),
        axios.get("http://localhost:8000/knowledge").catch(() => ({ data: { events: [] } })),
      ]);
      const hash = JSON.stringify(gR.data);
      if (hash === prevHash.current) return;
      prevHash.current = hash;
      const { ns, es } = buildGraph(gR.data);
      setNodes(layoutGraph(ns, es, dir));
      setEdges(es);
      setStats(aR.data);
      setKnowledge(kR.data || { events: [] });
      setLive("live");
    } catch { setLive("error"); }
  }, [buildGraph, dir, setNodes, setEdges]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const reLayout = useCallback((newDir) => {
    setNodes((prev) => layoutGraph(prev, edges, newDir || dir));
  }, [edges, dir, setNodes]);

  // Jump to a node by ID (for chip clicks inside Knowledge Panel)
  const jumpToNode = useCallback((nodeId) => {
    const target = nodes.find(n => n.id === nodeId);
    if (target) setSelected(target);
  }, [nodes]);

  const visible = nodes.filter((n) => {
    const ms = !search.trim() || n.data.label.toLowerCase().includes(search.toLowerCase());
    const mt = filter === "ALL" || n.data.type === filter;
    return ms && mt;
  });
  const vIds = new Set(visible.map((n) => n.id));

  const connIds = (() => {
    if (!focus || !selected) return null;
    const s = new Set([selected.id]);
    edges.forEach((e) => {
      if (e.source === selected.id) s.add(e.target);
      if (e.target === selected.id) s.add(e.source);
    });
    return s;
  })();

  const renderedNodes = visible.map((n) => ({
    ...n,
    selected: selected?.id === n.id,
    style: { opacity: connIds ? (connIds.has(n.id) ? 1 : 0.12) : 1, transition: "opacity .2s" },
  }));

  const renderedEdges = edges
    .filter((e) => vIds.has(e.source) && vIds.has(e.target))
    .map((e) => {
      const isSel = selected && (e.source === selected.id || e.target === selected.id);
      const dimmed = connIds ? !(connIds.has(e.source) && connIds.has(e.target)) : false;
      return { ...e, selected: !!isSel, animated: animEdge && !!isSel, style: { opacity: dimmed ? 0.06 : 1, transition: "opacity .2s" }, data: { ...e.data, dimmed } };
    });

  const typeCounts = {};
  nodes.forEach((n) => { typeCounts[n.data.type] = (typeCounts[n.data.type] || 0) + 1; });

  const selEdges = selected ? edges.filter((e) => e.source === selected.id || e.target === selected.id) : [];

  const liveCol = live === "live" ? "var(--green)" : live === "error" ? "var(--red)" : "var(--amber)";

  return (
    <div className={theme} style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)", color: "var(--tx)", fontFamily: "var(--font)" }}>
      <G />
      <ArrowDefs />

      {/* ══ TOPBAR ══════════════════════════════════════════════════════ */}
      <header style={{ height: 58, flexShrink: 0, zIndex: 30, background: "var(--surf)", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", padding: "0 20px", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px var(--agl)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" fill="white" />
              {[[8,1.5],[8,14.5],[1.5,8],[14.5,8]].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r="1.5" fill="white" opacity=".6" />)}
              {[[8,4],[8,12],[4,8],[12,8]].map(([x2,y2],i) => <line key={i} x1="8" y1="8" x2={x2} y2={y2} stroke="white" strokeWidth="1" opacity=".35" />)}
            </svg>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--tx)" }}>KNOWLEDGE ENGINE</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--tx3)", letterSpacing: ".06em" }}>GRAPH INTELLIGENCE</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 20, background: `${liveCol}14`, border: `1px solid ${liveCol}35`, flexShrink: 0 }}>
          <div className={live === "live" ? "anim-pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: liveCol }} />
          <span className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: liveCol }}>
            {live === "live" ? "LIVE" : live === "error" ? "OFFLINE" : "CONNECTING"}
          </span>
        </div>

        <div style={{ width: 1, height: 30, background: "var(--bd)", flexShrink: 0 }} />

        <div style={{ position: "relative", flex: "0 1 280px" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: .4 }} width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.target.style.borderColor = "var(--bd)"; }}
            style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 8, color: "var(--tx)", fontSize: 13, padding: "7px 32px 7px 32px", outline: "none", fontFamily: "var(--font)", transition: "border-color .15s" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "var(--bd)", border: "none", cursor: "pointer", color: "var(--tx2)", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--mono)", fontWeight: 700 }}>ESC</button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {["ALL", ...Object.keys(ENT)].map((k) => {
            const on = filter === k;
            const col = k !== "ALL" ? ENT[k].color : "var(--accent)";
            return (
              <button key={k} onClick={() => setFilter(k)} className={`pill${on ? " on" : ""}`} style={on ? { borderColor: col, background: `${col}18`, color: col } : {}}>
                {k !== "ALL" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: col, display: "inline-block" }} />}
                {k}
                {k !== "ALL" && typeCounts[k] ? <span style={{ opacity: .5, fontWeight: 400 }}>{typeCounts[k]}</span> : null}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button className={`pill${minimap ? " on" : ""}`} onClick={() => setMinimap(v => !v)}>MINIMAP</button>
          <button className={`pill${focus ? " on" : ""}`} onClick={() => setFocus(v => !v)}>FOCUS MODE</button>
          <button className={`pill${animEdge ? " on" : ""}`} onClick={() => setAnimEdge(v => !v)}>ANIMATE</button>
          <div style={{ width: 1, height: 26, background: "var(--bd)" }} />
          <button className="pill" onClick={() => { const nd = dir === "LR" ? "TB" : "LR"; setDir(nd); setTimeout(() => reLayout(nd), 30); }}>
            {dir === "LR" ? "HORIZONTAL" : "VERTICAL"}
          </button>
          <div style={{ width: 1, height: 26, background: "var(--bd)" }} />
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: 8, cursor: "pointer", padding: "6px 12px", color: "var(--tx2)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".08em" }}>
            {theme === "dark" ? "DARK" : "LIGHT"}
          </button>
        </div>
      </header>

      {/* ══ BODY ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 310px", overflow: "hidden" }}>

        {/* Graph canvas */}
        <div style={{ position: "relative", background: "var(--bg)" }}>
          <ReactFlow
            ref={rfRef}
            nodes={renderedNodes}
            edges={renderedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: .22 }}
            onNodeClick={(_, n) => setSelected(p => p?.id === n.id ? null : n)}
            onPaneClick={() => setSelected(null)}
            defaultEdgeOptions={{ type: "custom" }}
          >
            <Background variant="dots" gap={30} size={1.2} color="var(--bd2)" style={{ opacity: .45 }} />
            <Controls />
            {minimap && (
              <MiniMap nodeColor={(n) => ENT[n.data?.type]?.color || "#64748b"} maskColor={theme === "dark" ? "rgba(0,0,0,.7)" : "rgba(255,255,255,.6)"} />
            )}
            <Panel position="top-right" style={{ margin: 14 }}>
              <div style={{ background: "var(--surf)", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 18px", display: "flex", gap: 22, boxShadow: "0 4px 24px rgba(0,0,0,.2)" }}>
                {[
                  { k: "NODES",   v: visible.length,        c: "var(--accent)" },
                  { k: "EDGES",   v: renderedEdges.length,   c: "var(--amber)"  },
                  { k: "DENSITY", v: stats.density || "—",  c: "var(--green)"  },
                ].map(({ k, v, c }) => (
                  <div key={k}>
                    <p className="sec-label" style={{ marginBottom: 4 }}>{k}</p>
                    <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </ReactFlow>

          {/* ── Knowledge Panel overlay ── */}
          <KnowledgePanel
            node={selected}
            edges={edges}
            allNodes={nodes}
            knowledge={knowledge}
            onClose={() => setSelected(null)}
            onJump={jumpToNode}
          />
        </div>

        {/* ══ SIDEBAR ════════════════════════════════════════════════════ */}
        <aside style={{ background: "var(--surf)", borderLeft: "1px solid var(--bd)", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ padding: "20px 20px 0" }}>
            <p className="sec-label" style={{ marginBottom: 14 }}>ENTITY INSPECTOR</p>
            {selected ? (
              <div className="anim-slide" style={{ background: "var(--surf2)", border: `1px solid ${ENT[selected.data.type]?.color || "var(--accent)"}50`, borderLeft: `4px solid ${ENT[selected.data.type]?.color || "var(--accent)"}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="badge" style={{ background: ENT[selected.data.type]?.bg || "var(--surf3)", color: ENT[selected.data.type]?.color || "var(--accent)", border: `1px solid ${ENT[selected.data.type]?.ring || "var(--bd)"}` }}>
                    {ENT[selected.data.type]?.label || selected.data.type}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--tx3)" }}>{selEdges.length} connection{selEdges.length !== 1 ? "s" : ""}</span>
                </div>
                <p style={{ fontSize: 17, fontWeight: 700, color: "var(--tx)", marginBottom: 6, lineHeight: 1.3 }}>{selected.data.label}</p>
                <code className="mono" style={{ display: "inline-block", fontSize: 11, marginBottom: 16, color: ENT[selected.data.type]?.color || "var(--accent)", background: ENT[selected.data.type]?.bg || "var(--surf3)", padding: "3px 9px", borderRadius: 5 }}>
                  {selected.id}
                </code>
                <p className="sec-label" style={{ marginBottom: 10 }}>CONNECTIONS ({selEdges.length})</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {selEdges.length === 0 && <p style={{ fontSize: 13, color: "var(--tx3)", fontStyle: "italic" }}>No connections</p>}
                  {selEdges.map((e) => {
                    const isOut = e.source === selected.id;
                    const otherId = isOut ? e.target : e.source;
                    const otherNode = nodes.find((n) => n.id === otherId);
                    const otherEnt = ENT[otherNode?.data?.type] || { color: "#64748b", label: otherNode?.data?.type || "MISC" };
                    return (
                      <div key={e.id} className="conn-item">
                        <span className="badge" style={{ background: isOut ? "rgba(16,217,160,.12)" : "rgba(59,130,246,.12)", color: isOut ? "var(--green)" : "var(--accent)", border: `1px solid ${isOut ? "rgba(16,217,160,.3)" : "rgba(59,130,246,.3)"}`, flexShrink: 0 }}>
                          {isOut ? "OUT" : "IN"}
                        </span>
                        {e.label && <span className="mono" style={{ fontSize: 10, color: "var(--tx3)", flexShrink: 0, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>}
                        <svg width="14" height="8" viewBox="0 0 14 8" fill="none" style={{ flexShrink: 0 }}>
                          <line x1="0" y1="4" x2="10" y2="4" stroke="var(--bd2)" strokeWidth="1.5" />
                          <polyline points="6,1 10,4 6,7" fill="none" stroke="var(--bd2)" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: otherEnt.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {otherNode?.data?.label || otherId}
                            </span>
                          </div>
                          <span className="mono" style={{ fontSize: 9, color: "var(--tx3)" }}>{otherNode?.data?.type}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick-action: open full knowledge */}
                <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--surf3)", borderRadius: 8, border: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" opacity=".5">
                    <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.3"/>
                    <line x1="4" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="4" y1="7.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 12, color: "var(--tx3)", flex: 1 }}>Knowledge panel shows below the graph</span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: ENT[selected.data.type]?.color || "var(--accent)", flexShrink: 0 }} />
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--surf2)", border: "1px dashed var(--bd)", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: "0 auto 10px", opacity: .4 }}>
                  <circle cx="16" cy="16" r="5" stroke="var(--tx2)" strokeWidth="1.5" />
                  <circle cx="6" cy="8" r="3" stroke="var(--tx2)" strokeWidth="1.5" />
                  <circle cx="26" cy="8" r="3" stroke="var(--tx2)" strokeWidth="1.5" />
                  <circle cx="6" cy="24" r="3" stroke="var(--tx2)" strokeWidth="1.5" />
                  <circle cx="26" cy="24" r="3" stroke="var(--tx2)" strokeWidth="1.5" />
                  <line x1="11" y1="16" x2="8.5" y2="10" stroke="var(--tx2)" strokeWidth="1" opacity=".5" />
                  <line x1="21" y1="16" x2="23.5" y2="10" stroke="var(--tx2)" strokeWidth="1" opacity=".5" />
                  <line x1="11" y1="18" x2="8.5" y2="22" stroke="var(--tx2)" strokeWidth="1" opacity=".5" />
                  <line x1="21" y1="18" x2="23.5" y2="22" stroke="var(--tx2)" strokeWidth="1" opacity=".5" />
                </svg>
                <p style={{ fontSize: 13, color: "var(--tx3)", fontStyle: "italic" }}>Click any node to inspect</p>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "var(--bd)", margin: "20px 0" }} />

          <div style={{ padding: "0 20px" }}>
            <p className="sec-label" style={{ marginBottom: 14 }}>GRAPH ANALYTICS</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard label="TOTAL NODES"  value={stats.total_nodes ?? nodes.length} color="var(--accent)" />
              <StatCard label="TOTAL EDGES"  value={stats.total_edges ?? edges.length} color="var(--amber)"  />
              <StatCard label="DENSITY"      value={stats.density ?? "—"}              color="var(--green)"  />
              <StatCard label="COMPONENTS"   value={stats.components ?? "—"}           color="var(--violet)" />
            </div>
          </div>

          <div style={{ height: 1, background: "var(--bd)", margin: "20px 0" }} />

          <div style={{ padding: "0 20px" }}>
            <p className="sec-label" style={{ marginBottom: 12 }}>ENTITY BREAKDOWN</p>
            {Object.entries(ENT).map(([key, { color, label }]) => (
              <BarRow key={key} label={label} count={typeCounts[key] || 0} total={nodes.length} color={color} active={filter === key} onClick={() => setFilter(filter === key ? "ALL" : key)} />
            ))}
          </div>

          <div style={{ height: 1, background: "var(--bd)", margin: "20px 0" }} />

          <div style={{ padding: "0 20px" }}>
            <p className="sec-label" style={{ marginBottom: 14 }}>DISPLAY CONTROLS</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Toggle on={minimap}  onChange={setMinimap}  label="Show Minimap"   />
              <Toggle on={focus}    onChange={setFocus}    label="Focus Mode"     />
              <Toggle on={animEdge} onChange={setAnimEdge} label="Animate Edges"  />
            </div>
          </div>

          <div style={{ height: 1, background: "var(--bd)", margin: "20px 0" }} />

          <div style={{ padding: "0 20px 24px" }}>
            <p className="sec-label" style={{ marginBottom: 12 }}>LEGEND</p>
            {Object.entries(ENT).map(([key, { color, label }]) => (
              <div key={key} className="legend-item" onClick={() => setFilter(filter === key ? "ALL" : key)} style={{ border: `1px solid ${filter === key ? color + "40" : "transparent"}`, background: filter === key ? `${color}0c` : "transparent" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, boxShadow: `0 0 7px ${color}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)", flex: 1 }}>{label}</span>
                <span className="badge" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>{key}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}