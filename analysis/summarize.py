"""Generate a portable HTML histogram report, CSV and summary from simulation-results.json."""
from pathlib import Path
import json,csv,statistics,math,collections,html
base=Path(__file__).resolve().parent
r=json.loads((base/'simulation-results.json').read_text());rows=r['data'];done=[x for x in rows if x['over']]
def quantile(a,p):
 a=sorted(a);i=(len(a)-1)*p;lo=math.floor(i);hi=math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo)
def stats(key):
 a=[x[key] for x in done];sd=statistics.stdev(a)
 return dict(mean=statistics.mean(a),median=statistics.median(a),p05=quantile(a,.05),p25=quantile(a,.25),p75=quantile(a,.75),p95=quantile(a,.95),min=min(a),max=max(a),sd=sd,mean_ci95_halfwidth=1.96*sd/math.sqrt(len(a)))
s={'runs':len(rows),'finished':len(done),'censored':len(rows)-len(done),'turns':stats('turns'),'total':stats('total'),'causes':dict(collections.Counter(x['cause'] for x in rows)),'mean_exact_payments':statistics.mean(x['exactCount'] for x in rows),'mean_level_ups':statistics.mean(x['levelUps'] for x in rows)}
s['turn_bins']={f'{i}–{i+9}':sum(i<=x['turns']<i+10 for x in done) for i in range(0,max(x['turns'] for x in done)+1,10)}
s['total_bins']={f'{i:,}–{i+24999:,}':sum(i<=x['total']<i+25000 for x in done) for i in range(0,max(x['total'] for x in done)+1,25000)}
(base/'summary.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
with (base/'simulation-results.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
def chart(bins,title):
 peak=max(bins.values());parts=[]
 for i,(label,n) in enumerate(bins.items()):
  y=30+i*30; width=470*n/peak
  parts.append(f'<text x="142" y="{y+14}" text-anchor="end">{label}</text><rect x="153" y="{y}" width="{width:.2f}" height="20" rx="3" fill="#5a8750"/><text x="{160+width:.2f}" y="{y+14}">{n/len(rows):.1%}</text>')
 return f'<h2>{title}</h2><svg viewBox="0 0 720 {len(bins)*30+50}" role="img" aria-label="{title}">' + ''.join(parts)+'</svg>'
table='<table><tr><th>指標</th><th>ゲームオーバー時の購入数</th><th>買物総額</th></tr>'
for key,label in [('mean','平均'),('median','中央値'),('p05','5%点'),('p25','25%点'),('p75','75%点'),('p95','95%点'),('min','最小'),('max','最大')]:
 table+=f'<tr><td>{label}</td><td>{s["turns"][key]:,.1f}ターン</td><td>¥{s["total"][key]:,.0f}</td></tr>'
table+='</table>'
doc=f"""<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>小銭パズル シミュレーション</title>
<style>body{{font:16px/1.8 system-ui,sans-serif;color:#293c2b;background:#faf9f4;max-width:940px;margin:32px auto;padding:0 20px}}h1{{font-size:27px}}h2{{font-size:21px;margin-top:30px}}table{{border-collapse:collapse;width:100%}}td,th{{padding:8px;border-bottom:1px solid #cdd6c7;text-align:right}}td:first-child,th:first-child{{text-align:left}}svg{{width:100%;font:13px system-ui}}.note{{color:#5c6459}}code{{overflow-wrap:anywhere}}</style>
<h1>ピッタリ小銭パズル：終了ターン・買物総額の分布</h1>
<p>2026-09-08／{len(rows):,}回／初期上限30枚・初期小銭0枚・紙幣無制限・10PTで上限＋1枚・ピッタリで＋2枚。上限アップ時は摩耗なし。</p>
<p>支払い方針：手持ち小銭の支払い額ごとに最大枚数を使う組合せを探索し、生存可否、会計後の空き枚数、上限、残りPT、過払いの少なさの順に優先。将来の商品を先読みしない1会計単位の方針であり、人間の平均成績や理論上の最適値を表すものではありません。</p>
{table}
{chart(s['turn_bins'],'ゲームオーバーになるターン数（10ターン刻み）')}
{chart(s['total_bins'],'ゲームオーバー時の買物総額（25,000円刻み）')}
<p>終了 {s['finished']:,}回／1,000ターンでの打ち切り {s['censored']:,}回。終了理由：{html.escape(str(s['causes']))}。</p>
<p class="note">ゲームオーバーになった最後の購入もターン数・総額に含みます。ゲーム本体の価格生成・支払い処理を直接利用。乱数シードは20260908から連番。商品順は現行の6商品バッグと重複回避を再現していますが、ランダム比較関数によるsortはブラウザのエンジンにより挙動が変わり得ます。実行環境はmacOS JavaScriptCore。統計表は終了した試行を対象としています。</p>
<p><a href="simulation-results.csv">全試行CSV</a> · <a href="summary.json">集計JSON</a> · <a href="simulation-results.json">設定・乱数・ソースハッシュを含む実行結果</a></p></html>"""
(base/'simulation-report.html').write_text(doc)
print(json.dumps(s,ensure_ascii=False,indent=2))
