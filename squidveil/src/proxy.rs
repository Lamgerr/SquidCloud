use crate::config::ProxySecret;
use crate::error::*;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyRequest {
    pub url: String,
    pub method: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedOutput {
    pub signature: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedOutput {
    pub ciphertext: String,
    pub iv: String,
}

pub async fn execute_proxy_request(
    secret_value: &str,
    proxy_config: &ProxySecret,
    request: &ProxyRequest,
) -> Result<ProxyResponse> {
    let mut headers = request.headers.clone();

    if proxy_config.secret_type == "http_auth" {
        if let Some(ref format) = proxy_config.inject_format {
            let value = format.replace("{secret}", secret_value);
            if let Some(ref header) = proxy_config.inject_header {
                headers.insert(header.clone(), value);
            }
        }
    }

    let client = reqwest::Client::new();
    let req_builder = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&request.url),
        "POST" => {
            let mut b = client.post(&request.url);
            if let Some(ref body) = request.body {
                b = b.body(body.clone());
            }
            b
        }
        "PUT" => {
            let mut b = client.put(&request.url);
            if let Some(ref body) = request.body {
                b = b.body(body.clone());
            }
            b
        }
        "DELETE" => client.delete(&request.url),
        "PATCH" => {
            let mut b = client.patch(&request.url);
            if let Some(ref body) = request.body {
                b = b.body(body.clone());
            }
            b
        }
        _ => return Err(SquidVeilError::Config(format!("Unsupported method: {}", request.method))),
    };

    let mut header_map = HeaderMap::new();
    for (k, v) in &headers {
        if let (Ok(name), Ok(value)) = (
            HeaderName::from_bytes(k.as_bytes()),
            HeaderValue::from_str(v),
        ) {
            header_map.insert(name, value);
        }
    }
    let resp = req_builder
        .headers(header_map)
        .send()
        .await
        .map_err(|e| SquidVeilError::Network(e.to_string()))?;

    let status = resp.status().as_u16();
    let resp_headers = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    let body = resp.text().await.ok();

    Ok(ProxyResponse {
        status,
        headers: resp_headers,
        body,
    })
}

pub fn compute_hmac(algorithm: &str, key: &[u8], data: &[u8]) -> Result<SignedOutput> {
    match algorithm.to_lowercase().as_str() {
        "sha256" => {
            let sig = hex::encode(crate::crypto::hmac_sha256(key, data));
            Ok(SignedOutput {
                signature: sig,
                algorithm: "sha256".into(),
            })
        }
        _ => Err(SquidVeilError::Crypto(format!("Unsupported HMAC algorithm: {}", algorithm))),
    }
}

pub fn encrypt_value(plaintext: &str, key: &[u8]) -> Result<EncryptedOutput> {
    let (ciphertext, iv) = crate::crypto::aes256_gcm_encrypt(plaintext.as_bytes(), key)?;
    Ok(EncryptedOutput {
        ciphertext: crate::crypto::encode_base64(&ciphertext),
        iv: crate::crypto::encode_base64(&iv),
    })
}

pub fn decrypt_value(ciphertext_b64: &str, iv_b64: &str, key: &[u8]) -> Result<String> {
    let ciphertext = crate::crypto::decode_base64(ciphertext_b64)?;
    let iv = crate::crypto::decode_base64(iv_b64)?;
    let plaintext = crate::crypto::aes256_gcm_decrypt(&ciphertext, key, &iv)?;
    String::from_utf8(plaintext)
        .map_err(|e| SquidVeilError::Crypto(format!("UTF-8 decode failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = crate::crypto::sha256(b"test-api-key");
        let result = encrypt_value("my-secret-value", &key).unwrap();
        let decrypted = decrypt_value(&result.ciphertext, &result.iv, &key).unwrap();
        assert_eq!(decrypted, "my-secret-value");
    }

    #[test]
    fn test_hmac_sha256_output() {
        let result = compute_hmac("sha256", b"key", b"data").unwrap();
        assert_eq!(result.algorithm, "sha256");
        assert!(!result.signature.is_empty());
    }
}
