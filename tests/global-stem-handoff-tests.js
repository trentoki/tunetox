function runGlobalStemHandoffTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const near = (a,b) => Math.abs(a-b) < 1e-12;
  function fixture() {
    const model = { decks:[1,2,3,4].map(createDeck), participation:createParticipationState(), stemSession:createStemSessionState(), interfaceMode:'twoDeck' };
    const participation = createParticipationActions(model);
    participation.set(3,'stemHandoff',false); participation.set(4,'stemHandoff',false);
    return { model, participation, stems:createStemActions(model), global:createAutomaticStemHandoffActions(model) };
  }
  function level(f,id,value) { const d=f.model.decks[id-1]; d.volume=1;
    d.stems=Object.freeze({ requestedLevels:Object.freeze({...d.stems.requestedLevels,flow:value}), allocatedLevels:Object.freeze({...d.stems.allocatedLevels,flow:value}) }); }
  function establish(f) { f.model.stemSession=Object.freeze({...f.model.stemSession,
    relationshipsByStem:Object.freeze({...f.model.stemSession.relationshipsByStem,flow:Object.freeze({deckIds:Object.freeze([1,2]),established:true})}) }); }
  const f=fixture();
  check(f.global.get() && f.global.controlId==='global.stemHandoff.enabled', 'Default ON and stable control ID required');
  const start=f.model.stemSession, decks=JSON.stringify(f.model.decks), participation=f.model.participation;
  check(f.global.set(false) && !f.global.set(false), 'Boolean setting and idempotent set required');
  for(const key of ['authorization','eligibilityByDeck','relationshipsByStem','lastChange']) check(f.model.stemSession[key]===start[key], 'Toggle must preserve session records');
  check(JSON.stringify(f.model.decks)===decks && f.model.participation===participation, 'Toggle cannot touch controls or participation');
  f.model.interfaceMode='fourDeck'; check(!f.global.get(), 'View changes must not reset preference');
  const second=createAutomaticStemHandoffActions(f.model);
  second.dispatch({type:'stemHandoff.toggle',controlId:'global.stemHandoff.enabled'});
  check(f.global.get(), 'Shared adapters must read one permission state');
  const beforeInvalid=JSON.stringify(f.model);
  for(const attempt of [()=>f.global.set('false'),()=>f.global.set(0),()=>f.global.dispatch(null),
    ()=>f.global.dispatch({type:'stemHandoff.set',controlId:'wrong',value:false}),
    ()=>f.global.dispatch({type:'other',controlId:f.global.controlId})]) {
    let rejected=false;try{attempt();}catch(_){rejected=true;}check(rejected && JSON.stringify(f.model)===beforeInvalid,'Invalid setting input must reject without changes');
  }
  level(f,1,0.6);level(f,2,0.2);
  f.global.set(false);
  const noAuthorization=f.model.stemSession.authorization;
  f.stems.setStemLevel(2,'flow',0.5,'off-new-sharing');
  check(f.model.decks[0].stems.allocatedLevels.flow===0.6 && f.model.stemSession.relationshipsByStem.flow===null &&
    f.model.stemSession.authorization===noAuthorization && f.model.stemSession.eligibilityByDeck[2].flow,
    'OFF gestures retain independent controls/eligibility without new latches or authorization');
  f.stems.setDeckVolume(2,0.9,'off-volume');
  check(f.model.stemSession.authorization===noAuthorization,'OFF main-volume gestures cannot authorize');
  const beforeOn=JSON.stringify(f.model.decks), offProvenance=f.model.stemSession.lastChange;
  f.global.set(true);
  check(JSON.stringify(f.model.decks)===beforeOn && f.model.stemSession.lastChange===offProvenance &&
    f.model.stemSession.authorization===noAuthorization,'ON cannot normalize, authorize or create provenance');

  const active=fixture();level(active,1,0.5);level(active,2,0.5);establish(active);
  const latch=active.model.stemSession.relationshipsByStem.flow;
  active.global.set(false);
  active.stems.setStemLevel(1,'flow',0.8,'off-one');active.stems.setStemLevel(2,'flow',0.6,'off-two');
  check(active.model.stemSession.relationshipsByStem.flow===latch,'OFF must retain established latches across manual gestures');
  const beforeResume=JSON.stringify(active.model.decks), lastHuman=active.model.stemSession.lastChange;
  active.global.set(true);
  check(JSON.stringify(active.model.decks)===beforeResume && active.model.stemSession.lastChange===lastHuman,'ON preserves above-unity values until a real gesture');
  active.stems.setStemLevel(2,'flow',0.65,'resume-above-unity');
  check(near(active.model.decks[0].stems.allocatedLevels.flow,0.35) && active.model.decks[1].stems.requestedLevels.flow===0.65 &&
    active.model.decks[0].stems.requestedLevels.flow===0.8,'Valid above-unity calculator reduction is accepted without a new convergence rule');
  active.stems.setStemLevel(2,'flow',0.1,'constrained-resume');
  check(active.model.stemSession.lastChange.handoff.status==='constrained' && near(active.model.decks[0].stems.allocatedLevels.flow,0.65),
    'Valid constrained results must apply and report deficit');
  active.global.set(false);
  const preserved=JSON.stringify(active.model.decks), authorization=active.model.stemSession.authorization;
  active.participation.set(2,'stemHandoff',false);
  check(active.model.stemSession.relationshipsByStem.flow===null && JSON.stringify(active.model.decks)===preserved &&
    active.model.stemSession.authorization===authorization,'Explicit participation disable still clears the latch while suspended');

  const rejected=fixture();level(rejected,1,0.6);level(rejected,2,0.2);
  const calculator=calculateTwoDeckStemHandoff;
  const originalReceiver=rejected.model.decks[0].stems;
  try {
    calculateTwoDeckStemHandoff=input=>{
      const good=calculator(input);
      return {...good,allocationsByDeck:{...good.allocationsByDeck,1:NaN}};
    };
    rejected.stems.setStemLevel(2,'flow',0.5,'rejected-proposal');
  } finally { calculateTwoDeckStemHandoff=calculator; }
  check(rejected.model.decks[0].stems===originalReceiver && rejected.model.decks[1].stems.requestedLevels.flow===0.5 &&
    rejected.model.decks[1].stems.allocatedLevels.flow===0.5 && rejected.model.stemSession.lastChange.gestureId==='rejected-proposal' &&
    rejected.model.stemSession.authorization.ceilingsByStem.flow===0.5 && rejected.model.stemSession.lastChange.handoffRejection,
    'Returned invalid proposal uses explicit direct-only metadata commit, never another allocation');

  const base={decks:[1,2,3,4].map(id=>({id,volume:1,allocatedLevel:id===1?0.6:0.2,participating:id<=2,returnEligible:true})),
    directDeckId:2,directStemLevel:0.5,authorizationCeiling:1,relationshipEstablished:true,trigger:'directGesture'};
  const good=calculator(base);
  check(assessStemHandoffProposal(base,good).accepted,'Normal result must pass acceptance');
  const faults=[null,{...good,targetGain:2},{...good,allocationsByDeck:{...good.allocationsByDeck,2:0.1}},
    {...good,allocationsByDeck:{...good.allocationsByDeck,4:0.3}},
    {...good,effectiveGainsByDeck:{...good.effectiveGainsByDeck,1:Infinity}},
    {...good,combinedGain:0.2},{...good,deficit:-1e-13},{...good,deficit:0.4},{...good,relationshipEstablished:false},
    {...good,allocationsByDeck:{...good.allocationsByDeck,5:0}}];
  for(const bad of faults) check(!assessStemHandoffProposal(base,bad).accepted,'Contract violations must reject deterministically');
  const avoidable={...good,allocationsByDeck:{...good.allocationsByDeck,1:0.4},
    effectiveGainsByDeck:{...good.effectiveGainsByDeck,1:0.4},combinedGain:0.9,deficit:0.1,status:'constrained'};
  check(!assessStemHandoffProposal(base,avoidable).accepted,'A constrained label cannot excuse an avoidable deficit');
  const limitedInput={...base,authorizationCeiling:0.3,decks:base.decks.map(d=>d.id===1?{...d,allocatedLevel:0}:d)};
  check(assessStemHandoffProposal(limitedInput,calculator(limitedInput)).accepted,'Capacity-constrained deficit is not a rejection');
  const unauthorized={...good,allocationsByDeck:{...good.allocationsByDeck,1:0.5},effectiveGainsByDeck:{...good.effectiveGainsByDeck,1:0.5}};
  check(!assessStemHandoffProposal(limitedInput,unauthorized).accepted,'Unauthorized increase must reject');
  check(createStemSessionState().automaticHandoffEnabled && appActions.stemHandoff.get(),'Fresh sessions and real app default to ON');
  console.log('Global handoff permission tests passed: toggles, suspension, preserved latches, re-enable, above-unity, proposal rejection and constrained acceptance');
}
