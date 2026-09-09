// Shared by the browser suite and the dependency-free Node runner.
test('5000 notes support finite insertion, individual return and clear', () => {
  const s = T.createGame({...WALLET_CONFIG,notes:{1000:0,5000:1,10000:0}});
  assert(T.add(s,5000,true) && T.paid(s) === 5000 && s.notes[5000] === 0);
  assert(!T.add(s,5000,true)); T.remove(s,0); assert(s.notes[5000] === 1);
  T.add(s,5000,true); T.clear(s); assert(s.notes[5000] === 1 && T.paid(s) === 0);
  T.add(s,5000,true); const r=T.pay(s,{price:5000});
  assert(r.exact && s.notes[5000] === 0 && r.earnedEXP === 0 && s.wearTurns === 1);
});
test('banknote change uses 5000 notes and conserves all denominations', () => {
  for(let amount=0;amount<=20000;amount++) {
    const notes=T.changeNotes(amount), coins=T.changeCoins(amount);
    assert(T.noteDenominations.reduce((sum,v)=>sum+v*notes[v],0)+T.denominations.reduce((sum,v)=>sum+v*coins[v],0)===amount);
    assert(notes[1000] < 5 && notes[5000] < 2);
  }
  const s=T.createGame({...WALLET_CONFIG,notes:{1000:0,5000:0,10000:1}});
  T.add(s,10000,true);const p=T.previewPayment(s,{price:3999});T.pay(s,{price:3999});
  assert(p.returnedNotes[5000]===1&&p.returnedNotes[1000]===1&&s.notes[5000]===1&&s.notes[1000]===1);
});
test('exact payments without a bonus preserve points but still wear', () => {
  const s=T.createGame({...WALLET_CONFIG,exactCapacityBonus:0});s.currentEXP=4;s.wearTurns=1;
  for(let i=0;i<3;i++){T.add(s,1000,true);const p=T.previewPayment(s,{price:1000});T.pay(s,{price:1000});assert(p.earnedEXP===0&&p.wear===1&&s.currentEXP===4&&s.wearTurns===i+2&&s.capacity===14-i);}
  T.add(s,1000,true);T.pay(s,{price:999});assert(s.wearTurns===5&&s.capacity===11&&s.purchases.length===4);
});
test('custom growth rules affect threshold, rewards, wear and preview together', () => {
  const config = {...WALLET_CONFIG,   levelCapacityBonus:4, exactCapacityBonus:6};
  const s = T.createGame(config); s.currentEXP = 4; s.purchases = [{price:1}]; s.wearTurns = 1;
  T.add(s,100); T.add(s,100); T.add(s,5);
  const p = T.previewPayment(s,{price:200}); T.pay(s,{price:200});
  assert(p.earnedEXP === 2 && p.levelCapacityGain === 4 && p.exactBonus === 0 && p.wear === 0);
  assert(s.level === 2 && s.currentEXP === 1 && s.nextLevelEXP === 5 && s.capacity === 19 && s.capacity === p.capacityAfter);
  config.levelCapacityBonus = 99; assert(s.rules.levelCapacityBonus === 4);
});
test('fixed thresholds and zero capacity bonuses are supported', () => {
  const s = T.createGame({...WALLET_CONFIG,levelCapacityBonus:0,exactCapacityBonus:0});
  T.add(s,100); T.add(s,100); T.add(s,5); T.pay(s,{price:200});
  assert(s.level === 1 && s.nextLevelEXP === 5 && s.currentEXP === 2 && s.capacity === 14);
});
test('invalid and missing growth settings are rejected with their field name', () => {
  for(const [key,minimum] of Object.entries({levelCapacityBonus:0,exactCapacityBonus:0})) {
    for(const value of [undefined,null,minimum-1,1.5,'5',Infinity]) {
      let rejected=false;try {T.createGame({...WALLET_CONFIG,[key]:value});} catch(e) {rejected=e.message.includes(key);}
      assert(rejected);
    }
  }
});
test('production configuration remains the source of initial holdings', () => {
  const s = T.createGame(configuredWallet);
  assert(s.capacity === configuredWallet.maxCoinsCapacity);
  assert(JSON.stringify(s.wallet) === JSON.stringify(configuredWallet.coins));
  assert(JSON.stringify(s.notes) === JSON.stringify(configuredWallet.notes));
  assert(s.level === 1 && s.currentEXP === 0 && s.nextLevelEXP === 5);
  for(const key of ['levelCapacityBonus','exactCapacityBonus']) assert(s.rules[key] === configuredWallet[key]);
});
test('net reduction earns points even with change and coins left', () => {
  const s = T.createGame(); T.add(s,100); T.add(s,100); T.add(s,5);
  const r = T.pay(s,{price:200});
  assert(r.earnedEXP === 2 && s.currentEXP === 2 && T.count(s.wallet) === 6);
  assert(r.exactBonus === 0 && s.capacity === 14);
});
test('returned tray coins and insufficient payment never award points or turns', () => {
  const s = T.createGame(); T.add(s,100); T.remove(s,0);
  assert(T.pay(s,{price:200}) === null);
  T.add(s,100); T.clear(s);
  assert(s.currentEXP === 0 && s.purchases.length === 0 && s.capacity === 15);
});
test('level threshold consumes five points, carries excess and adds capacity', () => {
  const s = T.createGame(); s.currentEXP = 4;
  T.add(s,100); T.add(s,100); T.add(s,5);
  const before = JSON.stringify(s), p = T.previewPayment(s,{price:200});
  assert(JSON.stringify(s) === before && p.earnedEXP === 2 && p.capacityAfter === 16);
  T.pay(s,{price:200});
  assert(s.level === 2 && s.currentEXP === 1 && s.nextLevelEXP === 5 && s.capacity === 16);
});
test('one payment grants multiple expansions and carries excess points', () => {
  const s = T.createGame({...WALLET_CONFIG,coins:{500:0,100:0,50:0,10:0,5:0,1:40},notes:{5000:null,1000:null,10000:null},maxCoinsCapacity:40});
  while(s.wallet[1]) T.add(s,1);
  T.add(s,1000,true);
  const r = T.pay(s,{price:540}); // Return one 500-yen coin: net reduction 39.
  assert(r.earnedEXP === 39 && r.levelUps === 7 && s.level === 8);
  assert(s.currentEXP === 4 && s.nextLevelEXP === 5 && s.capacity === 47);
});
test('exact payment rewards capacity even when wallet is not empty', () => {
  const s = T.createGame(); T.add(s,100); T.add(s,100);
  const r = T.pay(s,{price:200});
  assert(T.count(s.wallet) === 6 && r.exactBonus === 2 && r.wear === 0 && s.capacity === 17 && s.currentEXP === 0 && s.wearTurns === 1);
});
test('banknote-only change and an empty wallet do not give exact bonus', () => {
  const s = T.createGame(); s.wallet = T.changeCoins(0); T.add(s,10000,true);
  const r = T.pay(s,{price:9000});
  assert(r.changeCount === 0 && r.change === 1000 && !r.upgraded && s.capacity === 14 && s.currentEXP === 0);
});
test('wear occurs on every completed turn, never on preview', () => {
  const s = T.createGame();
  for(let turn=1;turn<=10;turn++) {
    s.wallet = T.changeCoins(0); T.add(s,1000,true);
    const before = JSON.stringify(s), p = T.previewPayment(s,{price:999});
    assert(JSON.stringify(s) === before && p.wear === 1);
    T.pay(s,{price:999}); assert(s.capacity === 15-turn);
  }
});
test('wear continues below ten', () => {
  for(const capacity of [9,10,11]) {
    const s = T.createGame({...WALLET_CONFIG,maxCoinsCapacity:capacity});
    s.purchases = Array(4).fill({price:1}); s.wearTurns = 4; s.wallet = T.changeCoins(0); T.add(s,1000,true);
    T.pay(s,{price:999}); assert(s.capacity === capacity-1);
  }
});
test('exact bonus preserves existing points and skips wear', () => {
  const s = T.createGame(); s.currentEXP = 4; s.purchases = Array(4).fill({price:1}); s.wearTurns = 4;
  T.add(s,100); T.add(s,100);
  const p = T.previewPayment(s,{price:200}); T.pay(s,{price:200});
  assert(p.levelUps === 0 && p.earnedEXP === 0 && p.exactBonus === 2 && p.wear === 0 && p.capacityAfter === 17);
  assert(s.capacity === p.capacityAfter && s.currentEXP === 4 && s.wearTurns === 5 && s.level === 1 && !s.over);
  T.add(s,1000,true); const next = T.pay(s,{price:999});
  assert(next.wear === 1 && s.wearTurns === 6 && s.capacity === 16);
});
test('wear can cause overflow and preview warns before committing', () => {
  const s = T.createGame(); s.purchases = Array(4).fill({price:1}); s.wearTurns = 4; T.add(s,1000,true);
  const p = T.previewPayment(s,{price:917});
  assert(p.after === 15 && p.capacityAfter === 14 && p.over);
  T.pay(s,{price:917}); assert(s.over && s.purchases.length === 5);
  const before = JSON.stringify(s); assert(T.pay(s,{price:1}) === null && JSON.stringify(s) === before);
});
test('preview and committed growth agree across all fractional prices', () => {
  for(let price=1;price<=1000;price++) {
    const s = T.createGame(); s.currentEXP = 4; s.purchases = Array(4).fill({price:1}); s.wearTurns = 4;
    T.add(s,100); T.add(s,100); T.add(s,5); T.add(s,1000,true);
    const p = T.previewPayment(s,{price}); T.pay(s,{price});
    assert(s.currentEXP === p.currentEXP && s.nextLevelEXP === p.nextLevelEXP && s.level === p.level);
    assert(s.capacity === p.capacityAfter && s.over === p.over && T.count(s.wallet) === p.after);
  }
});

