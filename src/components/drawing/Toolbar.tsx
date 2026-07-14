import React from "react";
import { DrawableState } from "./DrawingCanvas";
import { EraserMode, PenSettings, ToolType } from "./types";

const COLORS = [
  "#1a1a1a",
  "#ffffff",
  "#e03131",
  "#f08c00",
  "#f7c948",
  "#2f9e44",
  "#1971c2",
  "#6741d9",
  "#e64980",
];

interface ToolbarProps {
  state: DrawableState;
  onTool: (t: ToolType) => void;
  onPen: (p: PenSettings) => void;
  onEraserMode: (m: EraserMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelection: () => void;
  onSelectAll: () => void;
  onClearLayer: () => void;
  onAddLayer: () => void;
  onRemoveLayer: (id: string) => void;
  onSetActiveLayer: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onSetOpacity: (id: string, o: number) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAddText: () => void;
  onFit: () => void;
}

const railBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  border: "1px solid #2a2a33",
  background: "#191a21",
  color: "#d7d9e0",
  cursor: "pointer",
  fontSize: 18,
  marginBottom: 8,
};

function RailButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        ...railBtn,
        background: active ? "#3b5bff" : "#191a21",
        color: active ? "#fff" : "#d7d9e0",
        borderColor: active ? "#3b5bff" : "#2a2a33",
      }}
    >
      {children}
    </button>
  );
}

export default function Toolbar(props: ToolbarProps) {
  const { state } = props;
  const pen = state.pen;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        color: "#d7d9e0",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      {/* tool rail */}
      <div
        style={{
          width: 56,
          padding: 10,
          background: "#101116",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderRight: "1px solid #1c1d24",
          overflowY: "auto",
        }}
      >
        <RailButton title="Pencil" active={state.tool === "pencil"} onClick={() => props.onTool("pencil")}>
          ✏️
        </RailButton>
        <RailButton title="Marker" active={state.tool === "marker"} onClick={() => props.onTool("marker")}>
          🖍️
        </RailButton>
        <RailButton
          title="Eraser"
          active={state.tool === "eraser"}
          onClick={() => props.onTool("eraser")}
        >
          🩹
        </RailButton>
        <RailButton title="Lasso" active={state.tool === "lasso"} onClick={() => props.onTool("lasso")}>
          ⬚
        </RailButton>
        <RailButton title="Pan" active={state.tool === "pan"} onClick={() => props.onTool("pan")}>
          ✋
        </RailButton>
        <div style={{ height: 8 }} />
        <RailButton title="Add Text" onClick={props.onAddText}>
          🅣
        </RailButton>
        <RailButton title="Zoom In" onClick={props.onZoomIn}>
          ＋
        </RailButton>
        <RailButton title="Zoom Out" onClick={props.onZoomOut}>
          －
        </RailButton>
        <RailButton title="Fit / Reset View" onClick={props.onFit}>
          ⤢
        </RailButton>
        <div style={{ height: 8 }} />
        <RailButton title="Undo" onClick={props.onUndo} children={"↶"} />
        <RailButton title="Redo" onClick={props.onRedo} children={"↷"} />
        <RailButton title="Delete Selection" onClick={props.onDeleteSelection}>
          🗑️
        </RailButton>
        <RailButton title="Select All" onClick={props.onSelectAll}>
          ▣
        </RailButton>
      </div>

      {/* pen + eraser + layers */}
      <div
        style={{
          width: 232,
          padding: 12,
          background: "#15161d",
          borderRight: "1px solid #1c1d24",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* color */}
        <div>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Color</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => props.onPen({ ...pen, color: c })}
                title={c}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border:
                    pen.color.toLowerCase() === c.toLowerCase()
                      ? "2px solid #fff"
                      : "1px solid #333",
                  background: c,
                  cursor: "pointer",
                }}
              />
            ))}
            <input
              type="color"
              value={pen.color}
              onChange={(e) => props.onPen({ ...pen, color: e.target.value })}
              style={{ width: 28, height: 24, background: "none", border: "none", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* size + opacity */}
        <div>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>
            Size <span style={{ float: "right" }}>{pen.size.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={40}
            step={0.5}
            value={pen.size}
            onChange={(e) => props.onPen({ ...pen, size: parseFloat(e.target.value) })}
            style={{ width: "100%" }}
          />
          <div style={{ opacity: 0.7, margin: "10px 0 6px" }}>
            Opacity <span style={{ float: "right" }}>{Math.round(pen.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={pen.opacity}
            onChange={(e) => props.onPen({ ...pen, opacity: parseFloat(e.target.value) })}
            style={{ width: "100%" }}
          />
        </div>

        {/* eraser mode */}
        {state.tool === "eraser" && (
          <div>
            <div style={{ opacity: 0.7, marginBottom: 6 }}>Eraser</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["object", "pixel"] as EraserMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => props.onEraserMode(m)}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 8,
                    border: "1px solid #2a2a33",
                    background: state.eraserMode === m ? "#3b5bff" : "#191a21",
                    color: state.eraserMode === m ? "#fff" : "#d7d9e0",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* layers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ opacity: 0.7 }}>Layers</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                title="Add Layer"
                onClick={props.onAddLayer}
                style={miniBtn}
              >
                ＋
              </button>
              <button
                title="Clear Active Layer"
                onClick={props.onClearLayer}
                style={miniBtn}
              >
                ⌫
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {state.layers
              .slice()
              .reverse()
              .map((l) => (
                <div
                  key={l.id}
                  onPointerDown={() => props.onSetActiveLayer(l.id)}
                  style={{
                    border:
                      state.activeLayerId === l.id
                        ? "1px solid #3b5bff"
                        : "1px solid #2a2a33",
                    background: state.activeLayerId === l.id ? "#1b2030" : "#191a21",
                    borderRadius: 8,
                    padding: 8,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      title={l.visible ? "Hide" : "Show"}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onToggleVisible(l.id);
                      }}
                      style={miniBtn}
                    >
                      {l.visible ? "👁" : "🚫"}
                    </button>
                    <input
                      value={l.name}
                      onChange={(e) => props.onRename(l.id, e.target.value)}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        color: "#e6e8ef",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={l.opacity}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => props.onSetOpacity(l.id, parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <button
                      title="Move Up"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onReorder(l.id, 1);
                      }}
                      style={miniBtn}
                    >
                      ↑
                    </button>
                    <button
                      title="Move Down"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onReorder(l.id, -1);
                      }}
                      style={miniBtn}
                    >
                      ↓
                    </button>
                    <button
                      title="Delete Layer"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onRemoveLayer(l.id);
                      }}
                      style={{ ...miniBtn, color: "#ff6b6b" }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div style={{ textAlign: "center", opacity: 0.5, fontSize: 11, marginTop: "auto" }}>
          Zoom {(state.zoom * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid #2a2a33",
  background: "#101116",
  color: "#d7d9e0",
  cursor: "pointer",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
