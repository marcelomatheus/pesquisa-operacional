from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = ROOT / "compose.production.yaml"
ENVIRONMENT = ROOT / ".env.production.example"
NGINX = ROOT / "deploy" / "nginx.production.conf"
MANUAL_DEPLOY = ROOT / "scripts" / "deploy_manual.sh"


def test_manual_deployment_uses_isolated_services_without_host_ports():
    compose = PRODUCTION.read_text(encoding="utf-8")
    nginx = NGINX.read_text(encoding="utf-8")
    assert "name: pivonauta-prod" in compose
    assert "ports:" not in compose
    assert "container_name:" not in compose
    assert "internal: true" in compose
    assert "external: true" in compose
    assert "celo-network" in compose
    assert 'traefik.enable: "true"' in compose
    assert 'traefik.http.services.pivonauta.loadbalancer.server.port: "18473"' in compose
    assert 'listen 18473;' in nginx
    assert 'proxy_pass http://api:19483;' in nginx
    assert '"--port", "19483"' in compose
    assert "docker compose" in MANUAL_DEPLOY.read_text(encoding="utf-8")
    assert "dockerhub" not in compose.lower()
    assert "image:" not in compose


def test_example_configuration_matches_shared_traefik_stack():
    text = ENVIRONMENT.read_text(encoding="utf-8")
    assert "DOMAIN_NAME=pivonauta.example.com" in text
    assert "PROXY_NETWORK=celo-network" in text
    assert "TRAEFIK_ENTRYPOINT=web" in text
    assert "CLOUDFLARE_TUNNEL_TOKEN" not in text


@pytest.mark.skipif(shutil.which("bash") is None, reason="Bash not available")
def test_manual_deployment_shell_syntax():
    result = subprocess.run(
        ["bash", "-n", str(MANUAL_DEPLOY)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def docker_compose_available():
    if not shutil.which("docker"):
        return False
    result = subprocess.run(
        ["docker", "compose", "version"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0


@pytest.mark.skipif(not docker_compose_available(), reason="Docker Compose v2 not installed")
def test_production_compose_is_valid_and_does_not_bind_host_ports():
    result = subprocess.run(
        [
            "docker", "compose",
            "--env-file", str(ENVIRONMENT),
            "-f", str(PRODUCTION),
            "config", "--format", "json",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["name"] == "pivonauta-prod"
    assert data["networks"]["proxy"]["name"] == "celo-network"
    assert data["networks"]["proxy"]["external"] is True
    assert data["networks"]["backend"]["internal"] is True
    api = data["services"]["api"]
    web = data["services"]["web"]
    assert "ports" not in api
    assert "ports" not in web
    assert "proxy" not in api["networks"]
    assert set(web["networks"]) == {"backend", "proxy"}
    assert api["command"][-1] == "19483"
    assert "19483" in [str(port) for port in api["expose"]]
    assert "18473" in [str(port) for port in web["expose"]]
    assert web["labels"]["traefik.http.services.pivonauta.loadbalancer.server.port"] == "18473"
    assert web["labels"]["traefik.http.routers.pivonauta.rule"] == "Host(`pivonauta.example.com`)"
    assert web["labels"]["traefik.http.routers.pivonauta.entrypoints"] == "web"