test('removed configuration keys cannot change fixed rules', () => {
  const s=T.createGame({...WALLET_CONFIG,wearInterval:99,initialLevelEXP:1});
  T.add(s,100);T.add(s,100);T.add(s,5);
  const r=T.pay(s,{price:200});
  assert(r.wear===1&&s.currentEXP===2&&s.nextLevelEXP===5&&r.levelUps===0);
  assert(!('wearInterval' in s.rules)&&!('initialLevelEXP' in s.rules));
});
test('five points exactly expand once and reset to zero', () => {
  const s=T.createGame({...WALLET_CONFIG,levelCapacityBonus:2});s.currentEXP=3;
  T.add(s,100);T.add(s,100);T.add(s,5);
  const r=T.pay(s,{price:200});
  assert(r.levelUps===1&&r.wear===0&&s.capacity===17&&s.currentEXP===0);
});

test('empty wallet reaches zero capacity and ends on the final purchase', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:T.changeCoins(0),maxCoinsCapacity:2,exactCapacityBonus:0});
  for(const capacity of [1,0]) {
    T.add(s,1000,true);
    const before=JSON.stringify(s), p=T.previewPayment(s,{price:1000});
    assert(JSON.stringify(s)===before&&p.after===0&&p.capacityAfter===capacity&&p.over===(capacity===0));
    T.pay(s,{price:1000});assert(s.capacity===capacity&&s.over===(capacity===0));
  }
  assert(s.total===2000&&s.purchases.length===2);
  const before=JSON.stringify(s);assert(!T.add(s,1000,true)&&T.pay(s,{price:1})===null&&JSON.stringify(s)===before);
});
test('capacity bonus is applied before zero-capacity game-over check', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:T.changeCoins(0),maxCoinsCapacity:1,exactCapacityBonus:2});
  T.add(s,1000,true);const p=T.pay(s,{price:1000});
  assert(p.capacityAfter===3&&p.wear===0&&!p.over&&s.capacity===3&&!s.over);
});

