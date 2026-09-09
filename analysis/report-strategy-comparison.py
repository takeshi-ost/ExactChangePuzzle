# coding: utf-8
"""Summarize policies separately; right-censored runs are never treated as deaths."""
from pathlib import Path
import json,csv,statistics,html
folder=Path(__file__).resolve().parent/'strategy-comparison'
r=json.loads((folder/'results.json').read_text())
labels={'smart':'従来：当会計の空き枚数優先','balanced':'新戦略：18枚以上でピッタリ優先・A:B＝5:1'}
summary={}
for policy,label in labels.items():
 rows=[x for x in r['data'] if x['policy']==policy];done=[x for x in rows if x['over']];alive=[x for x in rows if not x['over']]
 mean=lambda xs,key:statistics.mean(x[key] for x in xs) if xs else None
 summary[policy]={'runs':len(rows),'finished':len(done),'censored':len(alive),'censored_rate':len(alive)/len(rows),'observed_mean_turns':mean(rows,'turns'),'observed_mean_total':mean(rows,'total'),'finished_mean_turns':mean(done,'turns'),'finished_mean_total':mean(done,'total'),'survivor_mean_capacity':mean(alive,'capacity'),'survivor_mean_coins':mean(alive,'coins'),'max_capacity':max(x['capacity'] for x in rows),'exact_rate':sum(x['exactCount'] for x in rows)/sum(x['turns'] for x in rows),'empty_wallet_count':sum(x['emptyWalletCount'] for x in rows),'survival':{str(t):sum(x['turns']>t or (x['turns']==t and not x['over']) for x in rows)/len(rows) for t in [10,20,50,100,250,500,1000] if t<=r['maxTurns']}}
for policy in labels:
 rows=[x for x in r['data'] if x['policy']==policy]
 reached=[x for x in rows if x['goldCards']>0]
 finished_after=[x for x in reached if x['over']]
 summary[policy].update(
  max_turns=max(x['turns'] for x in rows),
  gold_card_total=sum(x['goldCards'] for x in rows),
  gold_card_bins={str(n):sum(x['goldCards']==n for x in rows) for n in range(max(x['goldCards'] for x in rows)+1)},
  breakthrough_runs=len(reached),
  breakthrough_rate=len(reached)/len(rows),
  repeat_breakthrough_runs=sum(x['goldCards']>=2 for x in rows),
  repeat_given_first_rate=sum(x['goldCards']>=2 for x in rows)/len(reached) if reached else None,
  mean_first_breakthrough=statistics.mean(x['breakthroughTurns'][0] for x in reached) if reached else None,
  mean_turns_after_last_reset=statistics.mean(x['turns']-x['breakthroughTurns'][-1] for x in finished_after) if finished_after else None
 )
