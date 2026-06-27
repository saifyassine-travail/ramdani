"""Resolve dataset locations from configs/paths.yaml (env vars override)."""
import os
from pathlib import Path

import yaml

_PATHS_YAML = Path(__file__).resolve().parent.parent / "configs" / "paths.yaml"


def _load_yaml() -> dict:
    if not _PATHS_YAML.exists():
        return {}
    with open(_PATHS_YAML) as f:
        return yaml.safe_load(f) or {}


def get_path(key: str, must_exist: bool = True) -> Path:
    """Return the absolute path for a dataset key (e.g. "KITS23").

    Precedence: environment variable of the same name > configs/paths.yaml.
    Raises a clear error if unset or still a placeholder.
    """
    value = os.environ.get(key) or _load_yaml().get(key)
    if not value or "CHANGE_ME" in str(value):
        raise FileNotFoundError(
            f"Dataset path for '{key}' is not configured.\n"
            f"  -> Edit {_PATHS_YAML} and set {key} to the real path,\n"
            f"     or run:  export {key}=/mnt/d/your/path"
        )
    p = Path(value).expanduser()
    if must_exist and not p.exists():
        raise FileNotFoundError(f"'{key}' points to '{p}', which does not exist.")
    return p