test('zero capacity bonus at five points does not prevent wear', () => {
  const s=T.createGame({...WALLET_CONFIG,levelCapacityBonus:0});s.currentEXP=3;
  T.add(s,100);T.add(s,100);T.add(s,5);
  const p=T.pay(s,{price:200});
  assert(p.levelUps===1&&p.levelCapacityGain===0&&p.wear===1&&s.capacity===14&&s.currentEXP===0);
});

test('points preserved by exact payment can earn the next threshold reward', () => {
  const s=T.createGame({...WALLET_CONFIG,levelCapacityBonus:3});s.currentEXP=3;
  T.add(s,1000,true);const exact=T.pay(s,{price:1000});
  assert(exact.exact&&s.currentEXP===3&&s.capacity===17&&exact.wear===0);
  T.add(s,100);T.add(s,100);T.add(s,5);
  const next=T.pay(s,{price:200});
  assert(next.earnedEXP===2&&next.levelUps===1&&next.wear===0&&s.currentEXP===0&&s.capacity===20);
});

test('catalog contains 100 unique products split evenly between surreal and everyday', () => {
  assert(T.products === PRODUCT_CATALOG && T.products.length === 100);
  assert(new Set(T.products.map(p => p.name)).size === 100);
  for (const category of ['シュール', '日常']) assert(T.products.filter(p => p.category === category).length === 50);
  for (const p of T.products) {
    assert(Number.isSafeInteger(p.price) && p.price > 0);
    for (const key of ['name', 'description', 'emoji', 'color']) assert(typeof p[key] === 'string' && p[key].trim());
    const before = JSON.stringify(p);
    for (const roll of [0, .1, .3, .6, .9]) {
      let calls = 0;
      const generated = T.generateProduct(p, 10, () => calls++ === 0 ? roll : .5);
      assert(generated.name === p.name && generated.category === p.category);
      assert(generated.price > Math.floor(p.price / 1000) * 1000 && generated.price <= Math.floor(p.price / 1000) * 1000 + 1000);
      assert(T.riskLevel(generated.price) === generated.riskLevel);
    }
    assert(JSON.stringify(p) === before);
  }
});

