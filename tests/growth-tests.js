// Shared by the browser suite and the dependency-free Node runner.
test('5000 notes support finite insertion, individual return and clear', () => {
  const s = T.createGame({...WALLET_CONFIG,notes:{1000:0,5000:1,10000:0}});
  assert(T.add(s,5000,true) && T.paid(s) === 5000 && s.notes[5000] === 0);
  assert(!T.add(s,5000,true)); T.remove(s,0); assert(s.notes[5000] === 1);
  T.add(s,5000,true); T.clear(s); assert(s.notes[5000] === 1 && T.paid(s) === 0);
  T.add(s,5000,true); const r=T.pay(s,{price:5000});
  assert(r.exact && s.notes[5000] === 0 && r.earnedEXP === 0 && s.wearTurns === 0);
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
test('repeated exact payments freeze EXP and wear even when capacity bonus is zero', () => {
  const s=T.createGame({...WALLET_CONFIG,wearInterval:2,exactCapacityBonus:0});s.currentEXP=9;s.wearTurns=1;
  for(let i=0;i<3;i++){T.add(s,1000,true);const p=T.previewPayment(s,{price:1000});T.pay(s,{price:1000});assert(p.earnedEXP===0&&p.wear===0&&s.currentEXP===9&&s.wearTurns===1&&s.capacity===15);}
  T.add(s,1000,true);T.pay(s,{price:999});assert(s.wearTurns===2&&s.capacity===14&&s.purchases.length===4);
});
test('custom growth rules affect threshold, rewards, wear and preview together', () => {
  const config = {...WALLET_CONFIG, wearInterval:2, initialLevelEXP:2, levelCapacityBonus:4, exactCapacityBonus:6};
  const s = T.createGame(config); s.purchases = [{price:1}]; s.wearTurns = 1;
  T.add(s,100); T.add(s,100); T.add(s,5);
  const p = T.previewPayment(s,{price:200}); T.pay(s,{price:200});
  assert(p.earnedEXP === 2 && p.levelCapacityGain === 4 && p.exactBonus === 0 && p.wear === 1);
  assert(s.level === 2 && s.currentEXP === 0 && s.nextLevelEXP === 2 && s.capacity === 18 && s.capacity === p.capacityAfter);
  config.levelCapacityBonus = 99; assert(s.rules.levelCapacityBonus === 4);
});
test('fixed thresholds and zero capacity bonuses are supported', () => {
  const s = T.createGame({...WALLET_CONFIG,initialLevelEXP:1,levelCapacityBonus:0,exactCapacityBonus:0});
  T.add(s,100); T.add(s,100); T.add(s,5); T.pay(s,{price:200});
  assert(s.level === 3 && s.nextLevelEXP === 1 && s.currentEXP === 0 && s.capacity === 15);
});
test('invalid and missing growth settings are rejected with their field name', () => {
  for(const [key,minimum] of Object.entries({wearInterval:1,initialLevelEXP:1,levelCapacityBonus:0,exactCapacityBonus:0})) {
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
  assert(s.level === 1 && s.currentEXP === 0 && s.nextLevelEXP === configuredWallet.initialLevelEXP);
  for(const key of ['wearInterval','initialLevelEXP','levelCapacityBonus','exactCapacityBonus']) assert(s.rules[key] === configuredWallet[key]);
});
test('net reduction earns points even with change and coins left', () => {
  const s = T.createGame(); T.add(s,100); T.add(s,100); T.add(s,5);
  const r = T.pay(s,{price:200});
  assert(r.earnedEXP === 2 && s.currentEXP === 2 && T.count(s.wallet) === 6);
  assert(r.exactBonus === 0 && s.capacity === 15);
});
test('returned tray coins and insufficient payment never award points or turns', () => {
  const s = T.createGame(); T.add(s,100); T.remove(s,0);
  assert(T.pay(s,{price:200}) === null);
  T.add(s,100); T.clear(s);
  assert(s.currentEXP === 0 && s.purchases.length === 0 && s.capacity === 15);
});
test('level threshold consumes points, carries remainder and adds capacity', () => {
  const s = T.createGame(); s.currentEXP = 9;
  T.add(s,100); T.add(s,100); T.add(s,5);
  const before = JSON.stringify(s), p = T.previewPayment(s,{price:200});
  assert(JSON.stringify(s) === before && p.earnedEXP === 2 && p.capacityAfter === 16);
  T.pay(s,{price:200});
  assert(s.level === 2 && s.currentEXP === 1 && s.nextLevelEXP === 10 && s.capacity === 16);
});
test('one payment can earn multiple levels without losing points', () => {
  const s = T.createGame({...WALLET_CONFIG,coins:{500:0,100:0,50:0,10:0,5:0,1:40},notes:{5000:null,1000:null,10000:null},maxCoinsCapacity:40});
  while(s.wallet[1]) T.add(s,1);
  T.add(s,1000,true);
  const r = T.pay(s,{price:540}); // Return one 500-yen coin: net reduction 39.
  assert(r.earnedEXP === 39 && r.levelUps === 3 && s.level === 4);
  assert(s.currentEXP === 9 && s.nextLevelEXP === 10 && s.capacity === 43);
});
test('exact payment rewards capacity even when wallet is not empty', () => {
  const s = T.createGame(); T.add(s,100); T.add(s,100);
  const r = T.pay(s,{price:200});
  assert(T.count(s.wallet) === 6 && r.exactBonus === 2 && s.capacity === 17 && s.currentEXP === 0 && s.wearTurns === 0);
});
test('banknote-only change and an empty wallet do not give exact bonus', () => {
  const s = T.createGame(); s.wallet = T.changeCoins(0); T.add(s,10000,true);
  const r = T.pay(s,{price:9000});
  assert(r.changeCount === 0 && r.change === 1000 && !r.upgraded && s.capacity === 15 && s.currentEXP === 0);
});
test('wear occurs on completed turns five and ten, never on preview', () => {
  const s = T.createGame();
  for(let turn=1;turn<=10;turn++) {
    s.wallet = T.changeCoins(0); T.add(s,1000,true);
    const before = JSON.stringify(s), p = T.previewPayment(s,{price:999});
    assert(JSON.stringify(s) === before && p.wear === (turn % 5 === 0 ? 1 : 0));
    T.pay(s,{price:999}); assert(s.capacity === 15 - Math.floor(turn/5));
  }
});
test('wear stops at ten and preserves configured capacities below ten', () => {
  for(const capacity of [9,10,11]) {
    const s = T.createGame({...WALLET_CONFIG,maxCoinsCapacity:capacity});
    s.purchases = Array(4).fill({price:1}); s.wearTurns = 4; s.wallet = T.changeCoins(0); T.add(s,1000,true);
    T.pay(s,{price:999}); assert(s.capacity === (capacity > 10 ? capacity-1 : capacity));
  }
});
test('exact bonus skips points and wear even at a pending wear boundary', () => {
  const s = T.createGame(); s.currentEXP = 9; s.purchases = Array(4).fill({price:1}); s.wearTurns = 4;
  T.add(s,100); T.add(s,100);
  const p = T.previewPayment(s,{price:200}); T.pay(s,{price:200});
  assert(p.levelUps === 0 && p.earnedEXP === 0 && p.exactBonus === 2 && p.wear === 0 && p.capacityAfter === 17);
  assert(s.capacity === p.capacityAfter && s.currentEXP === 9 && s.wearTurns === 4 && s.level === 1 && !s.over);
  T.add(s,1000,true); const next = T.pay(s,{price:999});
  assert(next.wear === 1 && s.wearTurns === 5 && s.capacity === 16);
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
    const s = T.createGame(); s.currentEXP = 9; s.purchases = Array(4).fill({price:1}); s.wearTurns = 4;
    T.add(s,100); T.add(s,100); T.add(s,5); T.add(s,1000,true);
    const p = T.previewPayment(s,{price}); T.pay(s,{price});
    assert(s.currentEXP === p.currentEXP && s.nextLevelEXP === p.nextLevelEXP && s.level === p.level);
    assert(s.capacity === p.capacityAfter && s.over === p.over && T.count(s.wallet) === p.after);
  }
});
