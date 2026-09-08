(function (root) {
  'use strict';
  const LEVEL_EXP = 5;
  const denominations = [500, 100, 50, 10, 5, 1];
  const products = root.PRODUCT_CATALOG;
  if (!Array.isArray(products) || !products.length) throw new Error('products.js: 商品リストがありません。');
  const productNames = new Set();
  for (const product of products) {
    if (!product || ['name', 'emoji', 'category', 'description', 'color'].some(key => typeof product[key] !== 'string' || !product[key].trim()) ||
        !Number.isSafeInteger(product.price) || product.price < 1 || product.price > Number.MAX_SAFE_INTEGER - 1000 ||
        !['シュール', '日常'].includes(product.category) || !/^#[0-9a-f]{6}$/i.test(product.color) || productNames.has(product.name)) {
      throw new Error('products.js: 商品の必須項目・価格・分類・色・名前の重複を確認してください。');
    }
    productNames.add(product.name);
  }
  function changeCoins(amount) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid change');
    // Return whole thousands as banknotes; only the remainder enters the coin wallet.
    amount %= 1000;
    const coins = {};
    for (const value of denominations) { coins[value] = Math.floor(amount / value); amount %= value; }
    return coins;
  }
  const count = coins => denominations.reduce((sum, v) => sum + coins[v], 0);
  const noteDenominations = [10000, 5000, 1000];
  function createGame(config = root.WALLET_CONFIG) {
    const fail = message => { throw new Error(`wallet-config.js: ${message}`); };
    if (!config || typeof config !== 'object') fail('財布の設定がありません。');
    for (const [key, values] of [['coins', denominations], ['notes', noteDenominations]]) {
      if (!config[key] || typeof config[key] !== 'object') fail(`${key}を指定してください。`);
      if (Object.keys(config[key]).some(value => !values.includes(Number(value)))) fail(`${key}に未対応の額面があります。`);
      for (const value of values) {
        const n = config[key][value];
        if (key === 'notes' && n === null) continue;
        if (!Number.isSafeInteger(n) || n < 0) fail(`${key}.${value}は0以上の整数${key === 'notes' ? 'またはnull' : ''}にしてください。`);
      }
    }
    const capacity = config.maxCoinsCapacity;
    if (!Number.isSafeInteger(capacity) || capacity < 1) fail('maxCoinsCapacityは1以上の整数にしてください。');
    if (count(config.coins) > capacity) fail('初期硬貨の合計枚数が上限を超えています。');
    const rules = {};
    for (const [key, minimum] of Object.entries({levelCapacityBonus:0, exactCapacityBonus:0})) {
      if (!Number.isSafeInteger(config[key]) || config[key] < minimum) fail(`${key}は${minimum}以上の整数にしてください。`);
      rules[key] = config[key];
    }
    return {wallet:{...config.coins}, notes:{...config.notes}, capacity, tray:[], total:0, purchases:[], over:false,
      level:1, currentEXP:0, nextLevelEXP:LEVEL_EXP, wearTurns:0, rules};
  }
  function changeNotes(amount) {
    const notes = {};
    for (const value of noteDenominations) { notes[value] = Math.floor(amount / value); amount %= value; }
    return notes;
  }
  // Unlimited 1,000-yen notes make this the minimum notes-only payment.
  function riskLevel(price) {
    const changeCount = count(changeCoins(Math.ceil(price / 1000) * 1000 - price));
    return Math.max(1, Math.ceil(changeCount / 3));
  }
  function riskWeights(purchasedCount) {
    return purchasedCount < 3 ? [60, 30, 10, 0, 0]
      : purchasedCount < 10 ? [10, 30, 40, 20, 0] : [5, 15, 30, 35, 15];
  }
  function selectRiskLevel(purchasedCount, random = Math.random) {
    let roll = random() * 100;
    const weights = riskWeights(purchasedCount);
    for (let i = 0; i < weights.length; i++) {
      if (roll < weights[i]) return i + 1;
      roll -= weights[i];
    }
    return 5;
  }
  const pricePools = Array.from({length: 5}, () => []);
  for (let price = 1; price <= 1000; price++) pricePools[riskLevel(price) - 1].push(price);
  function generateProduct(product, purchasedCount, random = Math.random) {
    const level = selectRiskLevel(purchasedCount, random);
    const pool = pricePools[level - 1];
    // Keep each product in its original thousand-yen price band; never mutate a receipt item.
    const price = Math.floor(product.price / 1000) * 1000 + pool[Math.floor(random() * pool.length)];
    return {...product, price, riskLevel: level};
  }
  const paid = state => state.tray.reduce((sum, money) => sum + money.value, 0);
  function add(state, value, note = false) {
    if (state.over || (note ? !noteDenominations.includes(value) : !denominations.includes(value))) return false;
    const holdings = note ? state.notes : state.wallet;
    if (holdings[value] === 0) return false;
    if (holdings[value] !== null) holdings[value]--;
    state.tray.push({value, note}); return true;
  }
  function remove(state, index) {
    if (state.over || index < 0 || index >= state.tray.length) return;
    const [money] = state.tray.splice(index, 1);
    const holdings = money.note ? state.notes : state.wallet;
    if (holdings[money.value] !== null) holdings[money.value]++;
  }
  function clear(state) { while (!state.over && state.tray.length) remove(state, state.tray.length - 1); }
  function previewPayment(state, product) {
    if (state.over || paid(state) < product.price) return null;
    const change = paid(state) - product.price;
    const returned = changeCoins(change);
    const spentCoins = state.tray.filter(money => !money.note).length;
    const changeCount = count(returned);
    const after = count(state.wallet) + changeCount;
    // Coins in the tray still belong to the pre-payment wallet.
    const exact = change === 0;
    const earnedEXP = exact ? 0 : Math.max(0, spentCoins - changeCount);
    let currentEXP = state.currentEXP + earnedEXP;
    const nextLevelEXP = LEVEL_EXP;
    let level = state.level, levelUps = 0;
    if (!exact && currentEXP >= nextLevelEXP) {
      currentEXP = 0;
      level++; levelUps++;
    }
    const exactBonus = exact ? state.rules.exactCapacityBonus : 0;
    const levelCapacityGain = levelUps * state.rules.levelCapacityBonus;
    const turn = state.purchases.length + 1;
    const wearTurns = state.wearTurns + 1;
    const grownCapacity = state.capacity + levelCapacityGain + exactBonus;
    // Capacity growth protects the wallet from wear for this checkout.
    const wear = levelCapacityGain > 0 || exactBonus > 0 ? 0 : 1;
    const capacityAfter = grownCapacity - wear;
    return {change, returned, returnedNotes: changeNotes(change), banknoteAmount: change - change % 1000, changeCount, delta: changeCount - spentCoins,
      after, exact, earnedEXP, currentEXP, nextLevelEXP, level, levelUps, levelCapacityGain, exactBonus, wear, wearTurns, turn, capacityAfter,
      upgraded: levelUps > 0 || exactBonus > 0, over: capacityAfter <= 0 || after > capacityAfter};
  }
  function pay(state, product) {
    const preview = previewPayment(state, product);
    if (!preview) return null;
    const {returned, over} = preview;
    for (const value of denominations) state.wallet[value] += returned[value];
    for (const value of noteDenominations) {
      if (state.notes[value] !== null) state.notes[value] += preview.returnedNotes[value];
    }
    state.tray = []; state.total += product.price; state.purchases.push(product);
    state.capacity = preview.capacityAfter;
    state.currentEXP = preview.currentEXP; state.nextLevelEXP = preview.nextLevelEXP; state.level = preview.level;
    state.wearTurns = preview.wearTurns;
    state.over = over;
    return preview;
  }
  root.CoinGame = { denominations, products, changeCoins, count, createGame, paid, add, remove, clear, pay,
    riskLevel, riskWeights, selectRiskLevel, generateProduct, previewPayment, noteDenominations, changeNotes };
})(globalThis);
