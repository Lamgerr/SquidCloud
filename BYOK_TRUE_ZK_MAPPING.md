# BYOK (Bring Your Own Key) True Zero-Knowledge Architecture

## Concept Overview
The goal of a true BYOK architecture on CloudBliss (SquidCloud v11) is that the server **never** sees or stores the user's encryption key. If a file is uploaded with BYOK enabled:
1. The file is encrypted entirely on the client side using the user's explicit BYOK key.
2. The encryption key is **omitted** from the metadata payload sent to the backend. It is never stored in the Supabase database.
3. When any user visits the Share Page (`/s/:id`), the system attempts to fetch the file metadata.
4. Because the `encryption_key` field in the database is `null`, the Share Page realizes this is a BYOK-encrypted file.
5. The UI halts the download/preview process and pops up a modal asking the viewer to input the exact BYOK key to decrypt the file locally.

## Architecture Mapping

### 1. Upload Flow (Zero-Knowledge)
![Upload Flow](https://mermaid.ink/img/pako:eNp1kMtqwzAQRX_FaFWgsV2y6cKbbrroQvLQSbMYeTwOVo0lY0NNI_Tfa8cl0I1G0sydO_c-g6Z0BS2Qh1o1G1Xw17vSShP4p1yv116Y66y24h21yqV-kXfSCLgH5nBYD8Z_8kO0h7ZzGj_vB7h5v2G-_1gMw8_hcEAU8g_7V4sF2h1eQ3tO5zQZp2v4B9vDCyqD7W1c-iF_lH1H865tQJtcB3gA9o4j_e2o5W16M_y90A5uB-0nZ6FwQ-pQ5oO7AbtB0g9aEdoPugTeg_T9aAfvB2YJ0oP0vW87-PsgbT8b_gH5P4wfwX-H_R9yvxk6FwwA)

- **User Action**: Uploads `secret.pdf` with BYOK actively enabled.
- **Client Processing**: Web Crypto API encrypts chunks using the BYOK key.
- **Submission**: Metadata is sent to Supabase. `encryptionKey: null` or `encryptionKey: 'byok_protected'`.
- **Database**: No key is stored. The system mathematically cannot decrypt the file without the user.

### 2. Share Page Download Flow
![Download Flow](https://mermaid.ink/img/pako:eNo1kMtqwzAQRX_FaFWgsV2y6cKbbrroQvLQSbMYeTwOVo0lY0NNI_Tfa8cl0I1G0sydO_c-g6Z0BS2Qh1o1G1Xw17vSShP4p1yv116Y66y24h21yqV-kXfSCLgH5nBYD8Z_8kO0h7ZzGj_vB7h5v2G-_1gMw8_hcEAU8g_7V4sF2h1eQ3tO5zQZp2v4B9vDCyqD7W1c-iF_lH1H865tQJtcB3gA9o4j_e2o5W16M_y90A5uB-0nZ6FwQ-pQ5oO7AbtB0g9aEdoPugTeg_T9aAfvB2YJ0oP0vW87-PsgbT8b_gH5P4wfwX-H_R9yvxk6FwwA)

- **Visitor Action**: Opens `/s/:shareId` and clicks "Download" or "Preview".
- **API Call**: Fetches file metadata. Notices `encryptionKey` is missing.
- **Client Prompt**: The Share Page pops up an Ephemeral BYOK modal: *"This file is BYOK protected. Enter decryption key."*
- **Decryption**: If valid, chunks are decrypted in real-time in the browser. If invalid, fails with AES-GCM tag mismatch.

## Database Implication
Since the `encryption_key` column is `null`, any potential database leak, administrative access, or downstream share link is useless without the out-of-band transmission of the exact BYOK key from the host to the guest. This is real Zero-Knowledge.