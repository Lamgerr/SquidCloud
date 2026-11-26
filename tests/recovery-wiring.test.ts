import { describe, expect, test } from "bun:test";
import {
  buildDeviceRecord,
  formatShareForStorage,
  parseShareEnvelope,
} from "../src/lib/recovery-wiring";

describe("recovery wiring", () => {
  test("device record stores PRF salt and wrapped master key", () => {
    const record = buildDeviceRecord("user-1", {
      credentialId: "cred-1", publicKey: "pk", prfSalt: "salt-b64",
    }, "iv:wrapped");
    expect(record).toMatchObject({
      user_id: "user-1",
      device_id: "cred-1",
      wrapped_mk: "iv:wrapped",
    });
    expect(JSON.parse(record.public_key)).toEqual({ publicKey: "pk", prfSalt: "salt-b64" });
  });

  test("share envelope round-trips without exposing contact metadata", () => {
    const envelope = formatShareForStorage("1:sharepayload", "contact-1");
    expect(parseShareEnvelope(envelope)).toEqual({ contactId: "contact-1", share: "1:sharepayload" });
    expect(envelope).toContain("contact-1");
  });
});
