"""Download the pinned wheels for this exact Python/OS while online."""
from pathlib import Path
import hashlib,json,platform,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
target=ROOT/"wheelhouse"
target.mkdir(exist_ok=True)
subprocess.run([sys.executable,"-m","pip","download","--only-binary=:all:","--dest",str(target),
                "-r",str(ROOT/"requirements.lock.txt")],check=True)
meta={"python":f"{sys.version_info.major}.{sys.version_info.minor}","platform":sys.platform,
      "machine":platform.machine(),"requirements_sha256":hashlib.sha256((ROOT/"requirements.lock.txt").read_bytes()).hexdigest(),
      "files":{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(target.glob("*.whl"))}}
(target/"manifest.json").write_text(json.dumps(meta,indent=2),encoding="utf-8")
print("Offline wheels ready for",meta["platform"],meta["machine"],"Python",meta["python"])
print("Test START_OFFLINE.cmd on the actual demo laptop before going offline.")
