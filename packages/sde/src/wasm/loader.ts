let wasm: WebAssembly.Instance | null = null;

export async function loadWasm(url = "/sde.wasm"): Promise<WebAssembly.Instance> {
  if (wasm) return wasm;
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const mod = await WebAssembly.compile(buf);
  const imports = { env: { abort: () => { throw new Error("wasm abort"); } } };
  wasm = await WebAssembly.instantiate(mod, imports);
  return wasm;
}

export function getWasm(): WebAssembly.Instance | null { return wasm; }
