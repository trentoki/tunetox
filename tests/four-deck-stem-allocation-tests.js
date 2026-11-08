function runFourDeckStemAllocationTests() {
  let checks = 0;
  const check = (value, message) => { checks++; if (!value) throw new Error(message); };
  const near = (actual, expected) => Math.abs(actual - expected) < 1e-12;
  function fixture() {
    return { decks: [1,2,3,4].map(id => ({ id, volume: 1, requestedLevel: 0.5,
      allocatedLevel: id <= 2 ? 0.5 : 1, active: id <= 2, participating: true, returnEligible: true })),
      enabled: true, relationshipEstablished: true, authorizationCeiling: 1, trigger: 'rebalance' };
  }
  const run = input => {
    const before = JSON.stringify(input);
    const result = calculateFourDeckStemAllocation(input);
    check(JSON.stringify(input) === before, 'Allocator must not mutate input');
    check(Object.isFrozen(result) && Object.isFrozen(result.allocationsByDeck), 'Results must be immutable');
    for (const deck of input.decks) check(result.requestedLevelsByDeck[deck.id] === deck.requestedLevel, 'Requests must survive');
    return result;
  };
  const f = fixture(); f.decks[2].requestedLevel = 1;
  f.trigger = 'preparation'; f.priorityDeckId = 3;
  let r = run(f); check(r.allocationsByDeck[1] === 0.5 && r.allocationsByDeck[2] === 0.5, 'Inactive preparation leaves live mix alone');
  f.decks[2].active = true; f.trigger = 'entry';
  r = run(f); check(r.allocationsByDeck[3] === 1 && r.allocationsByDeck[1] === 0 && r.allocationsByDeck[2] === 0, 'Entry has prepared priority');
  for (const d of f.decks) d.allocatedLevel = r.allocationsByDeck[d.id];
  f.trigger = 'preserve'; delete f.priorityDeckId;
  r = run(f); check(r.activeDeckIds.join(',') === '1,2,3' && r.allocationsByDeck[3] === 1, 'Pause retains membership and allocations');
  f.decks[2].active = false; f.trigger = 'departure';
  r = run(f); check(r.allocationsByDeck[1] === 0.5 && r.allocationsByDeck[2] === 0.5, 'Eject restores requests, not suppressed allocations');
  f.decks[0].requestedLevel = 0.75; f.decks[1].requestedLevel = 0.25;
  r = run(f); check(near(r.allocationsByDeck[1],0.75) && near(r.allocationsByDeck[2],0.25), 'Departure uses latest requests');
  for (let count = 0; count <= 4; count++) {
    const x = fixture(); x.decks.forEach((d,i) => { d.active = i < count; d.allocatedLevel = 0; });
    const out = run(x);
    check(near(out.combinedGain, count ? 1 : 0), 'Zero through four members fill authorized capacity');
    for (const d of x.decks.filter(d => d.active)) check(near(out.allocationsByDeck[d.id],1/count), 'Equal proportional shares');
  }
  const x = fixture(); x.decks.forEach(d => { d.active = true; d.requestedLevel = d.id / 10; d.allocatedLevel = 0; });
  r = run(x); for (const d of x.decks) check(near(r.allocationsByDeck[d.id],d.id/10), 'Four unequal weights');
  const expected = JSON.stringify(r);
  function permutations(items) { return items.length ? items.flatMap((item,i) => permutations(items.filter((_,j)=>i!==j)).map(rest=>[item,...rest])) : [[]]; }
  for (const order of permutations(x.decks)) check(JSON.stringify(run({ ...x, decks: order })) === expected, 'All 24 input orders agree exactly');
  x.trigger = 'directGesture'; x.priorityDeckId = 4; x.decks[3].requestedLevel = 0.7;
  r = run(x); check(r.allocationsByDeck[4] === 0.7 && near(r.allocationsByDeck[1],0.05) && near(r.combinedGain,1), 'Direct priority and proportional remainder');
  x.decks[3].participating = false;
  r = run(x); check(r.status === 'preserved' && r.allocationsByDeck[1] === 0, 'Excluded direct control cannot redistribute');
  const a = fixture(); a.decks[0].allocatedLevel = 0; a.decks[1].allocatedLevel = 0; a.authorizationCeiling = 0.2;
  r = run(a); check(near(r.combinedGain,0.4), 'Authorization can leave a deficit');
  a.authorizationCeiling = null; r = run(a); check(r.combinedGain === 0, 'Null authorization grants no increase');
  a.authorizationCeiling = 1; a.decks[1].returnEligible = false;
  r = run(a); check(r.allocationsByDeck[1] === 1 && r.allocationsByDeck[2] === 0, 'Capped receiver capacity goes to eligible recipient');
  a.decks[1].allocatedLevel = 0.3;
  r = run(a); check(near(r.allocationsByDeck[2],0.3), 'Ineligible existing gain may be retained');
  a.decks[0].volume = 0; a.decks[0].allocatedLevel = 0.8;
  r = run(a); check(r.allocationsByDeck[1] === 0.8 && r.effectiveGainsByDeck[1] === 0, 'Muted fader preserved without division');
  a.decks.forEach(d => { d.requestedLevel = 0; });
  r = run(a); check(r.combinedGain === 0, 'All zero requests never invent weights');
  const b = fixture(); b.decks[0].requestedLevel = 0; b.decks[1].requestedLevel = 0.1;
  r = run(b); check(r.allocationsByDeck[1] === 0 && r.allocationsByDeck[2] === 1, 'Zero weight excluded; established sharing fills beyond positive request');
  b.relationshipEstablished = false;
  r = run(b); check(near(r.combinedGain,0.1), 'Unestablished sharing does not fill beyond requests');
  b.enabled = false; b.trigger = 'directGesture'; b.priorityDeckId = 1; b.decks[0].requestedLevel = 1;
  r = run(b); check(r.allocationsByDeck[1] === 1 && r.allocationsByDeck[2] === 0.5 && r.excess === 0.5, 'Disabled handoff preserves independent controls');
  const c = fixture(); c.decks[0].allocatedLevel = 1; c.decks[1].allocatedLevel = 1;
  r = run(c); check(near(r.combinedGain,1), 'Enabled rebalance removes preexisting excess');
  c.decks[0].volume = 0.2;
  r = run(c); check(r.effectiveGainsByDeck[1] <= 0.2 && near(r.combinedGain,1), 'Physical capacity limits redistribute remainder');
  const entry = fixture(); entry.authorizationCeiling = null; entry.trigger = 'entry'; entry.priorityDeckId = 3;
  entry.decks[2].active = true; entry.decks[2].requestedLevel = 1;
  r = run(entry); check(r.allocationsByDeck[3] === 1 && entry.authorizationCeiling === null, 'Play honors prepared request without granting authorization');
  entry.decks[2].active = false; entry.trigger = 'departure'; delete entry.priorityDeckId;
  entry.decks[0].allocatedLevel = 0; entry.decks[1].allocatedLevel = 0;
  r = run(entry); check(r.combinedGain === 0, 'Play must not authorize later automatic restoration');
  const paused = fixture(); paused.trigger = 'directGesture'; paused.priorityDeckId = 1; paused.decks[0].requestedLevel = 0.8;
  r = run(paused); check(near(r.allocationsByDeck[2],0.2), 'Retained paused member remains a receiver on later gestures');
  paused.priorityDeckId = 3; paused.decks[2].requestedLevel = 0.9;
  r = run(paused); check(r.allocationsByDeck[1] === 0.5 && r.allocationsByDeck[2] === 0.5, 'Inactive direct gesture leaves active allocations alone');
  // Deterministic bounded sweep tests invariants beyond the hand-picked examples.
  for (let seed = 0; seed < 100; seed++) {
    const v = fixture();
    v.authorizationCeiling = (seed % 5) / 4;
    for (const d of v.decks) {
      d.active = (seed + d.id) % 5 !== 0;
      d.volume = ((seed * 3 + d.id) % 5) / 4;
      d.requestedLevel = ((seed + d.id * 2) % 5) / 4;
      d.allocatedLevel = ((seed * 2 + d.id * 3) % 5) / 4;
      d.returnEligible = (seed + d.id) % 3 !== 0;
    }
    const out = run(v);
    check(out.combinedGain <= 1 + 1e-12, 'Rebalanced targets never exceed capacity');
    for (const d of v.decks) {
      const level = out.allocationsByDeck[d.id];
      check(Number.isFinite(level) && level >= 0 && level <= 1, 'Allocations stay finite and physical');
      if (!d.active) check(level === d.allocatedLevel, 'Inactive allocations survive rebalance');
      else check(out.effectiveGainsByDeck[d.id] <= Math.max(d.volume*d.allocatedLevel,
        d.returnEligible ? Math.min(d.volume,v.authorizationCeiling) : 0) + 1e-12, 'Automatic increases respect authorization');
    }
  }
  const invalid = [v=>v.decks.pop(), v=>v.decks[1].id=1, v=>v.decks[0].volume=NaN,
    v=>v.decks[0].requestedLevel=1.1, v=>v.decks[0].allocatedLevel=-1, v=>v.decks[0].active=1,
    v=>v.authorizationCeiling=undefined, v=>v.trigger='queue', v=>v.enabled=null,
    v=>{v.trigger='entry';v.priorityDeckId=4;}, v=>{v.trigger='preparation';v.priorityDeckId=1;}];
  for (const change of invalid) { const v=fixture(); change(v); let rejected=false; try { run(v); } catch (_) { rejected=true; } check(rejected,'Invalid input rejects'); }
  console.log('Four-deck pure allocation tests passed: ' + checks + ' checks; membership, priority, restoration, weights, capacity, authorization, eligibility, order and validation');
}
