from pathlib import Path
import json,html
base=Path(__file__).resolve().parent
s=json.loads((base/'summary.json').read_text())
names={'current':'現状：10PTで＋3枚','five_pt':'① 5PTで＋2枚','exact_pt':'② ピッタリでもPT獲得','five_pt_one':'③ 5PTで＋1枚'}
rows=[]
def add(label,fn):rows.append('<tr><th>'+label+'</th>'+''.join('<td>'+fn(x)+'</td>' for x in s)+'</tr>')
add('平均終了ターン',lambda x:f'{x["turns"]["mean"]:.1f}')
add('中央値',lambda x:f'{x["turns"]["median"]:.0f}')
add('終了ターンの中央90%',lambda x:f'{x["turns"]["p05"]:.0f}〜{x["turns"]["p95"]:.0f}')
add('平均買物総額',lambda x:f'¥{x["total"]["mean"]:,.0f}')
add('20ターン以内の終了',lambda x:f'{x["ended_by_20"]:.1%}')
add('60ターンを超える割合',lambda x:f'{1-x["ended_by_60"]:.1%}')
add('平均PT報酬回数',lambda x:f'{x["mean_levelUps"]:.2f}')
add('平均ピッタリ回数',lambda x:f'{x["mean_exactCount"]:.2f}')
add('初回拡張までの平均ターン※',lambda x:f'{x["mean_first_growth_turn"]:.1f}')
add('一度も拡張しなかった割合',lambda x:f'{x["no_growth_rate"]:.1%}')
add('平均同時報酬回数',lambda x:f'{x["mean_doubleRewards"]:.2f}')
add('1,000ターン打ち切り',lambda x:str(x['censored']))
colors=['#627f9c','#d49b36','#648957','#ac5f96'];paths=[]
results=[json.loads((base/(x['variant']+'.json')).read_text()) for x in s]
for metric,title,step in [('turns','終了ターン分布',5),('total','買物総額分布',10000)]:
 maximum=max(max(row[metric] for row in r['data']) for r in results)
 bins=list(range(0,maximum+step,step));counts=[[sum(i<=row[metric]<i+step for row in r['data'])/r['runs'] for i in bins] for r in results]
 peak=max(max(c) for c in counts)
 elements=[]
 for idx,cs in enumerate(counts):
  points=' '.join(f'{60+(i+.5)*680/len(bins):.2f},{260-n/peak*210:.2f}' for i,n in enumerate(cs))
  elements.append(f'<polyline points="{points}" fill="none" stroke="{colors[idx]}" stroke-width="3"/>')
 for n in range(6):
  pos=60+n*680/5;value=len(bins)*step*n/5
  elements.append(f'<text x="{pos}" y="284" text-anchor="middle">{value:,.0f}</text>')
 for n in range(5):
  y=260-n*210/4;val=peak*n/4
  elements.append(f'<text x="48" y="{y+4}" text-anchor="end">{val:.0%}</text>')
 paths.append(f'<h2>{title}</h2><p>区間幅：{step:,}。縦軸は各区間の試行割合。</p><svg viewBox="0 0 800 310" role="img" aria-label="{title}">'+''.join(elements)+'</svg>')
legend=' '.join(f'<span style="color:{colors[i]}">● {names[x["variant"]]}</span>' for i,x in enumerate(s))
doc='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>4つの報酬バランス比較</title><style>body{max-width:1050px;margin:32px auto;padding:0 20px;font:16px/1.8 system-ui;color:#28352b;background:#faf9f4}h1{font-size:26px}h2{font-size:21px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #d0d7ca;padding:8px;text-align:right}th:first-child{text-align:left}svg{width:100%;font:12px system-ui}span{display:inline-block;margin-right:20px}.table{overflow:auto}</style><h1>4つの報酬バランス比較</h1>'''
doc+=f'<p>各{s[0]["runs"]:,}回。同じ連番シード、初期上限20枚・ピッタリ＋2枚。上限が増えた会計は摩耗なし。ピッタリ時は既存PTを保持。②は10PTで＋3枚を維持し、ピッタリ時にも投入した硬貨枚数分のPTを獲得、両報酬の同時発生を許可。</p>'
doc+='<p>支払い候補を探索し、生存・会計後の空き枚数・上限・残りPTを順に優先する1会計単位の方針。全条件で同じ選択基準を使いますが、報酬ルールに応じて選ぶ支払いは変わります。人間の平均成績や将来を見越した完全最適プレイではありません。</p>'
doc+='<div class="table"><table><tr><th>指標</th>'+''.join('<th>'+names[x['variant']]+'</th>' for x in s)+'</tr>'+''.join(rows)+'</table></div><p>※初回拡張の平均は、拡張を経験した試行のみ。終了ターンと金額はゲームオーバーになった最後の購入を含みます。ターン数・金額の統計は終了した試行のみを対象とし、②の1,000ターン打ち切り1回は除外しています。</p>'+legend+''.join(paths)
doc+='<p>ゲーム本体は変更せず、メモリ上で各ルールを適用しました。各会計で支払い方針の予測とゲームロジックを照合し、各試行の容量収支も検証しています。実行環境はmacOS JavaScriptCore。商品バッグのランダムsortはエンジン依存です。</p><p><a href="results.csv">全試行CSV</a> ／ <a href="summary.json">集計JSON</a></p></html>'
(base/'report.html').write_text(doc)
print('Report written:',base/'report.html')
