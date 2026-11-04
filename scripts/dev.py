#!/usr/bin/env python3
"""Start FastAPI and Vite together, with health check and cleanup.

Standard library orchestration; the mathematical solver still uses only Python.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
VENV = BACKEND / '.venv'
PYTHON = VENV / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
NPM = 'npm.cmd' if os.name == 'nt' else 'npm'
PROCESSES: list[subprocess.Popen] = []


def step(command: list[str], cwd: Path) -> None:
    print(f'> {" ".join(map(str, command))}', flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def ensure_installation() -> None:
    if not PYTHON.exists():
        step([sys.executable, '-m', 'venv', str(VENV)], ROOT)
    try:
        step([str(PYTHON), '-c', 'import fastapi, uvicorn, pivonauta'], ROOT)
    except subprocess.CalledProcessError:
        step([str(PYTHON), '-m', 'pip', 'install', '-e', '.'], BACKEND)
    if not (ROOT / 'node_modules').is_dir():
        step([NPM, 'ci'], ROOT)


def wait_for_api(process: subprocess.Popen, seconds: float = 30) -> None:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if process.poll() is not None:
            raise RuntimeError('API encerrou antes de ficar pronta. Verifique a saída acima.')
        try:
            with urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/ready', timeout=1) as response:
                if response.status == 200:
                    print('API pronta: http://127.0.0.1:8000/docs', flush=True)
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(.3)
    raise RuntimeError('API não respondeu em 30s. Porta 8000 pode estar ocupada.')


def cleanup() -> None:
    for process in reversed(PROCESSES):
        if process.poll() is None:
            process.terminate()
    for process in reversed(PROCESSES):
        if process.poll() is not None:
            continue
        try:
            process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main() -> int:
    try:
        ensure_installation()
        api = subprocess.Popen([str(PYTHON), '-m', 'uvicorn', 'pivonauta.main:app', '--host', '127.0.0.1', '--port', '8000'], cwd=BACKEND)
        PROCESSES.append(api)
        wait_for_api(api)
        frontend = subprocess.Popen([NPM, 'run', 'dev'], cwd=ROOT)
        PROCESSES.append(frontend)
        print('PivôNauta: http://localhost:4173 (Ctrl+C encerra ambos)', flush=True)
        while all(p.poll() is None for p in PROCESSES):
            time.sleep(.3)
        return 1
    except KeyboardInterrupt:
        print('\nEncerrando os serviços…', flush=True)
        return 0
    except (subprocess.CalledProcessError, RuntimeError, OSError) as exc:
        print(f'Erro de inicialização: {exc}', file=sys.stderr)
        return 1
    finally:
        cleanup()


if __name__ == '__main__':
    raise SystemExit(main())