test('three existing points plus six earned carry four into the next purchase', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:{500:0,100:0,50:0,10:0,5:0,1:7}});
  s.currentEXP=3;
  for(let i=0;i<7;i++) T.add(s,1);
  T.add(s,1000,true);
  const before=JSON.stringify(s), preview=T.previewPayment(s,{price:507});
  assert(JSON.stringify(s)===before && preview.earnedEXP===6 && preview.currentEXP===4);
  const result=T.pay(s,{price:507});
  assert(result.levelUps===1 && s.level===2 && s.capacity===16 && s.currentEXP===4 && result.wear===0);
  T.add(s,500);T.add(s,1000,true);
  const next=T.pay(s,{price:500}); // Banknote-only change: one coin spent earns the fifth point.
  assert(next.earnedEXP===1 && next.levelUps===1 && s.currentEXP===0 && s.capacity===17);
});

test('empty-wallet bonus stacks with exact, preserves PT, and excludes already empty wallets', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:{500:0,100:1,50:0,10:0,5:0,1:0},emptyCapacityBonus:5});s.currentEXP=3;
  T.add(s,100);const before=JSON.stringify(s),p=T.previewPayment(s,{price:100});
  assert(JSON.stringify(s)===before&&p.emptyBonus===5&&p.exactBonus===2&&p.capacityAfter===22&&p.wear===0);
  T.pay(s,{price:100});assert(s.capacity===22&&s.currentEXP===3&&s.level===1);
  T.add(s,1000,true);const next=T.pay(s,{price:1000});assert(!next.emptied&&next.emptyBonus===0&&s.capacity===24);
});
test('empty-wallet bonus stacks with normal PT growth for banknote change', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:{500:0,100:1,50:0,10:0,5:0,1:0},emptyCapacityBonus:5});s.currentEXP=4;
  T.add(s,100);T.add(s,1000,true);const p=T.pay(s,{price:100});
  assert(!p.exact&&p.emptyBonus===5&&p.earnedEXP===1&&p.levelUps===1&&s.capacity===21&&s.currentEXP===0&&p.wear===0);
});
test('temporary empty wallet while inserting coins does not earn empty bonus', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:{500:0,100:1,50:0,10:0,5:0,1:0},emptyCapacityBonus:5});
  T.add(s,100);assert(T.count(s.wallet)===0);
  const p=T.pay(s,{price:99});assert(!p.emptied&&p.emptyBonus===0&&T.count(s.wallet)===1);
});

