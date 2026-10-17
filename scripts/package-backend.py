"""Package only backend/shared runtime code; print reproducible source identity, never secrets."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/package-backend.py /path/to/backend.zip')
output = Path(sys.argv[1]).resolve()
files = {}
for directory in ('backend', 'js/core'):
    for source in (ROOT / directory).rglob('*'):
        if source.is_file() and source.suffix in ('.js', '.mjs', '.json'):
            files[str(source.relative_to(ROOT))] = source.read_bytes()
files['index.mjs'] = b"export { default } from './backend/index.mjs';\n"
files['package.json'] = json.dumps({'type': 'module', 'main': 'index.mjs'}).encode()
identity = hashlib.sha256()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, content in sorted(files.items()):
        # Canonical tree identity is independent of ZIP metadata/compression.
        identity.update(name.encode() + b'\0' + content + b'\0')
        entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(entry, content)
print(json.dumps({'path': str(output), 'bytes': output.stat().st_size,
                  'source_tree_sha256': identity.hexdigest(),
                  'zip_sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))
