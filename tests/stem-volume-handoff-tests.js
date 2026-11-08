function runStemVolumeHandoffTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const near = (a,b) => Math.abs(a-b) < 1e-12;
  function fixture(count = 2) {
    const model = { decks: [1,2,3,4].map(createDeck), participation: createParticipationState(), stemSession: createStemSessionState() };
    const participation = createParticipationActions(model);
    for (let id=count+1; id<=4; id++) participation.set(id,'stemHandoff',false);
    const actions = createStemActions(model);
    // Explicit gestures introduce Deck 2 stems while muted; no initial authorization.
    for (const category of stemCategories) actions.setStemLevel(2,category,1,'introduce-'+category);
    model.decks[0].volume=0.6; model.decks[1].volume=0.2;
    return { model, actions, participation };
  }
  const f=fixture();
  const own=f.model.decks[1].stems, requested=f.model.decks[0].stems.requestedLevels;
  for (const [volume,otherGain,sharing] of [[0.3,0.6,false],[0.4,0.6,true],[0.5,0.5,true],[0.2,0.5,true],[0.7,0.3,true],[1,0,true],[0,0.6,true],[0.5,0.5,true]]) {
    f.actions.setDeckVolume(2,volume,'volume-'+volume);
    check(f.model.decks[1].stems===own && f.model.decks[1].volume===volume,'Volume gesture must leave its own stems unchanged');
    for (const category of stemCategories) {
      check(near(f.model.decks[0].volume*f.model.decks[0].stems.allocatedLevels[category],otherGain),'Volume sequence respects capacity and authorization');
      check(!!f.model.stemSession.relationshipsByStem[category]===sharing,'Category sharing latches persist through reversals and zero');
    }
    check(f.model.decks[0].volume===0.6 && f.model.decks[0].stems.requestedLevels===requested,'Receiver volume and human requests remain unchanged');
    check(f.model.stemSession.lastChange.origin==='direct' && f.model.stemSession.lastChange.controlId==='deck.2.volume','Only main-volume gesture owns provenance');
  }
  // Independent category evaluation: zero stays inactive; fractional levels use effective gain.
  const mixed=fixture();
  mixed.actions.setStemLevel(2,'voice',0,'silence-voice');
  mixed.actions.setStemLevel(2,'flow',0.5,'half-flow');
  const oldVoice=mixed.model.decks[0].stems.allocatedLevels.voice;
  mixed.actions.setDeckVolume(2,0.8,'mixed-volume');
  check(!mixed.model.stemSession.lastChange.handoffByStem.voice && mixed.model.decks[0].stems.allocatedLevels.voice===oldVoice,
    'Zero stem effective gain never invokes redistribution');
  check(near(mixed.model.stemSession.authorization.ceilingsByStem.flow,0.4) && mixed.model.stemSession.authorization.ceilingsByStem.voice===null,
    'Deck-wide authorization uses each allocated level, not requested intent or automatic receiver output');
  check(near(mixed.model.decks[0].stems.allocatedLevels.transients,1/3) && mixed.model.decks[0].stems.allocatedLevels.flow===1,
    'Each category applies its own complementary target');
  mixed.actions.setDeckVolume(2,0.8,'unchanged-volume');
  check(!mixed.model.stemSession.lastChange.handoffByStem,'Same volume must not redistribute');

  const constrained=fixture();
  constrained.actions.setDeckVolume(2,1,'establish-all');
  constrained.model.stemSession=Object.freeze({...constrained.model.stemSession,authorization:Object.freeze({ceilingsByStem:Object.freeze({transients:0.3,flow:0.3,tune:0.3,voice:0.3})})});
  constrained.actions.setDeckVolume(2,0.1,'limited-return');
  check(near(constrained.model.decks[0].stems.allocatedLevels.flow,0.5) && near(constrained.model.stemSession.lastChange.handoffByStem.flow.deficit,0.6),
    'Automatic return respects global authorization and reports deficit');
  constrained.model.decks[0].volume=0;
  const mutedStems=constrained.model.decks[0].stems;
  constrained.actions.setDeckVolume(2,0.2,'muted-receiver');
  check(constrained.model.decks[0].stems===mutedStems,'Muted receiver retains its stem positions');

  for (const count of [1,3,4]) {
    const many=fixture(count), before=many.model.decks[0].stems;
    many.actions.setDeckVolume(2,0.8,'unsupported-pair');
    check(many.model.decks[0].stems===before && !many.model.stemSession.lastChange.handoffByStem,'Unsupported count or excluded actor stays direct-only');
  }
  const suspended=fixture(), before=suspended.model.decks[0].stems;
  createAutomaticStemHandoffActions(suspended.model).set(false);
  suspended.actions.setDeckVolume(2,0.9,'suspended');
  check(suspended.model.decks[0].stems===before && suspended.model.stemSession.authorization.ceilingsByStem.flow===null,'Suspension prevents redistribution and authorization');

  const atomic=fixture(), snapshot=JSON.stringify(atomic.model), session=atomic.model.stemSession;
  const original=calculateTwoDeckStemHandoff; let calls=0, failed=false;
  try {
    calculateTwoDeckStemHandoff=input=>{ if (++calls===3) throw new Error('third category fails'); return original(input); };
    atomic.actions.setDeckVolume(2,0.8,'rollback-all');
  } catch (_) { failed=true; } finally { calculateTwoDeckStemHandoff=original; }
  check(failed && calls===3 && JSON.stringify(atomic.model)===snapshot && atomic.model.stemSession===session,
    'Later-category exception rolls back volume, all allocations, authorization, relationships and provenance');
  const reversed=fixture();
  reversed.actions.setDeckVolume(2,1,'establish-before-alternating');
  // Manually restore a positive direct allocation; volume must use allocated, not requested.
  reversed.actions.setStemLevel(1,'flow',0.5,'restore-direct-stem');
  const controlledStems=reversed.model.decks[0].stems;
  reversed.actions.setDeckVolume(1,0.4,'alternate-volume-actor');
  check(reversed.model.decks[0].stems===controlledStems && near(reversed.model.decks[1].stems.allocatedLevels.flow,0.8),
    'Either deck can drive volume handoff without modifying its own allocated stem');
  const invalidBefore=JSON.stringify(reversed.model);
  try { reversed.actions.setDeckVolume(1,NaN,'invalid-volume'); } catch (_) {}
  check(JSON.stringify(reversed.model)===invalidBefore,'Invalid volume input must fully roll back');
  const pureInput={decks:[1,2,3,4].map(id=>({id,volume:id===2?0.2:1,allocatedLevel:id===1?0.6:1,
    participating:id<=2,returnEligible:true})),directDeckId:2,directStemLevel:1,directVolume:0.5,
    authorizationCeiling:1,relationshipEstablished:false,trigger:'directGesture'};
  const pureBefore=JSON.stringify(pureInput), pureResult=calculateTwoDeckStemHandoff(pureInput);
  check(near(pureResult.effectiveGainsByDeck[1],0.5) && pureResult.relationshipEstablished && JSON.stringify(pureInput)===pureBefore,
    'Optional volume target must preserve calculator purity and detect the real upward crossing');
  const preserved=calculateTwoDeckStemHandoff({...pureInput,trigger:'participationChange'});
  check(preserved.allocationsByDeck[1]===0.6 && preserved.effectiveGainsByDeck[2]===0.2,
    'Participation proposals must ignore a proposed volume and preserve original effective gains');
  let invalidTarget=false;
  try { calculateTwoDeckStemHandoff({...pureInput,directVolume:2}); } catch (_) { invalidTarget=true; }
  check(invalidTarget,'Optional calculator volume must be validated');
  const ineligible=fixture();
  ineligible.model.stemSession=Object.freeze({...ineligible.model.stemSession,eligibilityByDeck:Object.freeze({...ineligible.model.stemSession.eligibilityByDeck,1:Object.freeze({transients:false,flow:false,tune:false,voice:false})})});
  ineligible.actions.setDeckVolume(2,1,'suppress-ineligible');
  ineligible.actions.setDeckVolume(2,0.1,'no-ineligible-return');
  check(ineligible.model.decks[0].stems.allocatedLevels.flow===0,'Authorization cannot introduce an ineligible receiver');
  console.log('Main-volume two-deck handoff tests passed: independent categories, capacity, reversals, authorization, suspension and atomic rollback');
}
