#ifndef SQUIDVEIL_H
#define SQUIDVEIL_H

#ifdef __cplusplus
extern "C" {
#endif

/* Initialize SquidVeil engine from .squidveil config path */
void* squidveil_init(const char* config_path);

/* Free the engine */
void squidveil_free(void* engine);

/* Get a VeilRef JSON string for a secret name.
   Returns null on failure. Caller must free with squidveil_free_string. */
char* squidveil_get(void* engine, const char* name, const char* signing_key);

/* Get display string for a VeilRef JSON */
char* squidveil_ref_display(const char* ref_json);

/* Check if a VeilRef is expired */
int squidveil_ref_is_expired(const char* ref_json);

/* Free a string returned by any squidveil_* function */
void squidveil_free_string(char* s);

/* Encrypt a secret value using an API key.
   Returns JSON: {"ciphertext": "...", "iv": "..."} */
char* squidveil_encrypt(const char* secret_value, const char* api_key);

/* Decrypt a secret value using an API key.
   Returns plaintext string or null on failure. */
char* squidveil_decrypt(const char* ciphertext, const char* iv, const char* api_key);

#ifdef __cplusplus
}
#endif

#endif /* SQUIDVEIL_H */
