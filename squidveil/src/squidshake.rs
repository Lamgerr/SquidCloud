use crate::crypto;
use crate::error::*;
use serde::{Deserialize, Serialize};

const SQUIDSHAKE_VERSION: &str = "1.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SquidShakeHandshake {
    pub version: String,
    pub project_id: String,
    pub device_fingerprint: String,
    pub session_nonce: String,
    pub client_public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SquidShakeResponse {
    pub version: String,
    pub session_id: String,
    pub server_nonce: String,
    pub server_public_key: String,
    pub encrypted_session_key: String,
    pub hmac: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VeilRefRequest {
    pub session_id: String,
    pub secret_name: String,
    pub ref_ttl: i64,
    pub max_uses: u32,
    pub device_fingerprint: String,
    pub ops_allowed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VeilRefResponse {
    pub veil_ref_json: String,
    pub hmac: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyExecuteRequest {
    pub session_id: String,
    pub ref_id: String,
    pub secret_name: String,
    pub url: String,
    pub method: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: String,
    pub action: String,
    pub project_id: String,
    pub session_id: String,
    pub secret_name: String,
    pub ref_id: String,
    pub success: bool,
    pub detail: String,
}

pub struct SquidShakeClient {
    base_url: String,
    api_key: String,
    signing_key: Vec<u8>,
    session_id: Option<String>,
}

impl SquidShakeClient {
    pub fn new(base_url: &str, api_key: &str) -> Self {
        let signing_key = crypto::sha256(api_key.as_bytes());
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            signing_key,
            session_id: None,
        }
    }

    pub fn session_id(&self) -> Option<&str> {
        self.session_id.as_deref()
    }

    pub fn set_session_id(&mut self, session_id: String) {
        self.session_id = Some(session_id);
    }

    pub fn generate_nonce() -> String {
        let bytes = crypto::random_bytes(32);
        hex::encode(bytes)
    }

    pub fn device_fingerprint() -> String {
        let combined = format!(
            "{}-{}-{}",
            std::env::consts::ARCH,
            std::env::consts::OS,
            hostname()
        );
        crypto::blake3_hash(combined.as_bytes())
    }

    pub async fn handshake(&self) -> Result<SquidShakeResponse> {
        let client = reqwest::Client::new();
        let handshake = SquidShakeHandshake {
            version: SQUIDSHAKE_VERSION.to_string(),
            project_id: "squidveil-client".into(),
            device_fingerprint: Self::device_fingerprint(),
            session_nonce: Self::generate_nonce(),
            client_public_key: "placeholder".into(),
        };

        let resp = client
            .post(format!("{}/squidshake/handshake", self.base_url))
            .header("X-SquidCloud-Key", &self.api_key)
            .json(&handshake)
            .send()
            .await
            .map_err(|e| SquidVeilError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(SquidVeilError::Protocol(format!("Handshake failed: {}", resp.status())));
        }

        let shake_resp: SquidShakeResponse = resp
            .json()
            .await
            .map_err(|e| SquidVeilError::Protocol(format!("Invalid handshake response: {}", e)))?;

        Ok(shake_resp)
    }

    pub async fn request_veilref(&self, secret_name: &str, ops: Vec<String>) -> Result<VeilRefResponse> {
        let session_id = self.session_id.as_deref().ok_or(SquidVeilError::SessionNotAuthenticated)?;
        let client = reqwest::Client::new();

        let req = VeilRefRequest {
            session_id: session_id.to_string(),
            secret_name: secret_name.to_string(),
            ref_ttl: 60,
            max_uses: 1,
            device_fingerprint: Self::device_fingerprint(),
            ops_allowed: ops,
        };

        let resp = client
            .post(format!("{}/squidshake/ref", self.base_url))
            .header("X-SquidCloud-Key", &self.api_key)
            .json(&req)
            .send()
            .await
            .map_err(|e| SquidVeilError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(SquidVeilError::Protocol(format!("VeilRef request failed: {}", resp.status())));
        }

        let ref_resp: VeilRefResponse = resp
            .json()
            .await
            .map_err(|e| SquidVeilError::Protocol(format!("Invalid ref response: {}", e)))?;

        Ok(ref_resp)
    }

    pub async fn audit_log(&self, entry: AuditEntry) -> Result<()> {
        self.session_id.as_deref().ok_or(SquidVeilError::SessionNotAuthenticated)?;
        let client = reqwest::Client::new();

        let resp = client
            .post(format!("{}/squidshake/audit", self.base_url))
            .header("X-SquidCloud-Key", &self.api_key)
            .json(&entry)
            .send()
            .await
            .map_err(|e| SquidVeilError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(SquidVeilError::Protocol(format!("Audit log failed: {}", resp.status())));
        }

        Ok(())
    }
}

fn hostname() -> String {
    #[cfg(target_family = "unix")]
    {
        use std::process::Command;
        Command::new("hostname")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default()
            .trim()
            .to_string()
    }
    #[cfg(not(target_family = "unix"))]
    {
        "unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_fingerprint_not_empty() {
        let fp = SquidShakeClient::device_fingerprint();
        assert!(!fp.is_empty());
        assert_eq!(fp.len(), 64);
    }

    #[test]
    fn test_generate_nonce() {
        let n1 = SquidShakeClient::generate_nonce();
        let n2 = SquidShakeClient::generate_nonce();
        assert_ne!(n1, n2);
        assert_eq!(n1.len(), 64);
    }
}
