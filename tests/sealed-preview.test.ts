import { describe, expect, test } from "bun:test";
import {
  assertNoAppOriginPreviewUrl,
  isAppOriginBlobUrl,
  isBlobMessage,
  isRenderMessage,
  isSealedReadyMessage,
} from "../src/lib/sealed-preview-policy";

describe("sealed preview policy", () => {
  test("detects an app-origin blob URL but not an opaque-frame one", () => {
    expect(isAppOriginBlobUrl("blob:https://squidcloud.vercel.app/abc", "https://squidcloud.vercel.app")).toBe(true);
    expect(isAppOriginBlobUrl("blob:null/abc", "https://squidcloud.vercel.app")).toBe(false);
    expect(isAppOriginBlobUrl("blob:https://elsewhere.example/abc", "https://squidcloud.vercel.app")).toBe(false);
    expect(isAppOriginBlobUrl("https://squidcloud.vercel.app/file", "https://squidcloud.vercel.app")).toBe(false);
  });

  test("rejects app-origin blob URLs used as preview sources", () => {
    expect(() => assertNoAppOriginPreviewUrl("blob:https://squidcloud.vercel.app/abc", "https://squidcloud.vercel.app")).toThrow();
    expect(() => assertNoAppOriginPreviewUrl("blob:null/abc", "https://squidcloud.vercel.app")).not.toThrow();
  });

  test("ready message must come from the expected frame", () => {
    const frame = {} as Window;
    const other = {} as Window;
    expect(isSealedReadyMessage({ source: frame, data: "sealed-ready" } as MessageEvent, frame)).toBe(true);
    expect(isSealedReadyMessage({ source: other, data: "sealed-ready" } as MessageEvent, frame)).toBe(false);
    expect(isSealedReadyMessage({ source: frame, data: "malicious" } as MessageEvent, frame)).toBe(false);
  });

  test("render and blob messages require the expected source and shape", () => {
    const frame = {} as Window;
    expect(isRenderMessage({ source: frame, data: { type: "render", html: "<b>ok</b>" } } as MessageEvent, frame)).toBe(true);
    expect(isRenderMessage({ source: frame, data: { type: "render", html: 123 } } as MessageEvent, frame)).toBe(false);
    expect(isRenderMessage({ source: null, data: { type: "render", html: "<b>ok</b>" } } as MessageEvent, frame)).toBe(false);

    expect(isBlobMessage({ source: frame, data: { type: "blob", blob: {}, kind: "image" } } as MessageEvent, frame)).toBe(true);
    expect(isBlobMessage({ source: frame, data: { type: "blob", blob: {} } } as MessageEvent, frame)).toBe(false);
    expect(isBlobMessage({ source: null, data: { type: "blob", blob: {}, kind: "image" } } as MessageEvent, frame)).toBe(false);
  });
});
