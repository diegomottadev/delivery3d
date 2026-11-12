"""Límite de intentos fallidos de login (en memoria, por proceso).

Clave: IP + username normalizado. Tras MAX_FAILURES fallos dentro de WINDOW_SECONDS
se bloquea esa clave hasta que expire la ventana. Un login exitoso resetea la clave.
Para varios workers/procesos en producción, reemplazar por un backend compartido (Redis).
"""

import threading
import time

MAX_FAILURES = 5
WINDOW_SECONDS = 15 * 60


class LoginRateLimiter:
    def __init__(self, max_failures: int = MAX_FAILURES, window_seconds: int = WINDOW_SECONDS, clock=time.monotonic):
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def key(ip: str | None, username: str | None) -> str:
        return f"{ip or '-'}|{str(username or '').strip().lower()}"

    def _recent(self, key: str, now: float) -> list[float]:
        attempts = [t for t in self._failures.get(key, []) if now - t < self.window_seconds]
        if attempts:
            self._failures[key] = attempts
        else:
            self._failures.pop(key, None)
        return attempts

    def retry_after(self, key: str) -> int:
        """Segundos hasta poder reintentar; 0 si no está bloqueado."""
        with self._lock:
            now = self._clock()
            attempts = self._recent(key, now)
            if len(attempts) < self.max_failures:
                return 0
            return max(1, int(self.window_seconds - (now - attempts[0])) + 1)

    def register_failure(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            self._recent(key, now)
            self._failures.setdefault(key, []).append(now)

    def register_success(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()