test('receipt achievement counters count committed checkouts and reset on new game', () => {
  const config={...WALLET_CONFIG,coins:{500:0,100:1,50:0,10:0,5:0,1:0},emptyCapacityBonus:5};
  const s=T.createGame(config);assert(s.exactCount===0&&s.emptyCount===0);
  T.add(s,100);T.previewPayment(s,{price:100});assert(s.exactCount===0&&s.emptyCount===0);
  T.pay(s,{price:100});assert(s.exactCount===1&&s.emptyCount===1);
  T.add(s,1000,true);T.pay(s,{price:1000});assert(s.exactCount===2&&s.emptyCount===1);
  T.add(s,1000,true);T.pay(s,{price:900});assert(s.exactCount===2&&s.emptyCount===1);
  T.add(s,100);T.add(s,1000,true);T.pay(s,{price:100});assert(s.exactCount===2&&s.emptyCount===2);
  assert(T.pay(s,{price:100})===null&&s.exactCount===2&&s.emptyCount===2);
  const fresh=T.createGame(config);assert(fresh.exactCount===0&&fresh.emptyCount===0);
});

test('capacity breakthrough resets coins and capacity, preserves progress and repeats', () => {
  const s=T.createGame({...WALLET_CONFIG,coins:{500:0,100:1,50:0,10:0,5:0,1:0},maxCoinsCapacity:48,emptyCapacityBonus:5});
  s.currentEXP=3;T.add(s,1000,true);
  const before=JSON.stringify(s),p=T.previewPayment(s,{price:1000});
  assert(JSON.stringify(s)===before&&p.breakthrough&&p.capacityBeforeBreakthrough===50&&p.capacityAfter===20&&p.after===0&&!p.over);
  T.pay(s,{price:1000});
  assert(s.goldCards===1&&s.capacity===20&&T.count(s.wallet)===0&&s.currentEXP===3&&s.total===1000&&s.purchases.length===1);
  assert(s.exactCount===1&&s.emptyCount===0&&s.notes[1000]===null);
  s.capacity=49;T.add(s,1000,true);const next=T.pay(s,{price:1000});
  assert(next.capacityBeforeBreakthrough===51&&s.goldCards===2&&s.capacity===20&&s.total===2000&&!s.over);
  assert(T.createGame(WALLET_CONFIG).goldCards===0);
});
test('below threshold does not reset and PT growth can trigger breakthrough', () => {
  const s=T.createGame({...WALLET_CONFIG,maxCoinsCapacity:47});T.add(s,1000,true);T.pay(s,{price:1000});
  assert(s.capacity===49&&s.goldCards===0&&T.count(s.wallet)===8);
  const full=T.createGame({...WALLET_CONFIG,maxCoinsCapacity:49,coins:{500:0,100:0,50:0,10:0,5:0,1:49},levelCapacityBonus:1});
  full.currentEXP=4;T.add(full,1);T.add(full,1000,true);
  const p=T.pay(full,{price:1});assert(p.breakthrough&&p.after===0&&full.capacity===20&&full.goldCards===1&&!full.over);
});
