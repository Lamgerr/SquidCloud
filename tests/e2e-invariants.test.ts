import { describe, expect, test } from "bun:test";
import {
  checkAnonKeyRpc,
  checkMathRandomInCrypto,
  checkRawKeyEscrow,
  scanFiles,
} from "../scripts/check-e2e-invariants.mjs";

const file = (path: string, content: string) => ({ path, content });

describe("e2e invariant checker", () => {
  test("clean sources produce no violations", () => {
    expect(scanFiles([
      file("src/lib/e2e-v4.ts", "crypto.getRandomValues(new Uint8Array(12))"),
      file("src/pages/Auth.tsx", "Math.random() // decorative only"),
      file("supabase/migrations/001.sql", "grant execute on function public.safe_rpc to anon;"),
    ])).toEqual([]);
  });

  test("Math.random is banned in crypto paths but allowed elsewhere", () => {
    expect(checkMathRandomInCrypto([file("src/lib/e2e-v4.ts", "Math.random()")])).toHaveLength(1);
    expect(checkMathRandomInCrypto([file("src/lib/res54.ts", "Math.random()")])).toHaveLength(1);
    expect(checkMathRandomInCrypto([file("src/components/Toast.tsx", "Math.random()")])).toHaveLength(0);
  });

  test("new E2E paths never call the key escrow endpoint", () => {
    expect(checkRawKeyEscrow([file("src/lib/e2e-v4-upload.ts", "invoke('store-file-key')")])).toHaveLength(1);
    expect(checkRawKeyEscrow([file("src/lib/e2e-upload-policy.ts", "fetch('/api/store-file-key')")])).toHaveLength(1);
    expect(checkRawKeyEscrow([file("src/lib/legacy.ts", "invoke('store-file-key')")])).toHaveLength(0);
  });

  test("migrations may not grant anon access to key-returning RPCs", () => {
    expect(checkAnonKeyRpc([file(
      "supabase/migrations/009.sql",
      "grant execute on function public.get_shared_file_info to anon;",
    )])).toHaveLength(1);
    expect(checkAnonKeyRpc([file(
      "supabase/migrations/009.sql",
      "revoke all on function public.get_shared_file_info from anon;",
    )])).toHaveLength(0);
  });
});
