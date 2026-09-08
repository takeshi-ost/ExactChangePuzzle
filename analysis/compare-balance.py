"""Compare reward rule variants in isolated JS contexts without editing the game.
macOS: python3 analysis/compare-balance.py [runs=5000] [turn-limit=1000]
"""
from pathlib import Path
import ctypes as c, ctypes.util, json, sys, time, hashlib, csv, statistics, math
root=Path(__file__).resolve().parent.parent
# Reuse only the JavaScriptCore bridge; do not run or overwrite the previous simulation.
bridge=(root/'analysis/run-simulation.py').read_text().split("for f in ['wallet-config.js'")[0]
exec(compile(bridge,'javascriptcore-bridge','exec'))
def replace_once(s,old,new):
 assert s.count(old)==1,old
 return s.replace(old,new)
game=(root/'game.js').read_text();sim=(root/'analysis/simulate.js').read_text()
sim=replace_once(sim,'earned=exact?0:Math.max(0,dp[sum]-returned)','earned=exact&&!EXACT_PT?0:Math.max(0,dp[sum]-returned)')
sim=replace_once(sim,'const bonus=exact?state.rules.exactCapacityBonus:(state.currentEXP+earned>=state.nextLevelEXP?state.rules.levelCapacityBonus:0);','const levels=(!exact||EXACT_PT)&&state.currentEXP+earned>=state.nextLevelEXP;\n      const bonus=(exact?state.rules.exactCapacityBonus:0)+(levels?state.rules.levelCapacityBonus:0);')
sim=replace_once(sim,'const remaining=exact?state.currentEXP:(state.currentEXP+earned>=state.nextLevelEXP?0:state.currentEXP+earned);','const remaining=levels?0:state.currentEXP+earned;')
sim=replace_once(sim,'exactCount=0,levelUps=0;','exactCount=0,levelUps=0,firstGrowthTurn=null,earnedPT=0,wearCount=0,doubleRewards=0;')
sim=replace_once(sim,'exactCount+=Number(result.exact);levelUps+=result.levelUps;','exactCount+=Number(result.exact);levelUps+=result.levelUps;earnedPT+=result.earnedEXP;wearCount+=result.wear;doubleRewards+=Number(result.exact&&result.levelUps>0);\n      if(firstGrowthTurn===null&&result.upgraded)firstGrowthTurn=state.purchases.length;')
sim=replace_once(sim,'exactCount,levelUps,cause:', 'exactCount,levelUps,firstGrowthTurn,earnedPT,wearCount,doubleRewards,cause:')
runs=int(sys.argv[1]) if len(sys.argv)>1 else 5000
limit=int(sys.argv[2]) if len(sys.argv)>2 else 1000
variants=[('current',10,3,False),('five_pt',5,2,False),('exact_pt',10,3,True),('five_pt_one',5,1,False)]
all_results=[]
for name,threshold,bonus,exact in variants:
 saved=root/f'analysis/comparison/{name}.json'
 if saved.exists():
  cached=json.loads(saved.read_text())
  sources=['wallet-config.js','products.js','game.js','app.js','analysis/simulate.js']
  if (cached['runs']==runs and cached['maxTurns']==limit and cached['threshold']==threshold and cached['exact_pt']==exact and cached['config']['levelCapacityBonus']==bonus and all(cached['source_sha256'].get(f)==hashlib.sha256((root/f).read_bytes()).hexdigest() for f in sources)):
   all_results.append(cached);print('Reusing verified results',name,flush=True);continue
 ctx=j.JSGlobalContextCreate(None)
 run((root/'wallet-config.js').read_text());run((root/'products.js').read_text());run(f'WALLET_CONFIG.levelCapacityBonus={bonus};const EXACT_PT={str(exact).lower()};')
 source=replace_once(game,'const LEVEL_EXP = 5;',f'const LEVEL_EXP = {threshold};')
 if exact:
  source=replace_once(source,'const earnedEXP = exact ? 0 : Math.max(0, spentCoins - changeCount);','const earnedEXP = Math.max(0, spentCoins - changeCount);')
  source=replace_once(source,'if (!exact && currentEXP >= nextLevelEXP)','if (currentEXP >= nextLevelEXP)')
 run(source);run(sim)
 # Check exact payment with existing PT crossing the threshold and normal PT reward.
 run('''{
  const s=CoinGame.createGame();s.currentEXP=s.nextLevelEXP-1;s.wallet={500:0,100:2,50:0,10:0,5:0,1:0};
  CoinGame.add(s,100);CoinGame.add(s,100);const r=CoinGame.pay(s,{price:200});
  if(r.earnedEXP!==(EXACT_PT?2:0)||r.levelUps!==(EXACT_PT?1:0)||s.currentEXP!==(EXACT_PT?0:s.nextLevelEXP-1)||r.wear!==0)throw Error('Exact reward regression');
 }''')
 print('Running',name,runs,flush=True);start=time.monotonic()
 result=json.loads(run(f'JSON.stringify(simulate({runs},{limit}))'))
 result.update(variant=name,threshold=threshold,exact_pt=exact,elapsed_seconds=time.monotonic()-start)
 result['source_sha256']={f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['wallet-config.js','products.js','game.js','app.js','analysis/simulate.js','analysis/compare-balance.py']}
 for row in result['data']:
  assert row['capacity']==result['config']['maxCoinsCapacity']+2*row['exactCount']+bonus*row['levelUps']-row['wearCount']
  assert row['over']==(row['capacity']<=0 or row['coins']>row['capacity'])
 (root/f'analysis/comparison/{name}.json').write_text(json.dumps(result,ensure_ascii=False))
 all_results.append(result)
 print('Finished',name,round(result['elapsed_seconds'],1),'seconds',flush=True)
def quantile(a,p):
 a=sorted(a);i=(len(a)-1)*p;l=math.floor(i);h=math.ceil(i);return a[l]+(a[h]-a[l])*(i-l)
def stats(a):
 return {'mean':statistics.mean(a),'median':statistics.median(a),'p05':quantile(a,.05),'p25':quantile(a,.25),'p75':quantile(a,.75),'p95':quantile(a,.95),'min':min(a),'max':max(a),'mean_ci95_halfwidth':1.96*statistics.stdev(a)/math.sqrt(len(a))}
summary=[]
for r in all_results:
 d=r['data'];ended=[x for x in d if x['over']]
 s={'variant':r['variant'],'runs':runs,'censored':len(d)-len(ended),'turns':stats([x['turns'] for x in ended]),'total':stats([x['total'] for x in ended])}
 for key in ['exactCount','levelUps','earnedPT','wearCount','doubleRewards','capacity']:s['mean_'+key]=statistics.mean(x[key] for x in d)
 for bound in [10,20,30,40,60,100]:s['ended_by_'+str(bound)]=sum(x['over'] and x['turns']<=bound for x in d)/len(d)
 s['no_growth_rate']=sum(x['firstGrowthTurn'] is None for x in d)/len(d)
 s['mean_first_growth_turn']=statistics.mean(x['firstGrowthTurn'] for x in d if x['firstGrowthTurn'] is not None)
 s['zero_capacity_rate']=sum(x['cause']=='zero_capacity' for x in d)/len(d)
 summary.append(s)
(root/'analysis/comparison/summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
with (root/'analysis/comparison/results.csv').open('w') as f:
 fields=['variant']+list(all_results[0]['data'][0]);w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for r in all_results:
  for row in r['data']:w.writerow({'variant':r['variant'],**row})
print(json.dumps(summary,ensure_ascii=False,indent=2))
