use crate::error::*;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SquidVeilConfig {
    pub project: ProjectConfig,
    #[serde(default)]
    pub daemon: DaemonConfig,
    #[serde(default)]
    pub policy: PolicyConfig,
    #[serde(default)]
    pub secrets: SecretsFilter,
    #[serde(default)]
    pub proxy: ProxyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: String,
    pub name: String,
    #[serde(default = "default_environment")]
    pub environment: String,
}

fn default_environment() -> String {
    "production".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    #[serde(default = "default_true")]
    pub auto_start: bool,
    #[serde(default = "default_true")]
    pub auto_inject: bool,
    #[serde(default = "default_kernel_mode")]
    pub kernel_mode: String,
}

fn default_true() -> bool {
    true
}

fn default_kernel_mode() -> String {
    "auto".into()
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            auto_start: true,
            auto_inject: true,
            kernel_mode: "auto".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyConfig {
    #[serde(default = "default_true")]
    pub fail_closed: bool,
    #[serde(default = "default_true")]
    pub audit: bool,
    #[serde(default)]
    pub allow_print: bool,
    #[serde(default = "default_ref_ttl")]
    pub ref_ttl: i64,
    #[serde(default = "default_ref_max_uses")]
    pub ref_max_uses: u32,
}

fn default_ref_ttl() -> i64 {
    60
}

fn default_ref_max_uses() -> u32 {
    1
}

impl Default for PolicyConfig {
    fn default() -> Self {
        Self {
            fail_closed: true,
            audit: true,
            allow_print: false,
            ref_ttl: 60,
            ref_max_uses: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretsFilter {
    #[serde(default)]
    pub allow: Vec<String>,
    #[serde(default)]
    pub deny: Vec<String>,
}

impl Default for SecretsFilter {
    fn default() -> Self {
        Self {
            allow: vec![],
            deny: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub intercept_http: bool,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            intercept_http: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SquidProxyConfig {
    pub secret: Vec<ProxySecret>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxySecret {
    pub name: String,
    #[serde(rename = "type")]
    pub secret_type: String,
    #[serde(default)]
    pub inject_header: Option<String>,
    #[serde(default)]
    pub inject_format: Option<String>,
    #[serde(default)]
    pub allowed_hosts: Vec<String>,
    #[serde(default)]
    pub allowed_paths: Vec<String>,
    #[serde(default)]
    pub methods: Vec<String>,
    #[serde(default)]
    pub rate_limit: Option<u32>,
    #[serde(default)]
    pub ref_ttl: Option<i64>,
    #[serde(default)]
    pub algorithm: Option<String>,
    #[serde(default)]
    pub output_header: Option<String>,
    #[serde(default)]
    pub key_size: Option<u32>,
    #[serde(default)]
    pub signing_algo: Option<String>,
}

impl SquidVeilConfig {
    pub fn from_path(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| SquidVeilError::Config(format!("Cannot read {}: {}", path.display(), e)))?;
        Self::from_str(&content)
    }

    pub fn from_str(content: &str) -> Result<Self> {
        let config: Self = toml::from_str(content)?;
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        if self.project.id.is_empty() {
            return Err(SquidVeilError::InvalidPolicy("project.id is required".into()));
        }
        if self.project.name.is_empty() {
            return Err(SquidVeilError::InvalidPolicy("project.name is required".into()));
        }
        match self.project.environment.as_str() {
            "production" | "staging" | "development" => {}
            other => {
                return Err(SquidVeilError::InvalidPolicy(format!(
                    "Invalid environment: {}. Must be production, staging, or development",
                    other
                )));
            }
        }
        if self.policy.ref_ttl <= 0 {
            return Err(SquidVeilError::InvalidPolicy("policy.ref_ttl must be > 0".into()));
        }
        if self.policy.ref_max_uses == 0 {
            return Err(SquidVeilError::InvalidPolicy("policy.ref_max_uses must be > 0".into()));
        }
        Ok(())
    }

    pub fn is_secret_allowed(&self, name: &str) -> bool {
        if !self.secrets.allow.is_empty() {
            if !self.secrets.allow.iter().any(|p| glob_match(p, name)) {
                return false;
            }
        }
        if self.secrets.deny.iter().any(|p| glob_match(p, name)) {
            return false;
        }
        true
    }
}

impl SquidProxyConfig {
    pub fn from_path(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| SquidVeilError::Config(format!("Cannot read {}: {}", path.display(), e)))?;
        Self::from_str(&content)
    }

    pub fn from_str(content: &str) -> Result<Self> {
        let config: Self = toml::from_str(content)?;
        Ok(config)
    }

    pub fn find_secret(&self, name: &str) -> Option<&ProxySecret> {
        self.secret.iter().find(|s| s.name == name)
    }

    pub fn find_by_host(&self, host: &str) -> Vec<&ProxySecret> {
        self.secret
            .iter()
            .filter(|s| s.allowed_hosts.iter().any(|h| glob_match(h, host)))
            .collect()
    }
}

fn glob_match(pattern: &str, name: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    if pattern == name {
        return true;
    }
    if pattern.ends_with('*') {
        let prefix = pattern.trim_end_matches('*');
        return name.starts_with(prefix);
    }
    if pattern.starts_with('*') {
        let suffix = pattern.trim_start_matches('*');
        return name.ends_with(suffix);
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_squidveil_config() {
        let toml = r#"
[project]
id = "proj_test123"
name = "my-service"
environment = "production"

[policy]
fail_closed = true
audit = true
ref_ttl = 60
ref_max_uses = 1

[secrets]
allow = ["STRIPE_*", "DB_*"]
deny = ["ADMIN_*"]
"#;
        let config = SquidVeilConfig::from_str(toml).unwrap();
        assert_eq!(config.project.id, "proj_test123");
        assert_eq!(config.project.name, "my-service");
        assert!(config.is_secret_allowed("STRIPE_API_KEY"));
        assert!(config.is_secret_allowed("DB_PASSWORD"));
        assert!(!config.is_secret_allowed("ADMIN_KEY"));
        assert!(!config.is_secret_allowed("OTHER_KEY"));
    }

    #[test]
    fn test_parse_squidproxy_config() {
        let toml = r#"
[[secret]]
name = "STRIPE_API_KEY"
type = "http_auth"
inject_header = "Authorization"
inject_format = "Bearer {secret}"
allowed_hosts = ["api.stripe.com"]
methods = ["GET", "POST"]
rate_limit = 500

[[secret]]
name = "WEBHOOK_KEY"
type = "hmac_sign"
algorithm = "sha256"
output_header = "X-Signature"
"#;
        let config = SquidProxyConfig::from_str(toml).unwrap();
        assert_eq!(config.secret.len(), 2);
        let stripe = config.find_secret("STRIPE_API_KEY").unwrap();
        assert_eq!(stripe.inject_format.as_deref(), Some("Bearer {secret}"));
        assert!(stripe.allowed_hosts.contains(&"api.stripe.com".into()));
    }

    #[test]
    fn test_glob_match() {
        assert!(glob_match("STRIPE_*", "STRIPE_API_KEY"));
        assert!(!glob_match("STRIPE_*", "SENDGRID_API_KEY"));
        assert!(glob_match("*_KEY", "STRIPE_API_KEY"));
        assert!(glob_match("*_KEY", "SENDGRID_API_KEY"));
        assert!(glob_match("*", "ANYTHING"));
        assert!(!glob_match("DB_*", "API_KEY"));
    }
}
