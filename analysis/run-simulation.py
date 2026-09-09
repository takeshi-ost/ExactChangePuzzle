"""macOS: python3 analysis/run-simulation.py [runs per policy] [turn limit]. Uses system JavaScriptCore."""
import ctypes as c, ctypes.util, json, sys, time, hashlib
from pathlib import Path
from datetime import datetime
root=Path(__file__).resolve().parent.parent
j=c.CDLL(ctypes.util.find_library('JavaScriptCore')); P=c.c_void_p
for name,args,ret in [('JSGlobalContextCreate',[P],P),('JSStringCreateWithUTF8CString',[c.c_char_p],P),('JSEvaluateScript',[P,P,P,P,c.c_int,c.POINTER(P)],P),('JSValueToStringCopy',[P,P,c.POINTER(P)],P),('JSStringGetMaximumUTF8CStringSize',[P],c.c_size_t),('JSStringGetUTF8CString',[P,P,c.c_size_t],c.c_size_t),('JSStringRelease',[P],None)]:
 f=getattr(j,name);f.argtypes=args;f.restype=ret
ctx=j.JSGlobalContextCreate(None)
def run(s):
 e=P();source=j.JSStringCreateWithUTF8CString(s.encode());r=j.JSEvaluateScript(ctx,source,None,None,1,c.byref(e));j.JSStringRelease(source)
 v=j.JSValueToStringCopy(ctx,e if e.value else r,None);n=j.JSStringGetMaximumUTF8CStringSize(v);b=c.create_string_buffer(n);j.JSStringGetUTF8CString(v,b,n);j.JSStringRelease(v)
 if e.value: raise Exception(b.value.decode())
 return b.value.decode()
for f in ['wallet-config.js','products.js','game.js','analysis/simulate.js']:run((root/f).read_text())
runs=int(sys.argv[1]) if len(sys.argv)>1 else 2000
limit=int(sys.argv[2]) if len(sys.argv)>2 else 1000
t=time.monotonic();result=json.loads(run(f'JSON.stringify(simulate({runs},{limit}))'))
result['elapsed_seconds']=time.monotonic()-t
result['generated_at']=datetime.now().astimezone().isoformat()
result['source_sha256']={f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['wallet-config.js','products.js','game.js','app.js','analysis/simulate.js']}
(root/'analysis/simulation-results.json').write_text(json.dumps(result,ensure_ascii=False))
print(json.dumps({k:v for k,v in result.items() if k!='data'},ensure_ascii=False,indent=2))
