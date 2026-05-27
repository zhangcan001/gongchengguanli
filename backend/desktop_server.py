import logging
import os
import sys
from pathlib import Path

import uvicorn


def _default_data_dir() -> Path:
    configured = os.getenv("SMART_SUPERVISION_DATA_DIR")
    if configured:
        return Path(configured)
    app_data = os.getenv("APPDATA")
    if app_data:
        return Path(app_data) / "SmartSupervisionWorkbench" / "data"
    return Path.home() / "SmartSupervisionWorkbench" / "data"


def _configure_logging(data_dir: Path) -> None:
    log_dir = data_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=log_dir / "desktop-backend.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def main() -> int:
    data_dir = _default_data_dir()
    os.environ["SMART_SUPERVISION_DATA_DIR"] = str(data_dir)
    _configure_logging(data_dir)

    host = os.getenv("SMART_SUPERVISION_HOST", "127.0.0.1")
    port = int(os.getenv("SMART_SUPERVISION_PORT", "8765"))
    try:
        from app.main import app as fastapi_app

        logging.info("Desktop backend starting on %s:%s", host, port)
        uvicorn.run(fastapi_app, host=host, port=port, log_level="info", access_log=False, log_config=None)
    except Exception:
        logging.exception("Desktop backend failed to start.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
