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
s.update({key:r[key] for key in ['generated_at','config','maxTurns','seed','productCount','levelEXP','pointCarryover','source_sha256']})
s['turn_bins']={f'{i}–{i+4}':sum(i<=x['turns']<i+5 for x in done) for i in range(0,max(x['turns'] for x in done)+1,5)}
s['total_bins']={f'{i:,}–{i+9999:,}':sum(i<=x['total']<i+10000 for x in done) for i in range(0,max(x['total'] for x in done)+1,10000)}
empty_counts=[x['emptyWalletCount'] for x in rows]
s['empty_wallet']={
 'total':sum(empty_counts), 'mean':statistics.mean(empty_counts),
 'median':statistics.median(empty_counts), 'max':max(empty_counts),
 'runs_with_empty_wallet':sum(n>0 for n in empty_counts),
 'run_rate':sum(n>0 for n in empty_counts)/len(rows),
 'checkout_rate':sum(empty_counts)/sum(x['turns'] for x in rows),
 'bins':{str(i):empty_counts.count(i) for i in range(max(empty_counts)+1)},
 'definition':'会計確定後に小銭0枚だった会計数。開始時・投入途中は除外。連続0枚も各会計を数え、終了会計・打ち切り試行も含む。'
}
(base/'summary.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
with (base/'simulation-results.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys(),lineterminator='\n');w.writeheader();w.writerows(rows)
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
<p><a href="strategy-comparison/report.html">最新：硬貨保持戦略との比較レポート（50枚で上限突破リセット）</a></p>
<p>{html.escape(r["generated_at"])}／{len(rows):,}回／初期上限{r["config"]["maxCoinsCapacity"]}枚・初期小銭{sum(r["config"]["coins"].values())}枚・紙幣無制限・{r["levelEXP"]}PTで上限＋{r["config"]["levelCapacityBonus"]}枚・ピッタリで＋{r["config"]["exactCapacityBonus"]}枚。余剰PTは繰り越し、同一会計で複数回レベルアップ。上限アップ時は摩耗なし。</p>
<p>支払い方針：手持ち小銭の支払い額ごとに最大枚数を使う組合せを探索し、生存可否、会計後の空き枚数、上限、残りPT、過払いの少なさの順に優先。将来の商品を先読みしない1会計単位の方針であり、人間の平均成績や理論上の最適値を表すものではありません。</p>
{table}
<p>1試行あたり平均ピッタリ支払い {s["mean_exact_payments"]:.2f}回／平均レベルアップ {s["mean_level_ups"]:.2f}回。</p>
{chart(s['turn_bins'],'ゲームオーバーになるターン数（5ターン刻み）')}
{chart(s['total_bins'],'ゲームオーバー時の買物総額（10,000円刻み）')}
<h2>財布の小銭が0枚になった回数</h2>
<p>{html.escape(s['empty_wallet']['definition'])}</p>
<table><tr><th>指標（全試行対象）</th><th>結果</th></tr>
<tr><td>合計回数</td><td>{s['empty_wallet']['total']:,}回</td></tr>
<tr><td>1試行あたり平均</td><td>{s['empty_wallet']['mean']:.3f}回</td></tr>
<tr><td>中央値／最大</td><td>{s['empty_wallet']['median']:g}回／{s['empty_wallet']['max']}回</td></tr>
<tr><td>1回以上あった試行</td><td>{s['empty_wallet']['runs_with_empty_wallet']:,}件（{s['empty_wallet']['run_rate']:.2%}）</td></tr>
<tr><td>全会計に占める割合</td><td>{s['empty_wallet']['checkout_rate']:.2%}</td></tr></table>
{chart(s['empty_wallet']['bins'],'1試行あたりの小銭0枚回数（1回刻み）')}
<p>終了 {s['finished']:,}回／{r["maxTurns"]:,}ターンでの打ち切り {s['censored']:,}回。終了理由：{html.escape(str(s['causes']))}。</p>
<p class="note">ゲームオーバーになった最後の購入もターン数・総額に含みます。ゲーム本体の価格生成・支払い処理を直接利用。乱数シードは{r["seed"]}から連番。商品順は現行の{r["productCount"]}商品バッグと重複回避を再現していますが、ランダム比較関数によるsortはブラウザのエンジンにより挙動が変わり得ます。実行環境はmacOS JavaScriptCore。画面演出の時間と乱数消費は再現しません。統計表は終了した試行を対象としています。</p>
<p><a href="simulation-results.csv">全試行CSV</a> · <a href="summary.json">集計JSON</a> · <a href="simulation-results.json">設定・乱数・ソースハッシュを含む実行結果</a></p></html>"""
(base/'simulation-report.html').write_text(doc)
print(json.dumps(s,ensure_ascii=False,indent=2))
