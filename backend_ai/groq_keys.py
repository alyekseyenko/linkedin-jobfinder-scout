"""Groq API key pool from environment (primary + comma-separated fallbacks)."""

import os


def get_groq_api_keys(extra_key: str | None = None) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    if extra_key and extra_key.strip():
        k = extra_key.strip()
        seen.add(k)
        ordered.append(k)

    primary = os.environ.get("GROQ_API_KEY", "").strip()
    if primary and primary not in seen:
        seen.add(primary)
        ordered.append(primary)

    multi = os.environ.get("GROQ_API_KEYS", "").strip()
    if multi:
        for part in multi.replace(";", ",").split(","):
            k = part.strip()
            if k and k not in seen:
                seen.add(k)
                ordered.append(k)

    return ordered


def has_groq_api_keys(extra_key: str | None = None) -> bool:
    return len(get_groq_api_keys(extra_key)) > 0
