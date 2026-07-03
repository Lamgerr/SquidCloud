use crate::veilref::VeilRef;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SquidVeilWasm;

#[wasm_bindgen]
impl SquidVeilWasm {
    pub fn create_veilref(
        secret_name: &str,
        session_id: &str,
        device_fingerprint: &str,
        ref_ttl: i64,
        max_uses: u32,
        ops_allowed: Vec<JsValue>,
        signing_key_hex: &str,
    ) -> Result<JsValue, JsValue> {
        let ops: Vec<String> = ops_allowed
            .into_iter()
            .filter_map(|v| v.as_string())
            .collect();
        let key = hex::decode(signing_key_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let ref_ = VeilRef::new(secret_name, session_id, device_fingerprint, ref_ttl, max_uses, ops, &key);
        let json = serde_json::to_string(&ref_).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(JsValue::from_str(&json))
    }

    pub fn verify_veilref(ref_json: &str, signing_key_hex: &str) -> Result<bool, JsValue> {
        let ref_ = VeilRef::from_json(ref_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let key = hex::decode(signing_key_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;
        ref_.verify_hmac(&key).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn is_expired(ref_json: &str) -> Result<bool, JsValue> {
        let ref_ = VeilRef::from_json(ref_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(ref_.is_expired())
    }

    pub fn is_consumed(ref_json: &str) -> Result<bool, JsValue> {
        let ref_ = VeilRef::from_json(ref_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(ref_.is_consumed())
    }

    pub fn display(ref_json: &str) -> Result<String, JsValue> {
        let ref_ = VeilRef::from_json(ref_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(format!("{}", ref_))
    }

    pub fn sha256_hex(data: &str) -> String {
        crate::crypto::sha256_hex(data.as_bytes())
    }

    pub fn blake3_hash(data: &str) -> String {
        crate::crypto::blake3_hash(data.as_bytes())
    }

    pub fn generate_nonce() -> String {
        crate::squidshake::SquidShakeClient::generate_nonce()
    }
}
