import os
from threading import Lock

from groq import BadRequestError, RateLimitError

_KEY_ENV_VARS = (
    "GROQ_API_KEY",
    "GROQ_API_KEY1",
    "GROQ_API_KEY2",
)

# llama-3.3-70b-versatile occasionally emits a malformed tool call (e.g.
# literal "<function=...>" text instead of a structured tool_calls
# response), which Groq rejects as a 400 tool_use_failed error. This is a
# transient generation glitch, not a bad key or a bad prompt, and retrying
# the exact same call with the exact same key usually succeeds on the next
# sample — a different key wouldn't fix it, since it's the same model and
# prompt either way.
_TOOL_USE_FAILED_RETRIES_PER_KEY = 2

_fallback_index = 0
_key_lock = Lock()


def _is_tool_use_failed(error: BadRequestError) -> bool:
    body = error.body
    if isinstance(body, dict):
        return body.get("error", {}).get("code") == "tool_use_failed"
    return False


def _configured_keys() -> list[str]:
    keys = []
    for env_var in _KEY_ENV_VARS:
        value = os.getenv(env_var)
        if value:
            keys.append(value)
    return keys


def get_groq_api_key() -> str:
    keys = _configured_keys()
    if not keys:
        raise KeyError("GROQ_API_KEY")

    # The primary key is always preferred for model construction. Fallback
    # rotation is handled separately when we are actively retrying a call.
    return keys[0]


def invoke_with_groq_fallback(operation):
    keys = _configured_keys()
    if not keys:
        raise KeyError("GROQ_API_KEY")

    primary_key, fallback_keys = keys[0], keys[1:]

    global _fallback_index
    with _key_lock:
        if fallback_keys:
            start_index = _fallback_index % len(fallback_keys)
            rotated_fallbacks = fallback_keys[start_index:] + fallback_keys[:start_index]
            _fallback_index = (start_index + 1) % len(fallback_keys)
        else:
            rotated_fallbacks = []

    order = [primary_key, *rotated_fallbacks]

    last_error = None
    for key in order:
        for attempt in range(_TOOL_USE_FAILED_RETRIES_PER_KEY + 1):
            try:
                return operation(key)
            except RateLimitError as error:
                last_error = error
                break  # a different key might not be rate-limited; move on immediately
            except BadRequestError as error:
                last_error = error
                if _is_tool_use_failed(error) and attempt < _TOOL_USE_FAILED_RETRIES_PER_KEY:
                    continue  # same key, same model: just try sampling again
                break  # a real bad request, or retries exhausted — move to the next key

    raise last_error if last_error is not None else RuntimeError("Groq request failed")
