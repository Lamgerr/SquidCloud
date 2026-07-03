use crate::crypto;
use crate::error::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VeilRef {
    pub ref_id: String,
    pub secret_name: String,
    pub session_id: String,
    pub device_bound: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub use_count_max: u32,
    pub use_count_used: u32,
    pub ops_allowed: Vec<String>,
    pub hmac: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VeilRefDisplay {
    pub secret_name: String,
    pub ref_id: String,
    pub ttl_seconds: i64,
}

impl VeilRef {
    pub fn new(
        secret_name: &str,
        session_id: &str,
        device_fingerprint: &str,
        ref_ttl: i64,
        max_uses: u32,
        ops_allowed: Vec<String>,
        signing_key: &[u8],
    ) -> Self {
        let now = Utc::now();
        let ref_id = Uuid::new_v4().to_string().split('-').next().unwrap().to_string();
        let expires_at = now + chrono::Duration::seconds(ref_ttl);

        let mut r = Self {
            ref_id,
            secret_name: secret_name.to_string(),
            session_id: session_id.to_string(),
            device_bound: crypto::blake3_hash(device_fingerprint.as_bytes()),
            issued_at: now,
            expires_at,
            use_count_max: max_uses,
            use_count_used: 0,
            ops_allowed,
            hmac: String::new(),
        };
        r.hmac = r.compute_hmac(signing_key);
        r
    }

    fn canonical_bytes(&self) -> Vec<u8> {
        let mut b = Vec::new();
        b.extend_from_slice(self.ref_id.as_bytes());
        b.extend_from_slice(self.secret_name.as_bytes());
        b.extend_from_slice(self.session_id.as_bytes());
        b.extend_from_slice(self.device_bound.as_bytes());
        b.extend_from_slice(self.issued_at.timestamp().to_string().as_bytes());
        b.extend_from_slice(self.expires_at.timestamp().to_string().as_bytes());
        b.extend_from_slice(&self.use_count_max.to_le_bytes());
        b.extend_from_slice(&self.use_count_used.to_le_bytes());
        for op in &self.ops_allowed {
            b.extend_from_slice(op.as_bytes());
        }
        b
    }

    pub fn compute_hmac(&self, key: &[u8]) -> String {
        hex::encode(crate::crypto::hmac_sha256(key, &self.canonical_bytes()))
    }

    pub fn verify_hmac(&self, key: &[u8]) -> Result<bool> {
        let expected = self.compute_hmac(key);
        Ok(self.hmac == expected)
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn is_consumed(&self) -> bool {
        self.use_count_used >= self.use_count_max
    }

    pub fn is_device_bound(&self, device_fingerprint: &str) -> bool {
        let fp_hash = crypto::blake3_hash(device_fingerprint.as_bytes());
        self.device_bound == fp_hash
    }

    pub fn can_operation(&self, op: &str) -> bool {
        self.ops_allowed.iter().any(|a| a == op)
    }

    pub fn consume(&mut self, signing_key: &[u8]) -> Result<()> {
        if self.is_expired() {
            return Err(SquidVeilError::VeilRefExpired);
        }
        if self.is_consumed() {
            return Err(SquidVeilError::VeilRefConsumed);
        }
        self.use_count_used += 1;
        self.hmac = self.compute_hmac(signing_key);
        Ok(())
    }

    pub fn display(&self) -> VeilRefDisplay {
        let remaining = (self.expires_at - Utc::now()).num_seconds().max(0);
        VeilRefDisplay {
            secret_name: self.secret_name.clone(),
            ref_id: self.ref_id.clone(),
            ttl_seconds: remaining,
        }
    }

    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string(self).map_err(|e| SquidVeilError::Serialization(e.to_string()))
    }

    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json).map_err(|e| SquidVeilError::Serialization(e.to_string()))
    }
}

impl std::fmt::Display for VeilRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let d = self.display();
        write!(f, "[VeilRef:{}:{}:exp:{}s]", d.secret_name, d.ref_id, d.ttl_seconds)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_veilref_create_and_verify() {
        let key = b"test-signing-key-32bytes!";
        let ref_ = VeilRef::new(
            "STRIPE_API_KEY",
            "sess_test",
            "device-fp",
            60,
            1,
            vec!["proxy_request".into()],
            key,
        );
        assert!(ref_.verify_hmac(key).unwrap());
        assert!(!ref_.is_expired());
        assert!(!ref_.is_consumed());
        assert!(ref_.can_operation("proxy_request"));
        assert!(!ref_.can_operation("sign"));
    }

    #[test]
    fn test_veilref_consume() {
        let key = b"test-signing-key-32bytes!";
        let mut ref_ = VeilRef::new("DB_PASS", "sess_test", "device-fp", 60, 2, vec!["proxy_request".into()], key);
        assert!(!ref_.is_consumed());
        ref_.consume(key).unwrap();
        assert_eq!(ref_.use_count_used, 1);
        assert!(!ref_.is_consumed());
        ref_.consume(key).unwrap();
        assert!(ref_.is_consumed());
        assert!(matches!(ref_.consume(key), Err(SquidVeilError::VeilRefConsumed)));
    }

    #[test]
    fn test_veilref_display() {
        let ref_ = VeilRef::new("API_KEY", "sess", "fp", 60, 1, vec!["proxy_request".into()], b"key");
        let display_str = format!("{}", ref_);
        assert!(display_str.starts_with("[VeilRef:API_KEY:"));
        assert!(display_str.contains(":exp:"));
    }

    #[test]
    fn test_veilref_json_roundtrip() {
        let key = b"test-signing-key-32bytes!";
        let ref_ = VeilRef::new("SECRET", "sess", "fp", 120, 5, vec!["proxy_request".into(), "sign".into()], key);
        let json = ref_.to_json().unwrap();
        let deserialized = VeilRef::from_json(&json).unwrap();
        assert_eq!(ref_.ref_id, deserialized.ref_id);
        assert_eq!(ref_.secret_name, deserialized.secret_name);
        assert_eq!(ref_.use_count_max, deserialized.use_count_max);
        assert_eq!(ref_.hmac, deserialized.hmac);
    }

    #[test]
    fn test_veilref_device_bound() {
        let ref_ = VeilRef::new("KEY", "sess", "my-device-123", 60, 1, vec![], b"key");
        assert!(ref_.is_device_bound("my-device-123"));
        assert!(!ref_.is_device_bound("other-device"));
    }
}
