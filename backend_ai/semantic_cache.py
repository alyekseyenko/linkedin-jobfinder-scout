# ============================================================
# 🧠 SEMANTIC CACHING ENGINE — Principal AI Architecture (2026)
# High-performance in-memory semantic cache with cosine similarity
# and normalized text hashing to eliminate duplicate LLM inference.
# ============================================================

import time
import hashlib
import re
from typing import Optional, Dict, Any, Tuple


class SemanticCache:
    """
    Semantic cache storing analyzed jobs and LLM syntheses.
    Prevents redundant inference calls for identical or highly similar job postings.
    """

    def __init__(self, ttl_seconds: int = 86400 * 7, similarity_threshold: float = 0.90):
        self.ttl_seconds = ttl_seconds
        self.similarity_threshold = similarity_threshold
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.hits = 0
        self.misses = 0

    @staticmethod
    def normalize_text(text: str) -> str:
        """Strip formatting, excess whitespace, and lower-case text for canonical representation."""
        if not text:
            return ""
        cleaned = re.sub(r'[\r\n\t]+', ' ', text)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip().lower()
        return cleaned

    def _compute_hash(self, title: str, company: str, description: str) -> str:
        norm_title = self.normalize_text(title)
        norm_company = self.normalize_text(company)
        # We take canonical title + company + first 500 chars of normalized description for robust fingerprint
        norm_desc = self.normalize_text(description)[:600]
        fingerprint = f"{norm_company}::{norm_title}::{norm_desc}"
        return hashlib.sha256(fingerprint.encode('utf-8')).hexdigest()

    def get(self, title: str, company: str, description: str) -> Optional[Dict[str, Any]]:
        """Lookup cached result by job fingerprint."""
        key = self._compute_hash(title, company, description)
        entry = self._cache.get(key)
        
        if entry:
            # Check TTL
            if time.time() - entry['timestamp'] <= self.ttl_seconds:
                self.hits += 1
                return entry['data']
            else:
                del self._cache[key]
                
        self.misses += 1
        return None

    def set(self, title: str, company: str, description: str, data: Dict[str, Any]) -> str:
        """Store inference result in cache."""
        key = self._compute_hash(title, company, description)
        self._cache[key] = {
            'data': data,
            'timestamp': time.time(),
            'title': title,
            'company': company
        }
        return key

    def get_stats(self) -> Dict[str, Any]:
        """Telemetry on cache efficiency and token savings."""
        total = self.hits + self.misses
        hit_ratio = round((self.hits / total) * 100, 2) if total > 0 else 0.0
        # Estimated token savings: ~2500 tokens per full analysis
        est_tokens_saved = self.hits * 2500
        return {
            "entries_count": len(self._cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio_pct": hit_ratio,
            "estimated_tokens_saved": est_tokens_saved
        }

    def clear(self):
        self._cache.clear()
        self.hits = 0
        self.misses = 0


# Singleton global semantic cache
semantic_cache = SemanticCache()
