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
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try { best = Number(localStorage.getItem('kozeni-best')) || 0; } catch {}
function se(type, weight = 1) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const tones = type === 'win' ? [523, 659, 784] : type === 'burst' ? [170, 90, 50] : type === 'note' ? [180] : [1300, 1900];
    tones.forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .065;
      osc.type = type === 'note' || type === 'burst' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency, t); gain.gain.setValueAtTime(Math.min(.09, .035 + weight * .002), t);
      gain.gain.exponentialRampToValueAtTime(.001, t + .14); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .15);
    });
  } catch {}
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000); }
function renderProduct() {
  $('art').textContent = current.emoji; $('art').style.background = current.color;
  $('item-name').textContent = current.name; $('category').textContent = current.category;
  $('description').textContent = current.description; $('price').textContent = yen(current.price);
  $('item-number').textContent = `NO. ${String(state.purchases.length + 1).padStart(3, '0')}`;
}
function render() {
  const visibleWallet = walletDisplay?.wallet || state.wallet;
  const visibleCapacity = walletDisplay?.capacity ?? state.capacity;
  const count = G.count(visibleWallet), paid = G.paid(state);
  $('total').textContent = yen(state.total); $('purchases').textContent = state.purchases.length; $('best').textContent = yen(best);
  $('capacity').innerHTML = `${String(count).padStart(3, '0')}<span>/${String(visibleCapacity).padStart(3, '0')}</span>`;
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
  $('tray-items').classList.remove('returning-change');
  $('tray-label').textContent = '投入額';
  $('tray-instruction').textContent = 'タップで1枚返却';
  $('paid').textContent = yen(paid); $('clear').disabled = busy || state.over || !state.tray.length;
  $('pay').disabled = busy || state.over || paid < current.price;
  const preview = G.previewPayment(state, current);
  $('coin-preview').textContent = !busy && preview ? `小銭 ${preview.delta > 0 ? '+' : ''}${preview.delta}枚 ${preview.delta < 0 ? '✨' : preview.delta > 0 ? '⚠️' : '→'}（${preview.after}/${state.capacity}枚）` : '';
  $('coin-preview').dataset.tone = preview?.over ? 'danger' : preview?.delta < 0 ? 'good' : 'neutral';
  if (busy) $('payment-hint').textContent = 'お買い上げありがとうございます';
  else if (paid < current.price) $('payment-hint').textContent = paid ? `あと ${yen(current.price - paid)}` : 'お金を選んでください';
  else {
    const { returned, after } = preview;
    $('payment-hint').textContent = `お釣り ${yen(paid - current.price)} · 硬貨 ${G.count(returned)}枚${preview.banknoteAmount ? ` ＋ お札 ${yen(preview.banknoteAmount)}` : ''}${after > state.capacity ? '\n⚠ お財布の容量を超えます' : after === 0 ? '\n✦ 小銭ゼロで容量 ＋2！' : ''}`;
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
  $('result-capacity').textContent = `小銭 ${G.count(state.wallet)}枚 / 容量 ${state.capacity}枚`;
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
  if (!pieces.length) $('tray-items').innerHTML = '<span class="tray-hint">お釣りなし ✨</span>';
  $('payment-hint').textContent = money.length ? 'お釣りをお返しします' : 'ピッタリ！';
  await pause(money.length ? 650 : 350);
  if (state !== paymentState) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  await Promise.all(pieces.map(async (piece, i) => {
    const m = money[i];
    const target = document.querySelector(m.note ? `[data-note="${m.value}"]` : `.coin-slot[data-value="${m.value}"]`);
    const from = piece.getBoundingClientRect(), to = target.getBoundingClientRect();
    const flight = piece.cloneNode(true);
    flight.classList.add('money-flight'); flight.setAttribute('aria-hidden', 'true');
    Object.assign(flight.style, {left:`${from.left}px`, top:`${from.top}px`, width:`${from.width}px`, height:`${from.height}px`});
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
  const before = {wallet:{...state.wallet}, notes:{...state.notes}, capacity:state.capacity};
  const result = G.pay(state, current); if (!result) return; busy = true;
  const paymentState = state; walletDisplay = before;
  if (state.total > best) { best = state.total; try { localStorage.setItem('kozeni-best', String(best)); } catch {} }
  trophy(current); se('win'); render();
  await animateChange(result, paymentState);
  if (state !== paymentState) return;
  walletDisplay = null; render();
  if (result.changeCount) se('coin', result.changeCount);
  else if (result.banknoteAmount) se('note');
  if (result.upgraded) {
    $('wallet').classList.add('upgrade'); toast(`小銭ゼロ！ お財布が ${state.capacity}枚にレベルアップ ✦`);
    await pause(800);
    if (state !== paymentState) return;
    $('wallet').classList.remove('upgrade');
  } else toast(`お釣り ${yen(result.change)} · 硬貨 ${result.changeCount}枚${result.banknoteAmount ? ` ＋ お札 ${yen(result.banknoteAmount)}` : ''}`);
  if (result.over) { burst(); await pause(850); if (state === paymentState) showResult(); }
  else { busy = false; nextProduct(); render(); }
};
$('clear').onclick = () => { if (!busy) { G.clear(state); render(); } };
document.querySelectorAll('[data-note]').forEach(button => button.onclick = () => add(Number(button.dataset.note), true));
$('sound').onclick = () => { sound = !sound; $('sound').textContent = sound ? '♪ ON' : '♪ OFF'; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', `効果音を${sound ? 'オフ' : 'オン'}にする`); se('coin'); };
$('help').onclick = () => $('help-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
$('result').addEventListener('cancel', e => e.preventDefault());
$('restart').onclick = () => { $('result').close(); for (const entry of moneyFlights) { entry.animation.cancel(); entry.flight.remove(); } moneyFlights.clear(); walletDisplay = null; state = G.createGame(); current = G.generateProduct(G.products[0], 0); bag = []; busy = false; $('trophies').replaceChildren(); $('wallet').classList.remove('burst', 'upgrade'); renderProduct(); render(); };
renderProduct(); render();
