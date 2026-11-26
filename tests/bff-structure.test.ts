import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../api/internal/vault.js", import.meta.url), "utf8");

describe("internal vault BFF structure", () => {
  test("no operation branch reads a variable before it is declared", () => {
    const opDeclaredAt = source.indexOf("const op = String(body.op");
    const authDeclaredAt = source.indexOf("const auth = String(req.headers.authorization");
    const supabaseDeclaredAt = source.indexOf("const supabase = createClient(");
    const ktlAt = source.indexOf("if (op === 'ktl-append')");

    expect(opDeclaredAt).toBeGreaterThan(-1);
    expect(authDeclaredAt).toBeGreaterThan(-1);
    expect(supabaseDeclaredAt).toBeGreaterThan(-1);
    expect(ktlAt).toBeGreaterThan(opDeclaredAt);
    expect(ktlAt).toBeGreaterThan(authDeclaredAt);
    expect(ktlAt).toBeGreaterThan(supabaseDeclaredAt);
  });

  test("every early public branch uses body.op, not the late op variable", () => {
    const opDeclaredAt = source.indexOf("const op = String(body.op");
    const before = source.slice(0, opDeclaredAt);
    expect(before).not.toMatch(/if\s*\(\s*op\s*===/);
  });
});
