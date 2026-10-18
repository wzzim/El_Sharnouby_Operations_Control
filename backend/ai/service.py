import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from .context import BusinessContextBuilder
from .prompts import SYSTEM_PROMPT


OLLAMA_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:3b"


class AIService:
    def __init__(self, engine, analytics, board_provider):
        self.context_builder = BusinessContextBuilder(
            engine=engine,
            analytics=analytics,
            board_provider=board_provider,
        )

    def status(self) -> Dict[str, Any]:
        try:
            request = urllib.request.Request(
                f"{OLLAMA_URL}/api/tags",
                method="GET",
            )

            with urllib.request.urlopen(request, timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))

            models = [
                model.get("name")
                for model in payload.get("models", [])
            ]

            return {
                "online": True,
                "provider": "Ollama",
                "model": OLLAMA_MODEL,
                "model_available": OLLAMA_MODEL in models,
                "privacy": "local",
                "can_modify_decisions": False,
            }

        except Exception as exc:
            return {
                "online": False,
                "provider": "Ollama",
                "model": OLLAMA_MODEL,
                "model_available": False,
                "privacy": "local",
                "can_modify_decisions": False,
                "error": str(exc),
            }

    @staticmethod
    def _history_text(
        history: Optional[List[Dict[str, str]]],
        limit: int = 6,
    ) -> str:
        if not history:
            return ""

        lines: List[str] = []

        for item in history[-limit:]:
            if not isinstance(item, dict):
                continue

            role = str(item.get("role", "")).strip().lower()
            content = str(item.get("content", "")).strip()

            if role not in {"user", "assistant"} or not content:
                continue

            # Prevent giant previous responses from bloating local inference.
            content = content[:900]

            label = "User" if role == "user" else "Analyst"
            lines.append(f"{label}: {content}")

        return "\n".join(lines)

    def _generate(
        self,
        system_prompt: str,
        user_prompt: str,
        sources: List[str],
        num_predict: int = 320,
    ) -> Dict[str, Any]:
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            "options": {
                "temperature": 0.1,
                "num_ctx": 4096,
                "num_predict": num_predict,
            },
            "keep_alive": "15m",
        }

        request = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=300,
            ) as response:
                result = json.loads(
                    response.read().decode("utf-8")
                )

        except (
            urllib.error.URLError,
            TimeoutError,
        ) as exc:
            raise RuntimeError(
                f"Local AI request failed: {exc}"
            ) from exc

        answer = (
            result
            .get("message", {})
            .get("content", "")
            .strip()
        )

        if not answer:
            raise RuntimeError(
                "The local AI model returned an empty response."
            )

        return {
            "answer": answer,
            "model": OLLAMA_MODEL,
            "provider": "Ollama",
            "privacy": "local",
            "sources": sources,
            "can_modify_decisions": False,
        }

    def chat(
        self,
        question: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        history_text = self._history_text(history)

        context_text, sources = (
            self.context_builder.as_prompt_text(
                question=question,
                mode="chat",
                previous_context=history_text,
            )
        )

        system_prompt = f"""
{SYSTEM_PROMPT}

ADDITIONAL CHAT RULES:
- The user may ask ANY natural-language business question.
- Suggested questions in the UI are examples only.
- Answer follow-up questions using recent conversation context when useful.
- Recent conversation helps resolve references, but it is not an authoritative
  source of business numbers.
- Company-specific claims must be supported by the verified fact sheet.
- If verified evidence is unavailable, say so plainly.
- Do not pretend that unavailable data exists.
- Do not modify decisions.
""".strip()

        return self._generate(
            system_prompt=system_prompt,
            user_prompt=context_text,
            sources=sources,
            num_predict=320,
        )

    def root_cause(
        self,
        problem: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        history_text = self._history_text(history)

        investigation_question = (
            "Investigate the following business problem. "
            "Identify likely drivers only when supported by verified evidence. "
            f"Problem: {problem}"
        )

        context_text, sources = (
            self.context_builder.as_prompt_text(
                question=investigation_question,
                mode="investigate",
                previous_context=history_text,
            )
        )

        prompt = """
You are the Root Cause Investigator inside El-Sharnouby Operations Control.

Use ONLY the supplied verified business facts for company-specific claims.

IMPORTANT:
- Focus on the problem the user actually named.
- Prefer evidence directly related to that problem.
- Do not call an unrelated large EGP value the root cause.
- Do not invent causality.
- Correlation does not prove causation.
- Never compare a metric with an industry standard, benchmark, target,
  normal range, or best practice unless the verified context explicitly
  provides that benchmark.
- Do not label stock turns, delivery performance, margin, ROAS, quality,
  or another metric as good/bad/high/low without a supplied comparison.
- Use "likely driver", "associated risk", or "requires validation" when
  causality is not established.
- If evidence is insufficient, explicitly say so.
- Never modify decisions.

Use this format:

**ROOT CAUSE SUMMARY**
Concise evidence-grounded conclusion.

**LIKELY DRIVERS**
Up to three directly relevant drivers.

**EVIDENCE**
Exact verified observations or metrics.

**RECOMMENDED CHECK**
What management should validate next.

**CONFIDENCE**
High, Medium, or Low, based on evidence coverage.
""".strip()

        return self._generate(
            system_prompt=prompt,
            user_prompt=context_text,
            sources=sources,
            num_predict=380,
        )

    def action_advisor(
        self,
        focus: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        history_text = self._history_text(history)

        question = (
            f"{focus}. Compare existing management decisions only. "
            "Use their priority, estimated impact, confidence, evidence, "
            "owner, status, assumptions, and time window."
        )

        context_text, sources = (
            self.context_builder.as_prompt_text(
                question=question,
                mode="decision",
                previous_context=history_text,
            )
        )

        prompt = """
You are the Action Advisor inside El-Sharnouby Operations Control.

Use ONLY existing decision cards and supplied verified business facts.

You are read-only.
You do NOT approve, defer, start, execute, or create decisions.

IMPORTANT:
- Never invent an action.
- Never invent impact, confidence, owner, status, evidence, or time window.
- Estimated impact is an estimate, not guaranteed savings.
- A larger estimated impact does not automatically mean an action is safer.
- Do not claim an action has already been executed unless its supplied status
  explicitly says so.
- Explain assumptions or limitations when they matter.

Use this format:

**PRIORITY RECOMMENDATION**
Existing action that deserves attention first.

**WHY**
Evidence, urgency, estimated impact, confidence, status, and owner.

**TRADE-OFFS**
Limitations, assumptions, or competing priorities.

**NEXT STEP**
One practical human-controlled next step for the supplied owner.

**ALTERNATIVE**
Next-best existing action when supported by evidence.
""".strip()

        return self._generate(
            system_prompt=prompt,
            user_prompt=context_text,
            sources=sources,
            num_predict=380,
        )