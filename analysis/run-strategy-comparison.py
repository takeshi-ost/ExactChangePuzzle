"""Run the smart and coin-preserving policies against identical seeded products."""
from pathlib import Path
import json,sys,time,hashlib
from datetime import datetime
root=Path(__file__).resolve().parent.parent
namespace={'__file__':str(root/'analysis/run-simulation.py')}
exec((root/'analysis/run-simulation.py').read_text().split("for f in ['wallet-config.js'")[0],namespace)
run=namespace['run']
files=['wallet-config.js','products.js','game.js','analysis/simulate.js']
for f in files:run((root/f).read_text())
hashes={f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in files+['app.js']}
runs=int(sys.argv[1]) if len(sys.argv)>1 else 10000
limit=int(sys.argv[2]) if len(sys.argv)>2 else 1000
started=time.monotonic();rows=[];metadata=None
for policy in ['smart','balanced']:
 for offset in range(0,runs,250):
  n=min(250,runs-offset)
  batch=json.loads(run(f'JSON.stringify(simulate({n},{limit},[{json.dumps(policy)}],{20260908+offset}))'))
  metadata=batch
  rows.extend(batch['data'])
  print(f'{policy}: {offset+n}/{runs}; elapsed {time.monotonic()-started:.1f}s',flush=True)
metadata.update(runs=runs,seed=20260908,data=rows,generated_at=datetime.now().astimezone().isoformat(),source_sha256=hashes,elapsed_seconds=time.monotonic()-started)
for f,digest in hashes.items():assert hashlib.sha256((root/f).read_bytes()).hexdigest()==digest,f
folder=root/'analysis/strategy-comparison';folder.mkdir(exist_ok=True)
(folder/'results.json').write_text(json.dumps(metadata,ensure_ascii=False))
