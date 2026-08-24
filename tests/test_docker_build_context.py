"""Every path the Space Dockerfile copies must survive .dockerignore.

Written for a real failure: the Dockerfile gained `COPY eval/serving_split.json`
and `COPY models/isotonic_calibrator.json`, but .dockerignore still excluded
`eval/*` and `models/*` with an allowlist that named neither. `docker build`
fails on a COPY whose source is excluded, so the Hugging Face Space went to
BUILD_ERROR on deploy -- after a green suite and a 28-assertion browser drive,
both of which run uvicorn directly and never build the image.
"""

import fnmatch
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DOCKERFILE = ROOT / "Dockerfile"
DOCKERIGNORE = ROOT / ".dockerignore"


def _patterns() -> list[str]:
    lines = DOCKERIGNORE.read_text().splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def _match(path: str, pattern: str) -> bool:
    """Docker's .dockerignore semantics, narrowly.

    `*` does not cross a path separator, and a pattern that matches a directory
    also matches everything beneath it.
    """
    p_parts = pattern.strip("/").split("/")
    f_parts = path.strip("/").split("/")
    if len(f_parts) < len(p_parts):
        return False
    for pp, fp in zip(p_parts, f_parts):
        if pp == "**":
            return True
        if not fnmatch.fnmatchcase(fp, pp):
            return False
    return True


def is_excluded(path: str, patterns: list[str]) -> bool:
    """Last matching pattern wins; a leading `!` un-excludes."""
    excluded = False
    for pattern in patterns:
        negated = pattern.startswith("!")
        bare = pattern[1:] if negated else pattern
        if _match(path, bare):
            excluded = not negated
    return excluded


def copy_sources() -> list[str]:
    """Local COPY sources in the root Dockerfile, ignoring `--from=` stage copies."""
    sources: list[str] = []
    for raw in DOCKERFILE.read_text().splitlines():
        line = raw.strip()
        if not line.upper().startswith("COPY "):
            continue
        tokens = line.split()[1:]
        if any(t.startswith("--from=") for t in tokens):
            continue
        tokens = [t for t in tokens if not t.startswith("--")]
        sources.extend(tokens[:-1])  # last token is the destination
    return sources


def test_dockerfile_has_copy_sources():
    """Guard the guard: a parser that finds nothing would pass vacuously."""
    assert len(copy_sources()) >= 8, copy_sources()


@pytest.mark.parametrize("source", copy_sources())
def test_copy_source_survives_dockerignore(source):
    patterns = _patterns()
    if any(ch in source for ch in "*?"):
        pytest.skip(f"glob source, not a single path: {source}")
    assert (ROOT / source).exists(), f"{source} is COPYed but not committed"
    assert not is_excluded(source, patterns), (
        f".dockerignore excludes {source}, which the Dockerfile COPYs. "
        f"docker build fails on this; add `!{source}` after the pattern that "
        f"excludes it."
    )
