# 🔒 Security Model & Policy

## 1. Zero-Trust Session Vault
- Sensitive tokens (such as `li_at` session keys) are **never** stored in plaintext on disk.
- All credentials are encrypted using AES-256-GCM authenticated encryption with PBKDF2 key derivation (100,000 salt iterations).
- Keys are kept in memory and wiped from external serialize handlers.

## 2. PII Sanitization
- The public code repository contains **zero** personally identifiable information (PII).
- Profiles and contact details are loaded dynamically from locally ignored configuration files (`user_cv.json`) or injected runtime environment variables.
- Example templates are provided via `user_cv.example.json` and `cookies.example.json`.

## 3. Human-in-the-Loop (HITL) Guardrail
- Automated application filling performs read and input steps with full human supervision.
- Submissions require explicit human approval via the interface before form finalization.

## 4. Responsible Disclosure
If you discover any security vulnerability in this project, please open a private security advisory on GitHub or contact the maintainers directly.
