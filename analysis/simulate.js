// Loaded after wallet-config.js, products.js and game.js. No browser UI or rule reimplementation.
globalThis.simulate = function(runs = 2000, maxTurns = 1000) {
  const G = CoinGame, values = G.denominations;
  if (G.noteDenominations.some(v => WALLET_CONFIG.notes[v] !== null)) throw Error('These policies require unlimited notes.');
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const changeCount = Array.from({length:1000}, (_,n)=>G.count(G.changeCoins(n)));
  function smart(state, product) {
    const totalValue = values.reduce((n,v)=>n+v*state.wallet[v],0);
    // For each payable coin total, find the largest number of coins spent.
    // All smaller-count combinations of the same value have no better immediate headroom.
    let dp = new Int16Array(totalValue+1).fill(-1); dp[0]=0;
    const layers=[];
    for(const v of values) {
      const next = new Int16Array(totalValue+1).fill(-1), choices=new Int16Array(totalValue+1).fill(-1);
      for(let sum=0;sum<=totalValue;sum++) if(dp[sum]>=0) {
        for(let k=0;k<=state.wallet[v] && sum+k*v<=totalValue;k++) {
          const target=sum+k*v, count=dp[sum]+k;
          if(count>next[target]) {next[target]=count;choices[target]=k;}
        }
      }
      dp=next;layers.push(choices);
    }
    const held=G.count(state.wallet);
    let best=null;
    for(let sum=0;sum<=totalValue;sum++) if(dp[sum]>=0) {
      const notes=Math.max(0,Math.ceil((product.price-sum)/1000));
      const change=sum+notes*1000-product.price, exact=change===0;
      const returned=changeCount[change%1000], earned=exact?0:Math.max(0,dp[sum]-returned);
      const bonus=exact?state.rules.exactCapacityBonus:(state.currentEXP+earned>=state.nextLevelEXP?state.rules.levelCapacityBonus:0);
      const cap=state.capacity+bonus-(bonus>0?0:1), after=held-dp[sum]+returned;
      const remaining=exact?state.currentEXP:(state.currentEXP+earned>=state.nextLevelEXP?0:state.currentEXP+earned);
      // Survive first, then maximize immediate free slots, capacity, remaining PT,
      // and minimize overpayment. This is a one-turn policy, not a global optimum.
      const key=[Number(cap>0&&after<=cap),cap-after,cap,remaining,-change,-sum];
      if(!best || key.some((n,i)=>n!==best.key[i]&&key.slice(0,i).every((x,j)=>x===best.key[j])&&n>best.key[i])) best={key,sum,notes,cap,after};
    }
    let sum=best.sum;
    const quantities=Array(6).fill(0);
    for(let i=5;i>=0;i--) {const k=layers[i][sum]; quantities[i]=k;sum-=k*values[i];}
    quantities.forEach((n,i)=>{for(let k=0;k<n;k++) if(!G.add(state,values[i]))throw Error('Coin insertion failed');});
    for(let k=0;k<best.notes;k++)G.add(state,1000,true);
    const preview=G.previewPayment(state,product);
    if(preview.capacityAfter!==best.cap || preview.after!==best.after)throw Error('Policy forecast mismatch');
  }
  const data=[];
  for(const policy of ['smart']) for(let run=0;run<runs;run++) {
    const seed=20260908+run, random=rng(seed), state=G.createGame();
    let product=G.generateProduct(G.products[0],0,random),bag=[],exactCount=0,levelUps=0;
    while(!state.over && state.purchases.length<maxTurns) {
      if(policy==='smart')smart(state,product);
      else for(let k=0;k<Math.ceil(product.price/1000);k++)G.add(state,1000,true);
      const result=G.pay(state,product);
      if(!result)throw Error('Invalid payment');
      exactCount+=Number(result.exact);levelUps+=result.levelUps;
      if(state.over || state.purchases.length>=maxTurns)break;
      // Same six-item bag and adjacent-duplicate handling as app.js.
      // Random comparator follows the current app; sort behavior can vary by JS engine.
      if(!bag.length)bag=[...G.products].sort(()=>random()-.5);
      if(bag.length>1&&bag[bag.length-1].name===product.name)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];
      product=G.generateProduct(bag.pop(),state.purchases.length,random);
    }
    data.push({policy,seed,turns:state.purchases.length,total:state.total,over:state.over,capacity:state.capacity,coins:G.count(state.wallet),exactCount,levelUps,cause:state.over?(state.capacity<=0?'zero_capacity':'coin_overflow'):'censored'});
  }
  return {config:WALLET_CONFIG,runs,maxTurns,seed:20260908,data};
};
