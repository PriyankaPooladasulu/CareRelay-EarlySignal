"""Launch using installed Python or Codex's bundled Python, with local dependencies."""
import os
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".runtime-deps"))
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
mode = sys.argv[1] if len(sys.argv) > 1 else "serve"
if mode == "serve":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
elif mode == "test":
    import pytest
    raise SystemExit(pytest.main(["tests", "-q"]))
elif mode == "evaluate":
    runpy.run_path(str(ROOT / "scripts" / "evaluate.py"), run_name="__main__")
elif mode in {"prepare_offline", "verify", "export"}:
    filename={"prepare_offline":"prepare_offline.py","verify":"verify_release.py","export":"export_demo.py"}[mode]
    runpy.run_path(str(ROOT / "scripts" / filename), run_name="__main__")
else:
    raise SystemExit("Choose serve, test, evaluate, export, verify or prepare_offline.")
