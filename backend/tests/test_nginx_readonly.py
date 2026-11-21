from pathlib import Path
import shutil
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]
NGINX = ROOT / "deploy/nginx.runtime.conf"
DOCKERFILE = ROOT / "deploy/Dockerfile"
ENTRYPOINT = ROOT / "deploy/nginx-start.sh"
COMPOSE = ROOT / "compose.production.yaml"
REDEPLOY = ROOT / "scripts/redeploy_web.sh"


def test_nginx_writes_all_temporary_files_under_tmpfs():
    text = NGINX.read_text(encoding="utf-8")
    for name in ("client_body", "proxy", "fastcgi", "uwsgi", "scgi"):
        assert f"{name}_temp_path /tmp/nginx/{name};" in text
        assert f"/var/cache/nginx/{name}" not in text
    assert "pid /tmp/nginx.pid;" in text
    assert "include /etc/nginx/conf.d/*.conf;" in text


def test_entrypoint_creates_every_directory_without_writing_cache():
    script = ENTRYPOINT.read_text(encoding="utf-8")
    for name in ("client_body", "proxy", "fastcgi", "uwsgi", "scgi"):
        assert f"/tmp/nginx/{name}" in script
    assert "/var/cache/nginx" not in script
    assert 'exec "$@"' in script


def test_production_web_keeps_readonly_and_nonroot_security():
    compose = COMPOSE.read_text(encoding="utf-8")
    service = compose.split("\n  web:\n", 1)[1].split("\nnetworks:\n", 1)[0]
    assert 'user: "101:101"' in service
    assert "read_only: true" in service
    assert "cap_drop:\n      - ALL" in service
    assert "no-new-privileges:true" in service
    assert "cpus:" in service
    assert "mem_limit:" in service
    assert "pids_limit:" in service
    assert "/tmp:size=16m,mode=1777" in service
    assert "/var/cache/nginx" not in service
    assert "/var/run:size" not in service
    assert "ports:" not in service
    assert 'WEB_PORT: "18473"' in service


def test_image_loads_main_config_and_uses_custom_startup():
    text = DOCKERFILE.read_text(encoding="utf-8")
    assert "COPY deploy/nginx.runtime.conf /etc/nginx/nginx.conf" in text
    assert "COPY deploy/nginx-start.sh /usr/local/bin/nginx-start.sh" in text
    assert 'ENTRYPOINT ["/bin/sh", "/usr/local/bin/nginx-start.sh"]' in text


def test_web_only_redeploy_does_not_recreate_api():
    text = REDEPLOY.read_text(encoding="utf-8")
    assert "up -d --build --no-deps --force-recreate --wait web" in text
    assert "ps -q api" in text
    assert "scripts/smoke_production.py" in text
    assert ".RestartCount" in text


@pytest.mark.skipif(not shutil.which("bash"), reason="Bash is not installed")
@pytest.mark.parametrize("script", [ENTRYPOINT, REDEPLOY])
def test_shell_script_syntax(script):
    result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
