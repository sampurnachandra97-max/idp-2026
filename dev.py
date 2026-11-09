#!/usr/bin/env python3
"""Set up and run Soil Intelligence with one command: python dev.py

Creates the Python environment, installs dependencies and trains the models the
first time. It then runs the API and website, and restarts the API if it crashes.
Press Ctrl+C to stop. Only the standard library is used, so it runs before setup.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
WINDOWS = sys.platform == "win32"
VENV_PYTHON = BACKEND / ".venv" / ("Scripts/python.exe" if WINDOWS else "bin/python")
API_URL = "http://127.0.0.1:8000/api/health"
WEB_URL = "http://localhost:3000"
STARTUP_SECONDS = 90
MAX_RAPID_RESTARTS = 5
STABLE_AFTER_SECONDS = 30


def log(message: str) -> None:
    print(f"[soil-intelligence] {message}", flush=True)


def step(message: str, command: list[str], cwd: Path) -> None:
    log(message)
    subprocess.run(command, cwd=cwd, check=True)


def answers(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return response.status < 500
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return False


def wait_for(url: str, process: subprocess.Popen) -> bool:
    deadline = time.monotonic() + STARTUP_SECONDS
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        if answers(url):
            return True
        time.sleep(0.5)
    return False


def set_up() -> None:
    if not VENV_PYTHON.exists():
        step("Creating the Python environment", [sys.executable, "-m", "venv", ".venv"], BACKEND)
        step(
            "Installing backend dependencies",
            [str(VENV_PYTHON), "-m", "pip", "install", "-q", "-r", "requirements.txt"],
            BACKEND,
        )
    if not (BACKEND / "artifacts" / "models.joblib").exists():
        step("Training the models", [str(VENV_PYTHON), "-m", "ml.train"], BACKEND)
    if not (FRONTEND / "node_modules").exists():
        step("Installing website dependencies", [npm(), "install", "--no-fund", "--no-audit"], FRONTEND)


def npm() -> str:
    path = shutil.which("npm")
    if path is None:
        sys.exit("Node.js was not found. Install Node.js 22 or newer, then run this again.")
    return path


def start_api() -> subprocess.Popen:
    return subprocess.Popen(
        [str(VENV_PYTHON), "-m", "uvicorn", "app.main:app", "--port", "8000"], cwd=BACKEND
    )


def stop(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    if WINDOWS:
        # npm starts child processes, so the whole tree has to be stopped.
        subprocess.run(
            ["taskkill", "/T", "/F", "/PID", str(process.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        process.terminate()


def supervise(api: subprocess.Popen | None, web: subprocess.Popen | None) -> None:
    started = time.monotonic()
    rapid_restarts = 0
    while True:
        time.sleep(1)
        if web is not None and web.poll() is not None:
            log("The website stopped, so everything is shutting down.")
            return
        if api is None or api.poll() is None:
            continue

        rapid_restarts = 0 if time.monotonic() - started > STABLE_AFTER_SECONDS else rapid_restarts + 1
        if rapid_restarts > MAX_RAPID_RESTARTS:
            log("The API keeps crashing. Check the error above, then run this again.")
            return
        log("The API stopped unexpectedly. Restarting it.")
        api = start_api()
        started = time.monotonic()


def main() -> None:
    set_up()
    api = web = None
    try:
        if answers(API_URL):
            log("The API is already running on port 8000.")
        else:
            log("Starting the API on port 8000")
            api = start_api()
            if not wait_for(API_URL, api):
                sys.exit("The API did not start. Check the error above. Is port 8000 in use?")

        if answers(WEB_URL):
            log("The website is already running on port 3000.")
        else:
            log("Starting the website on port 3000")
            web = subprocess.Popen([npm(), "run", "dev"], cwd=FRONTEND)
            if not wait_for(WEB_URL, web):
                sys.exit("The website did not start. Check the error above. Is port 3000 in use?")

        log(f"Ready: open {WEB_URL}")
        if api is None and web is None:
            log("Nothing else to start.")
            return
        log("Press Ctrl+C to stop.")
        supervise(api, web)
    except KeyboardInterrupt:
        log("Stopping.")
    finally:
        stop(api)
        stop(web)


if __name__ == "__main__":
    main()
