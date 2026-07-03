use crate::error::*;
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

#[derive(Zeroize)]
#[zeroize(drop)]
pub struct SensitiveBytes(pub Vec<u8>);

pub fn sha256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex::encode(sha256(data))
}

pub fn blake3_hash(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}

pub fn random_bytes(len: usize) -> Vec<u8> {
    let mut buf = vec![0u8; len];
    OsRng.fill_bytes(&mut buf);
    buf
}

pub fn aes256_gcm_encrypt(plaintext: &[u8], key: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);
    let mut iv = vec![0u8; 12];
    OsRng.fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| SquidVeilError::Crypto(format!("encryption failed: {}", e)))?;
    Ok((ciphertext, iv))
}

pub fn aes256_gcm_decrypt(ciphertext: &[u8], key: &[u8], iv: &[u8]) -> Result<Vec<u8>> {
    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(iv);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| SquidVeilError::Crypto(format!("decryption failed: {}", e)))?;
    Ok(plaintext)
}

pub fn encode_base64(data: &[u8]) -> String {
    BASE64.encode(data)
}

pub fn decode_base64(data: &str) -> Result<Vec<u8>> {
    BASE64
        .decode(data)
        .map_err(|e| SquidVeilError::Crypto(format!("base64 decode failed: {}", e)))
}

pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    use sha2::Digest;
    const BLOCK_SIZE: usize = 64;
    let mut k = key.to_vec();
    if k.len() > BLOCK_SIZE {
        k = Sha256::digest(key).to_vec();
    }
    k.resize(BLOCK_SIZE, 0);
    let mut ipad = vec![0x36u8; BLOCK_SIZE];
    let mut opad = vec![0x5cu8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        ipad[i] ^= k[i];
        opad[i] ^= k[i];
    }
    let inner = Sha256::digest(&[&ipad, data].concat());
    let inner_slice: &[u8] = &inner;
    let outer_input = [opad.as_slice(), inner_slice].concat();
    Sha256::digest(&outer_input).to_vec()
}

pub fn derive_encryption_key(api_key: &str) -> Vec<u8> {
    sha256(api_key.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aes256_roundtrip() {
        let key = sha256(b"test-api-key");
        let plaintext = b"hello-squidveil-secret";
        let (ciphertext, iv) = aes256_gcm_encrypt(plaintext, &key).unwrap();
        let decrypted = aes256_gcm_decrypt(&ciphertext, &key, &iv).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_hmac_sha256_deterministic() {
        let result1 = hmac_sha256(b"key", b"data");
        let result2 = hmac_sha256(b"key", b"data");
        assert_eq!(result1, result2);
    }

    #[test]
    fn test_derive_key() {
        let key = derive_encryption_key("cb_abc123");
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_blake3() {
        let hash = blake3_hash(b"device-fingerprint");
        assert_eq!(hash.len(), 64);
    }
}
