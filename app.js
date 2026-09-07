'use strict';
const G = CoinGame;
const $ = id => document.getElementById(id);
const yen = n => `¥${n.toLocaleString('ja-JP')}`;
function initialGame() {
  try { return G.createGame(); }
  catch (error) {
    const message = document.createElement('p');
    message.textContent = `設定を確認してください。${error.message}`;
    message.setAttribute('role', 'alert'); message.style.padding = '24px';
    document.body.replaceChildren(message); throw error;
  }
}
let state = initialGame(), current = G.generateProduct(G.products[0], 0), busy = false, sound = false, audio, toastTimer, best = 0;
let bag = [];
let walletDisplay = null;
const moneyFlights = new Set();
const pointPopups = new Set();
let productAnimation;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const productPanel = document.querySelector('.product');
const productContent = document.createElement('div');
productContent.className = 'product-content';
productContent.append(...productPanel.childNodes);
productPanel.append(productContent);
const growth = document.createElement('div');
growth.className = 'growth';
growth.innerHTML = '<div class="growth-label"><strong id="exp-count"></strong><small id="wear-countdown"></small></div><progress id="exp-gauge" aria-label="次の上限拡張までのポイント" max="10" value="0"></progress>';
$('wallet').querySelector('.capacity-track').after(growth);
const expPreview = document.createElement('span');
expPreview.id = 'exp-preview';
$('coin-preview').after(expPreview);
try { best = Number(localStorage.getItem('kozeni-best')) || 0; } catch {}
function se(type, weight = 1) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const tones = type === 'level' ? [659, 784, 1047, 1319] : type === 'wear' ? [220, 165] : type === 'win' ? [523, 659, 784] : type === 'burst' ? [170, 90, 50] : type === 'note' ? [180] : [1300, 1900];
    tones.forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .065;
      osc.type = type === 'note' || type === 'burst' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency, t); gain.gain.setValueAtTime(Math.min(.09, .035 + weight * .002), t);
      gain.gain.exponentialRampToValueAtTime(.001, t + .14); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .15);
    });
  } catch {}
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000); }
async function slideProduct(entering) {
  productAnimation?.cancel();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 120 : entering ? 420 : 320;
  productContent.style.transform = entering ? 'none' : 'translateX(-115%)';
  productContent.style.opacity = entering ? '1' : '0';
  const animation = productContent.animate(reduced ? [{opacity:entering ? 0 : 1}, {opacity:entering ? 1 : 0}] :
    entering ? [{transform:'translateX(115%)',opacity:0}, {transform:'translateX(0)',opacity:1}] :
      [{transform:'translateX(0)',opacity:1}, {transform:'translateX(-115%)',opacity:0}],
    {duration, easing:entering ? 'cubic-bezier(.16,1,.3,1)' : 'ease-in', fill:'both'});
  productAnimation = animation;
  try { await Promise.race([animation.finished, pause(duration + 100)]); }
  catch {} finally { if (productAnimation === animation) { animation.cancel(); productAnimation = null; } }
}
async function showPoints(points, exact = false) {
  if (!exact && points <= 0) return;
  const el = document.createElement('div'); el.className = 'point-popup';
  el.textContent = exact ? 'ぴったり！' : `${points}枚へった！`; el.setAttribute('role', 'status');
  document.querySelector('.payment').append(el);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 900 : 1150;
  const animation = el.animate(reduced ? [{opacity:1}, {opacity:1,offset:.8}, {opacity:0}] : [
    {opacity:0, transform:'translate(-50%, 12px) scale(.65)'},
    {opacity:1, transform:'translate(-50%, -4px) scale(1.12)', offset:.2},
    {opacity:1, transform:'translate(-50%, -12px) scale(1)', offset:.7},
    {opacity:0, transform:'translate(-50%, -32px) scale(1)'}
  ], {duration, easing:'ease-out', fill:'both'});
  const entry = {el, animation}; pointPopups.add(entry);
  try { await Promise.race([animation.finished, pause(duration + 100)]); }
  catch {} finally { animation.cancel(); el.remove(); pointPopups.delete(entry); }
}
function renderProduct() {
  $('art').textContent = current.emoji; $('art').style.background = current.color;
  $('item-name').textContent = current.name; $('category').textContent = current.category;
  $('description').textContent = current.description; $('price').textContent = yen(current.price);
  void slideProduct(true);
}
function render() {
  const visibleWallet = walletDisplay?.wallet || state.wallet;
  const visibleCapacity = walletDisplay?.capacity ?? state.capacity;
  const visibleGrowth = walletDisplay || state;
  $('exp-count').textContent = `${visibleGrowth.currentEXP}/${visibleGrowth.nextLevelEXP} PT`;
  $('exp-gauge').max = visibleGrowth.nextLevelEXP;
  $('exp-gauge').value = visibleGrowth.currentEXP;
  $('wear-countdown').textContent = `摩耗まで ${visibleGrowth.rules.wearInterval - visibleGrowth.wearTurns % visibleGrowth.rules.wearInterval}ターン`;
  const rules = state.rules;
  $('growth-rules').textContent = `お釣りがある会計では、小銭を減らした枚数がポイントに。毎回${rules.initialLevelEXP}PTで小銭上限＋${rules.levelCapacityBonus}枚。お釣り0円なら小銭上限＋${rules.exactCapacityBonus}枚だけを適用し、ポイント・摩耗カウントは進みません。お釣りがある会計${rules.wearInterval}回ごとに小銭上限−1枚（摩耗は10枚まで）。上限を超えたらゲームオーバー！`;
  const count = G.count(visibleWallet), paid = G.paid(state);
  $('total').textContent = yen(state.total); $('purchases').textContent = state.purchases.length; $('best').textContent = yen(best);
  $('capacity').textContent = `${visibleCapacity}枚`;
  $('coin-total').textContent = `${count}枚`;
  $('capacity-bar').style.width = `${Math.min(100, count / visibleCapacity * 100)}%`;
  $('capacity-bar').style.background = count >= visibleCapacity - 2 ? '#c17d54' : '#82966a';
  $('coins').replaceChildren(...G.denominations.map(value => {
    const n = visibleWallet[value], button = document.createElement('button');
    button.className = 'coin-slot'; button.dataset.value = value; button.disabled = busy || state.over || !n;
    button.setAttribute('aria-label', `${value}円玉、残り${n}枚。1枚投入`);
    button.innerHTML = `<span class="coin-stack">${Array.from({length:Math.min(4, Math.max(1,n))}, (_,i) => `<span class="coin-face" style="--offset:${(Math.min(4, Math.max(1,n))-i-1)*3}px">${value}</span>`).join('')}</span><span class="coin-count">× ${n}</span>`;
    let startY, swiped = false;
    button.addEventListener('pointerdown', e => { startY = e.clientY; swiped = false; });
    button.addEventListener('pointerup', e => { if (startY !== undefined && startY - e.clientY > 20) { swiped = true; add(value); } startY = undefined; });
    button.addEventListener('pointercancel', () => { startY = undefined; });
    button.addEventListener('click', () => { if (!swiped) add(value); });
    return button;
  }));
  $('tray-items').replaceChildren();
  if (!state.tray.length) $('tray-items').innerHTML = '<span class="tray-hint">お金をタップして、ここに。</span>';
  state.tray.forEach((money, index) => {
    const button = makeTrayMoney(money, index);
    button.setAttribute('aria-label', `${money.value}円を1枚返却`);
    button.disabled = busy || state.over;
    button.onclick = () => { if (!busy) { G.remove(state, index); render(); } };
    $('tray-items').append(button);
  });
  layoutTray();
  $('tray-items').classList.remove('returning-change');
  $('tray-label').textContent = '投入額';
  $('tray-instruction').textContent = 'タップで1枚返却';
  $('paid').textContent = yen(paid); $('clear').disabled = busy || state.over || !state.tray.length;
  $('pay').disabled = busy || state.over || paid < current.price;
  const preview = G.previewPayment(state, current);
  $('coin-preview').textContent = !busy && preview ? `小銭 ${preview.delta > 0 ? '+' : ''}${preview.delta}枚 · 会計後 ${preview.after}枚` : '';
  const prediction = !busy && preview ? [preview.earnedEXP ? `+${preview.earnedEXP} PT獲得予想` : '', preview.exact ? 'ぴったり！' : '', preview.capacityAfter !== state.capacity ? `小銭上限 ${preview.capacityAfter}枚` : '', preview.wear ? '摩耗 −1枚' : ''].filter(Boolean).join(' · ') : '';
  const changedPrediction = $('exp-preview').textContent !== prediction;
  $('exp-preview').textContent = prediction;
  if (changedPrediction && prediction && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('exp-preview').animate([{opacity:.35, transform:'translateY(3px)'}, {opacity:1, transform:'translateY(0)'}], {duration:180});
  }
  $('coin-preview').dataset.tone = preview?.over ? 'danger' : preview?.delta < 0 ? 'good' : 'neutral';
  if (busy) $('payment-hint').textContent = 'お買い上げありがとうございます';
  else if (paid < current.price) $('payment-hint').textContent = paid ? `あと ${yen(current.price - paid)}` : '';
  else {
    const { returned } = preview;
    $('payment-hint').textContent = `お釣り ${yen(paid - current.price)} · 硬貨 ${G.count(returned)}枚${preview.banknoteAmount ? ` ＋ お札 ${yen(preview.banknoteAmount)}` : ''}${preview.over ? '\n⚠ お財布の容量を超えます' : ''}`;
  }
  document.querySelectorAll('[data-note]').forEach(b => {
    const n = (walletDisplay?.notes || state.notes)[b.dataset.note];
    b.querySelector('b').textContent = n === null ? '∞' : `×${n}`;
    b.setAttribute('aria-label', `${b.dataset.note}円札、${n === null ? '無制限' : '残り' + n + '枚'}。1枚投入`);
    b.disabled = busy || state.over || n === 0;
  });
}
function add(value, note = false) { if (busy || !G.add(state, value, note)) return; se(note ? 'note' : 'coin', state.wallet[value] || 1); render(); }
function nextProduct() {
  if (!bag.length) bag = [...G.products].sort(() => Math.random() - .5);
  if (bag.length > 1 && bag[bag.length - 1].name === current.name) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  current = G.generateProduct(bag.pop(), state.purchases.length); renderProduct();
}
function trophy(product) {
  const n = state.purchases.length - 1, el = document.createElement('span'); el.className = 'trophy'; el.textContent = product.emoji;
  el.style.setProperty('--x', `${(n % 4) * 29 + Math.random() * 8}px`); el.style.setProperty('--y', `${Math.floor((n % 16) / 4) * 21}px`); el.style.setProperty('--r', `${Math.random() * 40 - 20}deg`);
  if ($('trophies').children.length >= 16) $('trophies').firstChild.remove(); $('trophies').append(el);
}
function showResult() {
  $('result-total').textContent = yen(state.total); $('result-count').textContent = `${state.purchases.length} 点のお買いもの`;
  $('result-capacity').textContent = `小銭上限 ${state.capacity}枚 · 枚数 ${G.count(state.wallet)}枚 · ${state.currentEXP}/${state.nextLevelEXP} PT`;
  $('receipt-items').replaceChildren(...state.purchases.map(p => { const row = document.createElement('div'); row.className = 'receipt-row'; const label = document.createElement('span'), price = document.createElement('span'); label.textContent = `${p.emoji} ${p.name}`; price.textContent = yen(p.price); row.append(label, price); return row; }));
  $('result').showModal();
}
function burst() {
  $('wallet').classList.add('burst'); se('burst');
  const box = $('wallet').getBoundingClientRect();
  for (let i = 0; i < 18; i++) { const coin = document.createElement('span'); coin.className = 'flying-coin'; coin.textContent = '🪙'; coin.style.left = `${box.left + box.width / 2}px`; coin.style.top = `${box.top + 50}px`; coin.style.setProperty('--dx', `${(Math.random() - .5) * 450}px`); coin.style.setProperty('--dy', `${-80 - Math.random() * 300}px`); document.body.append(coin); setTimeout(() => coin.remove(), 1100); }
}
function makeTrayMoney(money, index) {
  const button = document.createElement('button');
  button.className = `tray-money${money.note ? ' note' : ''}`;
  button.dataset.value = money.value;
  button.dataset.kind = money.note ? 'note' : 'coin';
  button.textContent = money.note ? yen(money.value) : money.value;
  button.style.setProperty('--tilt', `${(index * 17 % 23) - 11}deg`);
  button.style.setProperty('--scatter-y', `${index * 7 % 9 - 4}px`);
  return button;
}
function layoutTray() {
  const tray = $('tray-items'), pieces = [...tray.querySelectorAll('.tray-money')];
  if (!pieces.length || !tray.clientWidth || !tray.clientHeight) return;
  // Keep every piece in the tray. Dense piles shrink together instead of scrolling.
  const width = Math.max(1, tray.clientWidth - 12), height = Math.max(1, tray.clientHeight - 12);
  const faceWidth = Math.max(...pieces.map(p => p.offsetWidth)), faceHeight = Math.max(...pieces.map(p => p.offsetHeight));
  const maxWidth = faceWidth + faceHeight * .22, maxHeight = faceHeight + faceWidth * .22;
  let best = {scale:0, columns:1, rows:1};
  for (let rows = 1; rows <= pieces.length; rows++) {
    const columns = Math.ceil(pieces.length / rows);
    const scale = Math.min(1, width / (maxWidth * (1.12 + (columns - 1) * .38)), height / (maxHeight * (1.12 + (rows - 1) * .35)));
    if (scale > best.scale) best = {scale, columns, rows};
  }
  const {scale, columns, rows} = best;
  const cellWidth = maxWidth * scale, cellHeight = maxHeight * scale;
  const stepX = cellWidth * .38, stepY = cellHeight * .35;
  const left = 6 + (width - cellWidth - (columns - 1) * stepX) / 2;
  const top = 6 + (height - cellHeight - (rows - 1) * stepY) / 2;
  // Larger banknotes sit beneath coins while each button retains its own return handler.
  pieces.sort((a,b) => b.offsetWidth - a.offsetWidth).forEach((piece, i) => {
    const x = left + (i % columns) * stepX + Math.sin(i * 2.4) * cellWidth * .035;
    const scatter = rows === 1 ? (height - cellHeight) * .42 : cellHeight * .12;
    const y = Math.max(6, Math.min(6 + height - cellHeight,
      top + Math.floor(i / columns) * stepY + Math.sin(i * 1.7) * scatter));
    Object.assign(piece.style, {left:`${x + cellWidth / 2}px`, top:`${y + cellHeight / 2}px`, zIndex:String(i + 1),
      transform:`translate(-50%, -50%) scale(${scale}) rotate(${(i * 17 % 23) - 11}deg)`});
  });
}
new ResizeObserver(layoutTray).observe($('tray-items'));
function changeMoney(result) {
  const money = [];
  for (const value of G.noteDenominations) {
    for (let i = 0; i < result.returnedNotes[value]; i++) money.push({value, note:true});
  }
  for (const value of G.denominations) {
    for (let i = 0; i < result.returned[value]; i++) money.push({value, note:false});
  }
  return money;
}
async function animateChange(result, paymentState) {
  const money = changeMoney(result);
  $('tray-label').textContent = 'お釣り';
  $('paid').textContent = yen(result.change);
  $('tray-instruction').textContent = money.length ? 'お財布にしまいます' : 'ピッタリのお支払い';
  $('tray-items').classList.add('returning-change');
  const pieces = money.map((m, i) => {
    const el = makeTrayMoney(m, i); el.disabled = true;
    el.setAttribute('aria-label', `お釣り ${m.value}円`);
    return el;
  });
  $('tray-items').replaceChildren(...pieces);
  layoutTray();
  if (!pieces.length) $('tray-items').innerHTML = '<span class="tray-hint">お釣りなし ✨</span>';
  $('payment-hint').textContent = money.length ? 'お釣りをお返しします' : 'ピッタリ！';
  void showPoints(result.earnedEXP, result.change === 0);
  await pause(money.length ? 650 : 350);
  if (state !== paymentState) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  await Promise.all(pieces.map(async (piece, i) => {
    const m = money[i];
    const target = document.querySelector(m.note ? `[data-note="${m.value}"]` : `.coin-slot[data-value="${m.value}"]`);
    const from = piece.getBoundingClientRect(), to = target.getBoundingClientRect();
    const flight = piece.cloneNode(true);
    flight.classList.add('money-flight'); flight.setAttribute('aria-hidden', 'true');
    Object.assign(flight.style, {left:`${from.left}px`, top:`${from.top}px`, width:`${from.width}px`, minWidth:'0', height:`${from.height}px`, transform:'none', zIndex:'6'});
    document.body.append(flight); piece.style.visibility = 'hidden';
    const dx = to.left + to.width / 2 - from.left - from.width / 2;
    const dy = to.top + to.height / 2 - from.top - from.height / 2;
    const duration = reduced ? 120 : 520;
    const delay = reduced ? 0 : Math.min(i * 35, 350);
    const animation = flight.animate(reduced ? [{opacity:1}, {opacity:0}] : [
      {transform:'translate(0, 0) scale(1)', opacity:1},
      {transform:`translate(${dx * .45}px, ${dy * .25 - 25}px) rotate(-12deg) scale(1.08)`, opacity:1, offset:.4},
      {transform:`translate(${dx}px, ${dy}px) scale(.45)`, opacity:0}
    ], {duration, delay, easing:'ease-in-out', fill:'both'});
    const entry = {animation, flight}; moneyFlights.add(entry);
    // Background tabs can suspend animation frames; never leave checkout locked.
    try { await Promise.race([animation.finished, pause(duration + delay + 100)]); }
    catch {} finally { animation.cancel(); flight.remove(); moneyFlights.delete(entry); }
  }));
}
$('pay').onclick = async () => {
  if (busy) return;
  const before = {...state, wallet:{...state.wallet}, notes:{...state.notes}, purchases:[...state.purchases]};
  const result = G.pay(state, current); if (!result) return; busy = true;
  const paymentState = state; walletDisplay = before;
  if (state.total > best) { best = state.total; try { localStorage.setItem('kozeni-best', String(best)); } catch {} }
  trophy(current); se('win'); render();
  await Promise.all([slideProduct(false), animateChange(result, paymentState)]);
  if (state !== paymentState) return;
  walletDisplay = null; render();
  if (result.changeCount) se('coin', result.changeCount);
  else if (result.banknoteAmount) se('note');
  const rewards = [result.earnedEXP ? `+${result.earnedEXP} PT獲得` : '', result.levelUps ? `小銭上限＋${result.levelCapacityGain}枚` : '', result.exactBonus ? `ぴったり！ 小銭上限＋${result.exactBonus}枚` : '', result.wear ? '財布の摩耗：小銭上限−1枚' : ''].filter(Boolean);
  toast(rewards.length ? rewards.join(' / ') : `お釣り ${yen(result.change)} · 硬貨 ${result.changeCount}枚${result.banknoteAmount ? ` ＋ お札 ${yen(result.banknoteAmount)}` : ''}`);
  if (result.upgraded || result.wear) {
    $('wallet').classList.add(result.upgraded ? 'upgrade' : 'wear');
    se(result.upgraded ? 'level' : 'wear');
    await pause(800);
    if (state !== paymentState) return;
    $('wallet').classList.remove('upgrade', 'wear');
  }
  if (result.over) { burst(); await pause(850); if (state === paymentState) showResult(); }
  else { busy = false; nextProduct(); render(); }
};
$('clear').onclick = () => { if (!busy) { G.clear(state); render(); } };
document.querySelectorAll('[data-note]').forEach(button => button.onclick = () => add(Number(button.dataset.note), true));
$('sound').onclick = () => { sound = !sound; $('sound').textContent = sound ? '♪ ON' : '♪ OFF'; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', `効果音を${sound ? 'オフ' : 'オン'}にする`); se('coin'); };
$('help').onclick = () => $('help-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
$('result').addEventListener('cancel', e => e.preventDefault());
$('restart').onclick = () => { $('result').close(); productAnimation?.cancel(); for (const entry of pointPopups) { entry.animation.cancel(); entry.el.remove(); } pointPopups.clear(); for (const entry of moneyFlights) { entry.animation.cancel(); entry.flight.remove(); } moneyFlights.clear(); clearTimeout(toastTimer); $('toast').classList.remove('show'); walletDisplay = null; state = G.createGame(); current = G.generateProduct(G.products[0], 0); bag = []; busy = false; $('trophies').replaceChildren(); $('wallet').classList.remove('burst', 'upgrade', 'wear'); renderProduct(); render(); };
renderProduct(); render();
