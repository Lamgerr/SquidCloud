use crate::config::{SquidProxyConfig, SquidVeilConfig};
use crate::crypto;
use crate::error::*;
use crate::proxy;
use crate::squidshake::SquidShakeClient;
use crate::veilref::VeilRef;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

pub struct SquidVeilEngine {
    pub config: SquidVeilConfig,
    pub proxy_config: Option<SquidProxyConfig>,
    pub shake_client: Option<SquidShakeClient>,
}

impl SquidVeilEngine {
    pub fn init(config_path: &str) -> Result<Self> {
        let config_path = std::path::Path::new(config_path);
        let config_dir = config_path.parent().unwrap_or(std::path::Path::new("."));

        let config = SquidVeilConfig::from_path(config_path)?;

        let proxy_path = config_dir.join(".squidproxy");
        let proxy_config = if proxy_path.exists() {
            Some(SquidProxyConfig::from_path(&proxy_path)?)
        } else {
            None
        };

        Ok(Self {
            config,
            proxy_config,
            shake_client: None,
        })
    }

    pub fn get_veilref(&self, secret_name: &str, signing_key: &[u8]) -> Result<VeilRef> {
        if !self.config.is_secret_allowed(secret_name) {
            return Err(SquidVeilError::SecretNotFound(secret_name.to_string()));
        }

        let ops_allowed = if let Some(ref proxy) = self.proxy_config {
            if let Some(secret) = proxy.find_secret(secret_name) {
                match secret.secret_type.as_str() {
                    "http_auth" => vec!["proxy_request".into()],
                    "hmac_sign" => vec!["sign".into()],
                    "aes_gcm" => vec!["encrypt".into(), "decrypt".into()],
                    "connection_string" => vec!["proxy_request".into()],
                    _ => vec!["proxy_request".into()],
                }
            } else {
                vec!["proxy_request".into()]
            }
        } else {
            vec!["proxy_request".into()]
        };

        Ok(VeilRef::new(
            secret_name,
            "squidveil-engine",
            &SquidShakeClient::device_fingerprint(),
            self.config.policy.ref_ttl,
            self.config.policy.ref_max_uses,
            ops_allowed,
            signing_key,
        ))
    }
}

#[no_mangle]
pub extern "C" fn squidveil_init(config_path: *const c_char) -> *mut SquidVeilEngine {
    let c_str = unsafe { CStr::from_ptr(config_path) };
    let path = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    match SquidVeilEngine::init(path) {
        Ok(engine) => Box::into_raw(Box::new(engine)),
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn squidveil_free(engine: *mut SquidVeilEngine) {
    if !engine.is_null() {
        unsafe {
            drop(Box::from_raw(engine));
        }
    }
}

#[no_mangle]
pub extern "C" fn squidveil_get(
    engine: *mut SquidVeilEngine,
    name: *const c_char,
    signing_key: *const c_char,
) -> *mut c_char {
    if engine.is_null() || name.is_null() || signing_key.is_null() {
        return std::ptr::null_mut();
    }

    let engine = unsafe { &*engine };
    let name_str = unsafe { CStr::from_ptr(name) }.to_str().unwrap_or("");
    let key_str = unsafe { CStr::from_ptr(signing_key) }.to_str().unwrap_or("");

    let key_bytes = crypto::sha256(key_str.as_bytes());

    match engine.get_veilref(name_str, &key_bytes) {
        Ok(ref_) => {
            let json = ref_.to_json().unwrap_or_default();
            CString::new(json).unwrap_or_default().into_raw()
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn squidveil_ref_display(ref_json: *const c_char) -> *mut c_char {
    if ref_json.is_null() {
        return std::ptr::null_mut();
    }
    let json_str = unsafe { CStr::from_ptr(ref_json) }.to_str().unwrap_or("");
    match VeilRef::from_json(json_str) {
        Ok(ref_) => {
            let display = format!("{}", ref_);
            CString::new(display).unwrap_or_default().into_raw()
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn squidveil_ref_is_expired(ref_json: *const c_char) -> bool {
    if ref_json.is_null() {
        return true;
    }
    let json_str = unsafe { CStr::from_ptr(ref_json) }.to_str().unwrap_or("");
    VeilRef::from_json(json_str).map(|r| r.is_expired()).unwrap_or(true)
}

#[no_mangle]
pub extern "C" fn squidveil_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            drop(CString::from_raw(s));
        }
    }
}

#[no_mangle]
pub extern "C" fn squidveil_encrypt(
    secret_value: *const c_char,
    api_key: *const c_char,
) -> *mut c_char {
    if secret_value.is_null() || api_key.is_null() {
        return std::ptr::null_mut();
    }
    let value = unsafe { CStr::from_ptr(secret_value) }.to_str().unwrap_or("");
    let key_str = unsafe { CStr::from_ptr(api_key) }.to_str().unwrap_or("");

    let key = crypto::derive_encryption_key(key_str);
    match proxy::encrypt_value(value, &key) {
        Ok(result) => {
            let json = serde_json::json!(result).to_string();
            CString::new(json).unwrap_or_default().into_raw()
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn squidveil_decrypt(
    ciphertext: *const c_char,
    iv: *const c_char,
    api_key: *const c_char,
) -> *mut c_char {
    if ciphertext.is_null() || iv.is_null() || api_key.is_null() {
        return std::ptr::null_mut();
    }
    let ct = unsafe { CStr::from_ptr(ciphertext) }.to_str().unwrap_or("");
    let iv_str = unsafe { CStr::from_ptr(iv) }.to_str().unwrap_or("");
    let key_str = unsafe { CStr::from_ptr(api_key) }.to_str().unwrap_or("");

    let key = crypto::derive_encryption_key(key_str);
    match proxy::decrypt_value(ct, iv_str, &key) {
        Ok(plaintext) => CString::new(plaintext).unwrap_or_default().into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}
