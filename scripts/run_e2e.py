from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSES: list[subprocess.Popen] = []


def ready(url: str, process: subprocess.Popen, seconds: float = 45) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Processo encerrou antes da inicializacao: {url}")
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(.25)
    raise RuntimeError(f"Servico nao respondeu: {url}")


def main() -> int:
    env = os.environ.copy()
    api_command = [
        sys.executable, "-m", "uvicorn", "pivonauta.main:app",
        "--app-dir", str(ROOT / "backend/src"), "--host", "127.0.0.1",
        "--port", "8000",
    ]
    npm = "npm.cmd" if os.name == "nt" else "npm"
    frontend_command = [npm, "run", "dev", "--", "--host", "127.0.0.1"]
    try:
        api = subprocess.Popen(api_command, cwd=ROOT, env=env)
        PROCESSES.append(api)
        ready("http://127.0.0.1:8000/api/v1/health/ready", api)
        frontend = subprocess.Popen(frontend_command, cwd=ROOT, env=env)
        PROCESSES.append(frontend)
        ready("http://127.0.0.1:4173", frontend)
        result = subprocess.run(
            ["npx.cmd" if os.name == "nt" else "npx", "playwright", "test"],
            cwd=ROOT, env=env, check=False, timeout=420,
        )
        return result.returncode
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
        print(f"Falha na validacao E2E: {error}", file=sys.stderr)
        return 1
    finally:
        for process in reversed(PROCESSES):
            if process.poll() is None:
                process.terminate()
        for process in reversed(PROCESSES):
            if process.poll() is None:
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
