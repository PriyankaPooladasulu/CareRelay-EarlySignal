"""Verify the frozen source snapshot with the Python standard library only."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]

def verify():
    manifest=json.loads((ROOT/"release/manifest.json").read_text(encoding="utf-8"))
    failed=[]
    for name,expected in manifest["files"].items():
        path=ROOT/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
            failed.append(name)
    if failed:
        print("Changed or missing frozen files:")
        for name in failed: print(name)
        return 1
    print(f"Verified {len(manifest['files'])} frozen files for B {manifest['release']}.")
    print("Checksums detect changes; they are not a publisher signature or deployment certification.")
    return 0

if __name__=="__main__":
    raise SystemExit(verify())
