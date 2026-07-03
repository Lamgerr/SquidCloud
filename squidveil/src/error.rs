use thiserror::Error;

#[derive(Error, Debug)]
pub enum SquidVeilError {
    #[error("Config error: {0}")]
    Config(String),

    #[error("Secret not found: {0}")]
    SecretNotFound(String),

    #[error("VeilRef expired")]
    VeilRefExpired,

    #[error("VeilRef consumed (max uses reached)")]
    VeilRefConsumed,

    #[error("VeilRef device mismatch")]
    VeilRefDeviceMismatch,

    #[error("Operation not allowed for this VeilRef")]
    OperationNotAllowed,

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("TOML parse error: {0}")]
    Toml(#[from] toml::de::Error),

    #[error("Invalid policy: {0}")]
    InvalidPolicy(String),

    #[error("Session not authenticated")]
    SessionNotAuthenticated,
}

pub type Result<T> = std::result::Result<T, SquidVeilError>;