(folder/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
with (folder/'results.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=r['data'][0].keys(),lineterminator='\n');w.writeheader();w.writerows(r['data'])
metrics=[('runs','試行数'),('max_turns','最長観測会計数'),('gold_card_total','獲得ゴールドカード合計'),('breakthrough_runs','上限突破した試行数'),('breakthrough_rate','上限突破した試行の割合'),('repeat_breakthrough_runs','2回以上突破した試行数'),('repeat_given_first_rate','初回突破者のうち2回目に到達した割合'),('mean_first_breakthrough','初回突破の平均会計数'),('mean_turns_after_last_reset','終了者：最後のリセットから終了までの平均会計数'),('finished','終了試行数'),('censored','最大会計数到達時の生存試行数'),('censored_rate','最大会計数到達時の生存率'),('observed_mean_turns','観測会計数の平均（打ち切り含む）'),('observed_mean_total','観測購入総額の平均・円（打ち切り含む）'),('finished_mean_turns','終了試行のみ：平均会計数'),('finished_mean_total','終了試行のみ：平均購入総額・円'),('survivor_mean_capacity','打ち切り生存者：平均最終容量'),('survivor_mean_coins','打ち切り生存者：平均最終小銭枚数'),('max_capacity','全試行の最大最終容量'),('exact_rate','全観測会計のピッタリ率'),('empty_wallet_count','小銭0枚だった会計数の合計')]
def fmt(k,v):return '該当なし' if v is None else (f'{v:.2%}' if k.endswith('rate') else f'{v:,.2f}')
table='<table><tr><th>指標</th>'+''.join(f'<th>{label}</th>' for label in labels.values())+'</tr>'
for k,label in metrics:table+='<tr><td>'+label+'</td>'+''.join('<td>'+fmt(k,summary[p][k])+'</td>' for p in labels)+'</tr>'
table+='</table>'
survival='<table><tr><th>会計完了後</th>'+''.join(f'<th>{label}</th>' for label in labels.values())+'</tr>'
for t in summary['smart']['survival']:survival+='<tr><td>'+t+'回</td>'+''.join(f'<td>{summary[p]["survival"][t]:.2%}</td>' for p in labels)+'</tr>'
survival+='</table>'
svg='<svg viewBox="0 0 900 360" role="img" aria-label="会計数ごとの生存率"><path d="M60 20 V310 H870" fill="none" stroke="#999"/>'
for y in [0,.25,.5,.75,1]:svg+=f'<text x="5" y="{315-290*y}">{y:.0%}</text>'
for t in [0,250,500,750,1000]:
 if t<=r['maxTurns']:svg+=f'<text x="{60+810*t/r["maxTurns"]}" y="335">{t}</text>'
for policy,color in [('smart','#9b6a3c'),('balanced','#347d67')]:
 rows=[x for x in r['data'] if x['policy']==policy];points=[]
 for t in range(r['maxTurns']+1):
  n=sum(x['turns']>t or (x['turns']==t and not x['over']) for x in rows)
  points.append(f'{60+810*t/r["maxTurns"]:.2f},{310-290*n/len(rows):.2f}')
 svg+=f'<polyline points="{" ".join(points)}" fill="none" stroke="{color}" stroke-width="2"/>'
svg+='</svg><p>茶：従来戦略　緑：新戦略</p>'
config=html.escape(json.dumps(r['config'],ensure_ascii=False))
cards='<table><tr><th>ゴールドカード枚数</th>'+''.join(f'<th>{label}</th>' for label in labels.values())+'</tr>'
for n in range(max(int(k) for p in labels for k in summary[p]['gold_card_bins'])+1):
 cards+=f'<tr><td>{n}枚</td>'+''.join(f'<td>{summary[p]["gold_card_bins"].get(str(n),0):,}件</td>' for p in labels)+'</tr>'
cards+='</table>'
doc=f'''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>硬貨保持戦略の比較</title><style>body{{max-width:1050px;margin:30px auto;padding:0 20px;font:16px/1.8 system-ui;color:#26392e;background:#faf9f4}}table{{width:100%;border-collapse:collapse}}th,td{{padding:8px;border-bottom:1px solid #ddd;text-align:right}}th:first-child,td:first-child{{text-align:left}}svg{{width:100%}}pre{{white-space:pre-wrap}}</style>
<h1>硬貨保持戦略の比較シミュレーション</h1><p>{html.escape(r['generated_at'])}／各{r['runs']:,}試行／最大{r['maxTurns']:,}会計／同じシード列で比較。</p>
<h2>戦略の定義</h2><p>容量18枚未満では両者とも従来戦略。新戦略は18枚以上でピッタリ可能なら必ずピッタリ。紙幣で千円単位を払い、端数は高額から硬貨を使う。ピッタリ不可なら、紙幣のみ、または100・500円硬貨と紙幣の組合せを比較する。100・500円硬貨はそれぞれ価格を単独で満たす枚数までを上限として探索する。</p><p>A＝1・10・100円の合計枚数、B＝5・50・500円の合計枚数。生存可否を最優先し、|A−5B|/(A+B)が小さい候補を選ぶ。同点なら残る額面種類数が多い、投入硬貨枚数が少ない、過払いが少ない順。各額面ペアを個別に5:1にする戦略ではない。ピッタリの複数の出し方は比率で最適化せず、高額硬貨から出す。</p><p>従来戦略は生存、空き枚数、容量、残りPT、過払いの少なさの順。両戦略とも現在のからっぽ＋5・ピッタリ＋2・PT繰り越しを反映。会計後の容量が50枚以上になったら上限20枚・小銭0枚へ戻し、ゴールドカードを1枚獲得して継続。保有PT・購入数と価格難易度は引き継ぐ。初回商品と以降の商品順・価格抽選はゲーム本体を利用する。演出の乱数消費は省略。実行環境はmacOS JavaScriptCore。</p>
<h2>結果</h2>{table}<p>観測平均は生存試行を最大会計数で打ち切った値です。寿命の平均とは異なり、終了試行だけの平均も全体の寿命を表しません。打ち切り時点で生き残っていても無限に継続できる証明ではありません。</p>
<h2>今回の読み取り</h2><p>新戦略の1,000会計到達率は{summary['balanced']['censored_rate']:.2%}、生存者の平均最終容量は{fmt('capacity',summary['balanced']['survivor_mean_capacity'])}（該当する場合は枚数）です。終了した試行だけの平均は{summary['balanced']['finished_mean_turns']:.2f}会計です。生存曲線と最終容量を合わせて評価してください。容量が成長し続ける長期継続パターンの確認には役立ちますが、有限回の試行で無限継続を証明することはできません。</p>
<h2>ゴールドカードの獲得分布</h2>{cards}<p>最後のリセットから終了までの平均は、突破後に終了した試行だけを対象とします。初回から2回目の到達割合も、観測期間内での値です。</p><h2>生存率</h2>{svg}{survival}<h2>実行設定</h2><pre>{config}</pre><p><a href="before-breakthrough/report.html">上限突破リセット導入前の比較結果</a></p><p>小銭0枚の回数は開始時を除く会計後の0枚を数え、上限突破リセットによる0枚も含みます。元から0枚だった会計を含むため、からっぽボーナス発動回数とは異なります。</p><p><a href="results.csv">全試行CSV</a> · <a href="summary.json">集計JSON</a> · <a href="results.json">設定・シード・ソースハッシュ付き結果</a></p></html>'''
(folder/'report.html').write_text(doc)
print(json.dumps(summary,ensure_ascii=False,indent=2))
