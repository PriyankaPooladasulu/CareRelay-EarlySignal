from pathlib import Path
import hashlib,json,platform,sys
ROOT=Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/"wheelhouse/manifest.json").read_text(encoding="utf-8"))
if (meta["python"],meta["platform"],meta["machine"]) != (f"{sys.version_info.major}.{sys.version_info.minor}",sys.platform,platform.machine()):
    raise SystemExit("Wheel bundle targets a different Python/OS. Rebuild with PREPARE_OFFLINE.cmd on this machine while online.")
if meta["requirements_sha256"]!=hashlib.sha256((ROOT/"requirements.lock.txt").read_bytes()).hexdigest():
    raise SystemExit("Pinned requirements differ from the offline wheel manifest.")
for name,digest in meta["files"].items():
    path=ROOT/"wheelhouse"/name
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
        raise SystemExit("Missing or changed wheel: "+name)
print("Offline wheel hashes and target verified.")
