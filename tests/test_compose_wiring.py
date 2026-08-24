"""docker-compose must be able to reach the API from the browser.

Written for a real failure: `make app` brought up a healthy API on :8000 and a
dashboard on :3000 that could not talk to it. The client requests relative
`/api/*` paths -- correct, and what makes the same bundle work on Hugging Face
Spaces, where one uvicorn serves both -- but the frontend container ran `serve`,
a static-file server with no proxy, so every API request hit the bundle host.

`docker-compose.yml` set `VITE_API_URL` as a *runtime* environment variable on
the frontend container. Vite substitutes it at build time. It never had any
effect, and its presence made the wiring look intentional.

These are static wiring assertions, not a proof the stack runs. Running it
requires Docker.
"""

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "docker-compose.yml"
FRONTEND = ROOT / "brutalist-aesthetic-kkbox-churn-analysis-pro"
NGINX_CONF = FRONTEND / "nginx.conf"


@pytest.fixture(scope="module")
def compose():
    return yaml.safe_load(COMPOSE.read_text())


def test_frontend_does_not_set_vite_api_url_at_runtime(compose):
    """A build-time value set at runtime is a no-op that reads as configuration."""
    env = compose["services"]["frontend"].get("environment") or []
    names = [e.split("=")[0] for e in env] if isinstance(env, list) else list(env)
    assert "VITE_API_URL" not in names, (
        "VITE_API_URL is a Vite build-time substitution. Setting it in the "
        "compose runtime environment does nothing; the proxy in nginx.conf is "
        "what connects the dashboard to the API."
    )


def test_frontend_serves_through_a_proxy_capable_server():
    """`serve` cannot proxy. Whatever runs here must be able to."""
    dockerfile = (FRONTEND / "Dockerfile").read_text()
    assert "nginx" in dockerfile.lower(), (
        "The frontend production image must run a server that can reverse-proxy "
        "/api/ to the api container."
    )
    assert 'CMD ["serve"' not in dockerfile


def test_nginx_proxies_api_to_the_compose_service_name(compose):
    conf = NGINX_CONF.read_text()
    assert "location /api/" in conf
    api_port = str(compose["services"]["api"]["ports"][0]).split(":")[-1].strip('"')
    assert f"proxy_pass http://api:{api_port}" in conf, (
        f"nginx must proxy /api/ to the api service on port {api_port}"
    )


def test_nginx_listens_on_the_published_frontend_port(compose):
    published = str(compose["services"]["frontend"]["ports"][0])
    container_port = published.split(":")[-1].strip('"')
    assert f"listen {container_port};" in NGINX_CONF.read_text()


def test_single_page_app_fallback_is_present():
    """Without try_files, a deep link 404s instead of loading the bundle."""
    assert "try_files" in NGINX_CONF.read_text()
