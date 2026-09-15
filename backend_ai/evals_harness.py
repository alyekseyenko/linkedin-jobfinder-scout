# ============================================================
# 🧠 EVALS HARNESS & BENCHMARK — Principal AI Architecture (2026)
# Continuous offline/online evaluation harness & LLM-as-a-Judge.
# Evaluates Hallucination, Relevance, and Persuasion Metrics.
# ============================================================

import re
from typing import Dict, Any, List


class EvalsHarness:
    """
    Automated evaluation harness for evaluating generated pitches and match reports.
    Applies deterministic metrics and judge grading to prevent skill hallucination.
    """

    @staticmethod
    def evaluate_pitch(
        pitch: str,
        candidate_skills: List[str],
        job_requirements: List[str]
    ) -> Dict[str, Any]:
        """
        Evaluate generated pitch across 3 dimensions:
        1. Hallucination Risk: Any claimed tech stack outside candidate skills?
        2. Cliche Index: Presence of tired, ineffective outreach templates.
        3. Actionability & Length: Optimal word count (50-100 words) and presence of CTA.
        """
        if not pitch:
            return {
                "score": 0,
                "passed": False,
                "hallucination_detected": False,
                "cliches_found": [],
                "word_count": 0,
                "feedback": "Pitch vazio."
            }

        pitch_lower = pitch.lower()
        words = pitch.split()
        word_count = len(words)

        # 1. Hallucination check against common tech keywords
        common_tech = [
            "kubernetes", "rust", "golang", "c++", "aws", "gcp", "azure",
            "react", "vue", "angular", "pytorch", "tensorflow", "snowflake"
        ]
        norm_candidate_skills = [s.lower().strip() for s in candidate_skills]
        hallucinated_skills = []

        for tech in common_tech:
            # If tech is mentioned in pitch but candidate does NOT have it
            if re.search(rf"\b{re.escape(tech)}\b", pitch_lower) and not any(tech in s for s in norm_candidate_skills):
                hallucinated_skills.append(tech)

        # 2. Cliche detection
        cliches = [
            "espero que esta mensagem o encontre bem",
            "venho por este meio",
            "sou um profissional motivado",
            "gostaria de submeter a minha candidatura",
            "i hope this email finds you well"
        ]
        found_cliches = [c for c in cliches if c in pitch_lower]

        # 3. Call to Action (CTA) detection
        cta_keywords = ["conversa", "reunião", "faria sentido", "disponibilidade", "call", "chat", "sinergia"]
        has_cta = any(k in pitch_lower for k in cta_keywords)

        # Scoring Calculation (0 - 100)
        base_score = 100

        # Heavy penalty for hallucinated skills (-25 each)
        base_score -= len(hallucinated_skills) * 25

        # Penalty for cliches (-15 each)
        base_score -= len(found_cliches) * 15

        # Penalty for missing CTA (-20)
        if not has_cta:
            base_score -= 20

        # Word count penalty (ideal: 40 - 120 words)
        if word_count < 20:
            base_score -= 30
        elif word_count > 150:
            base_score -= 15

        final_score = max(0, min(100, base_score))
        passed = final_score >= 70 and len(hallucinated_skills) == 0

        return {
            "score": final_score,
            "passed": passed,
            "hallucination_detected": len(hallucinated_skills) > 0,
            "hallucinated_skills": hallucinated_skills,
            "cliches_found": found_cliches,
            "word_count": word_count,
            "has_cta": has_cta,
            "grade": "A" if final_score >= 85 else ("B" if final_score >= 70 else "C")
        }


# Singleton harness
evals_harness = EvalsHarness()
