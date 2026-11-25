import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DrawingCanvas, { DrawableHandle, DrawableState } from "./DrawingCanvas";
import Toolbar from "./Toolbar";
import { DrawingDoc as DrawableDoc, EraserMode, PenSettings, ToolType } from "./types";

const PAGE_W = 1000;
const PAGE_H = 1400;
const NOTES_KEY = "squidcloud:notes";
const CURRENT_KEY = "squidcloud:notes:current";

interface TextBlock {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  color: string;
}

interface NoteFile {
  id: string;
  title: string;
  updatedAt: number;
  drawing: DrawableDoc | null;
  text: TextBlock[];
}

const uid = () =>
  (crypto as any).randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

function loadNotes(): NoteFile[] {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
  } catch {
    return [];
  }
}
function persistNotes(notes: NoteFile[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export default function HybridNoteEditor() {
  const handleRef = useRef<DrawableHandle | null>(null);
  const [state, setState] = useState<DrawableState | null>(null);
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [title, setTitle] = useState("Untitled Note");
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // refs for debounced save
  const docRef = useRef<DrawableDoc | null>(null);
  const textRef = useRef<TextBlock[]>([]);
  const titleRef = useRef("");
  const saveTimer = useRef<number | null>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);

  const scheduleSave = useCallback(() => {
    setStatus("Saving…");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      flushSave();
    }, 700);
  }, []);

  const flushSave = useCallback(() => {
    const id = currentId || uid();
    const note: NoteFile = {
      id,
      title: titleRef.current || "Untitled Note",
      updatedAt: Date.now(),
      drawing: docRef.current,
      text: textRef.current,
    };
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      next.unshift(note);
      persistNotes(next);
      return next;
    });
    if (!currentId) {
      setCurrentId(id);
      localStorage.setItem(CURRENT_KEY, id);
    }
    setStatus("Saved");
    window.setTimeout(() => setStatus(""), 1200);
  }, [currentId]);

  const onPersist = useCallback(
    (doc: DrawableDoc) => {
      docRef.current = doc;
      scheduleSave();
    },
    [scheduleSave],
  );

  const onState = useCallback((s: DrawableState) => {
    setState(s);
  }, []);

  // initial load
  useEffect(() => {
    const all = loadNotes();
    setNotes(all);
    const cur = localStorage.getItem(CURRENT_KEY);
    const note = all.find((n) => n.id === cur) ?? all[0] ?? null;
    if (note) {
      setCurrentId(note.id);
      setTitle(note.title);
      titleRef.current = note.title;
      setTextBlocks(note.text || []);
      textRef.current = note.text || [];
      docRef.current = note.drawing;
      if (note.drawing) handleRef.current?.setDoc(note.drawing);
    } else {
      const id = uid();
      setCurrentId(id);
      localStorage.setItem(CURRENT_KEY, id);
      docRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fit view once the handle is ready
  useEffect(() => {
    const t = window.setTimeout(() => {
      handleRef.current?.fitView();
    }, 60);
    return () => window.clearTimeout(t);
  }, [currentId]);

  // ---- text block ops ----
  const addText = useCallback(() => {
    const id = uid();
    const block: TextBlock = {
      id,
      x: 120 + textRef.current.length * 12,
      y: 120 + textRef.current.length * 12,
      w: 260,
      h: 90,
      text: "Type here…",
      fontSize: 22,
      color: "#1a1a1a",
    };
    const next = [...textRef.current, block];
    textRef.current = next;
    setTextBlocks(next);
    setSelectedBlock(id);
    scheduleSave();
  }, [scheduleSave]);

  const updateTextBlock = useCallback(
    (id: string, patch: Partial<TextBlock>) => {
      const next = textRef.current.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      );
      textRef.current = next;
      setTextBlocks(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  const deleteTextBlock = useCallback(
    (id: string) => {
      const next = textRef.current.filter((b) => b.id !== id);
      textRef.current = next;
      setTextBlocks(next);
      setSelectedBlock(null);
      scheduleSave();
    },
    [scheduleSave],
  );

  // drag a text block
  const dragBlock = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const block = textRef.current.find((b) => b.id === id);
      if (!block) return;
      const scale = state?.zoom ?? 1;
      const origX = block.x;
      const origY = block.y;
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        updateTextBlock(id, { x: origX + dx, y: origY + dy });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [state?.zoom, updateTextBlock],
  );

  // ---- note switching / create ----
  const switchNote = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      localStorage.setItem(CURRENT_KEY, id);
      setCurrentId(id);
      setTitle(note.title);
      titleRef.current = note.title;
      const txt = note.text || [];
      setTextBlocks(txt);
      textRef.current = txt;
      handleRef.current?.setDoc(note.drawing || ({} as DrawableDoc));
      docRef.current = note.drawing;
      handleRef.current?.fitView();
    },
    [notes],
  );

  const newNote = useCallback(() => {
    const id = uid();
    localStorage.setItem(CURRENT_KEY, id);
    setCurrentId(id);
    setTitle("Untitled Note");
    titleRef.current = "Untitled Note";
    const txt: TextBlock[] = [];
    setTextBlocks(txt);
    textRef.current = txt;
    docRef.current = null;
    handleRef.current?.setDoc({} as DrawableDoc);
    handleRef.current?.fitView();
  }, []);

  const exportNote = useCallback(() => {
    const note: NoteFile = {
      id: currentId,
      title: titleRef.current || "Untitled Note",
      updatedAt: Date.now(),
      drawing: docRef.current,
      text: textRef.current,
    };
    const blob = new Blob([JSON.stringify(note, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/\s+/g, "_") || "note"}.squidnote.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentId]);

  const importNote = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const note = JSON.parse(String(reader.result)) as NoteFile;
        const id = uid();
        note.id = id;
        const all = loadNotes();
        all.unshift(note);
        persistNotes(all);
        setNotes(all);
        localStorage.setItem(CURRENT_KEY, id);
        setCurrentId(id);
        setTitle(note.title);
        titleRef.current = note.title;
        const txt = note.text || [];
        setTextBlocks(txt);
        textRef.current = txt;
        docRef.current = note.drawing;
        handleRef.current?.setDoc(note.drawing || ({} as DrawableDoc));
        handleRef.current?.fitView();
      } catch {
        alert("Could not import that file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const h = handleRef.current;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#090b0a",
        color: "#e8e7e1",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          background: "#0e1110",
          borderBottom: "1px solid #1f2221",
        }}
      >
        <Link to="/" style={{ color: "#8d8f89", textDecoration: "none", fontSize: 13 }}>
          ← App
        </Link>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            scheduleSave();
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#e8e7e1",
            fontSize: 15,
            fontWeight: 500,
            outline: "none",
            width: 220,
          }}
        />
        <select
          value={currentId}
          onChange={(e) => switchNote(e.target.value)}
          style={{
            background: "#141816",
            color: "#e8e7e1",
            border: "1px solid #2f3230",
            borderRadius: 8,
            padding: "5px 8px",
          }}
        >
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <button onClick={newNote} style={hdrBtn}>
          New
        </button>
        <button onClick={flushSave} style={hdrBtn}>
          Save
        </button>
        <button onClick={exportNote} style={hdrBtn}>
          Export
        </button>
        <label style={{ ...hdrBtn, display: "inline-flex", alignItems: "center" }}>
          Import
          <input
            type="file"
            accept="application/json"
            onChange={importNote}
            style={{ display: "none" }}
          />
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#8d8f89" }}>{status}</span>
      </div>

      {/* body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {state && h && (
          <Toolbar
            state={state}
            onTool={(t: ToolType) => h.setTool(t)}
            onPen={(p: PenSettings) => h.setPen(p)}
            onEraserMode={(m: EraserMode) => h.setEraserMode(m)}
            onUndo={() => h.undo()}
            onRedo={() => h.redo()}
            onDeleteSelection={() => h.deleteSelection()}
            onSelectAll={() => h.selectAll()}
            onClearLayer={() => h.clearActiveLayer()}
            onAddLayer={() => h.addLayer()}
            onRemoveLayer={(id) => h.removeLayer(id)}
            onSetActiveLayer={(id) => h.setActiveLayer(id)}
            onToggleVisible={(id) => h.toggleLayerVisible(id)}
            onSetOpacity={(id, o) => h.setLayerOpacity(id, o)}
            onRename={(id, name) => h.renameLayer(id, name)}
            onReorder={(id, dir) => h.reorderLayer(id, dir)}
            onZoomIn={() => h.zoomBy(1.2)}
            onZoomOut={() => h.zoomBy(1 / 1.2)}
            onAddText={addText}
            onFit={() => h.fitView()}
          />
        )}

        <div
          ref={centerRef}
          style={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            background:
              "repeating-conic-gradient(#111312 0% 25%, #0d0f0e 0% 50%) 50% / 24px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <DrawingCanvas
            ref={handleRef}
            width={PAGE_W}
            height={PAGE_H}
            background="#ffffff"
            initialDoc={docRef.current ?? undefined}
            onPersist={onPersist}
            onState={onState}
          >
            {textBlocks.map((b) => (
              <div
                key={b.id}
                onPointerDown={(e) => {
                  setSelectedBlock(b.id);
                  dragBlock(b.id, e);
                }}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y,
                  width: b.w,
                  minHeight: b.h,
                  border:
                    selectedBlock === b.id
                      ? "1px dashed #8d8f89"
                      : "1px solid transparent",
                  borderRadius: 6,
                  background: "#101210",
                  padding: 6,
                  boxSizing: "border-box",
                }}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) =>
                    updateTextBlock(b.id, { text: e.currentTarget.innerText })
                  }
                  style={{
                    fontSize: b.fontSize,
                    color: b.color,
                    outline: "none",
                    minHeight: b.h - 12,
                    cursor: "text",
                    whiteSpace: "pre-wrap",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {b.text}
                </div>
                {selectedBlock === b.id && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => deleteTextBlock(b.id)}
                    style={{
                      position: "absolute",
                      right: -10,
                      top: -10,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "1px solid #2f3230",
                      background: "#1b201d",
                      color: "#e8e7e1",
                      cursor: "pointer",
                      fontSize: 11,
                      lineHeight: "20px",
                      textAlign: "center",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </DrawingCanvas>
        </div>
      </div>
    </div>
  );
}

const hdrBtn: React.CSSProperties = {
  background: "#141816",
  color: "#e8e7e1",
  border: "1px solid #2f3230",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 13,
};
