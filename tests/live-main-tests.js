// Actual native automation events on deterministic clocks. No audible-output claim.
async function runLiveMainTests() {
  let checks=0, maximum=0;
  function check(value,label){checks++;if(!value)throw new Error(label);}
  const near=(a,b)=>Math.abs(a-b)<1e-9;
  function gain(f,id,time,name='flow') {
    const stem=prototypeStemNames.indexOf(name), base=(id-1)*6;
    return stemSchedulingValueAt(f.gains[base+stem].events,time)*stemSchedulingValueAt(f.gains[base+4].events,time)*stemSchedulingValueAt(f.gains[base+5].events,time);
  }
  function scan(f,from,to,members=[1,2],limit=1){
    for(let frame=0;frame<=Math.ceil((to-from)*48000);frame++){
      const time=from+frame/48000;
      for(const name of prototypeStemNames){
        const sum=members.reduce((s,id)=>s+gain(f,id,time,name),0);maximum=Math.max(maximum,sum);
        check(sum>=-1e-9 && sum<=limit+1e-9,'Continuous effective gain respects cohort bound '+sum);
      }
    }
  }
  async function fixture(parts=[true,true], count=2){
    const f=createStemSchedulingFixture();
    f.state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
    for(const id of [1,2,3,4])createParticipationActions(f.state).set(id,'stemHandoff',id<=count && parts[id-1]);
    f.actions=createNativeStemHandoffActions(f.state,f.mixer);
    for(let id=1;id<=count;id++){
      for(const name of prototypeStemNames)f.actions.setStemLevel(id,name,name==='flow'?.5:0,'prepare-stem');
      f.actions.setMainVolume(id,1,'prepare-main');await f.load(id);
    }
    await f.actions.play(1);f.audio.currentTime=.1;
    if(count===2)await f.actions.play(2);f.audio.currentTime=.2;
    return f;
  }
  for(const parts of [[true,true],[true,false],[false,true],[false,false]]){
    const f=await fixture(parts), members=[1,2].filter(id=>parts[id-1]);
    for(let step=0;step<40;step++){
      const now=.2+step*.003;scan(f,now-.003,now,members);
      f.audio.currentTime=now;
      const id=step%2+1,value=[0,.2,.8,1][step%4];
      const otherBefore=JSON.stringify(f.state.decks[id===1?1:0].stems);
      f.actions.setMainVolume(id,value,'rapid-main-'+step);
      if(!parts[0] || !parts[1])check(JSON.stringify(f.state.decks[id===1?1:0].stems)===otherBefore,'Independent/OFF Main does not redistribute another deck');
      if(step%3===0)f.actions.setStemLevel(id,'flow',step%2?.8:.2,'rapid-stem-'+step);
      check([1,2].every(id=>f.mixer.getDeck(id).getState().isPlaying),'Rapid Main/stem does not stop transports');
      check(f.state.decks[id-1].volume===value,'Main target committed');
      const state=f.mixer.getDeck(id).getState();check(state.mainVolume===value,'Native Main target matches state');
    }
    scan(f,.317,.38,members);
    for(let id=1;id<=2;id++){
      check(near(stemSchedulingValueAt(f.gains[(id-1)*6+4].events,.38),f.state.decks[id-1].volume),'Settled actual Main matches state');
      check(near(gain(f,id,.38),f.state.decks[id-1].volume*f.state.decks[id-1].stems.allocatedLevels.flow),'Settled effective gain matches Main × stem');
    }
    f.actions.dispose();await f.mixer.close();
  }
  const single=await fixture([true,false],1);
  for(const v of [.5,0,.9,1]){single.actions.setMainVolume(1,v,'one-deck-main');single.audio.currentTime+=.05;check(near(gain(single,1,single.audio.currentTime),v*.5),'One-deck Main changes actual native gain including mute');}
  check(single.state.stemSession.authorization.ceilingsByStem.flow===.5,'Lower Main never silently raises high-water');
  single.actions.setStemLevel(1,'transients',.25,'multi-transients');single.actions.setStemLevel(1,'tune',.75,'multi-tune');
  single.actions.setMainVolume(1,.6,'multi-main');single.audio.currentTime+=.05;
  for(const [name,coefficient] of Object.entries({transients:.25,flow:.5,tune:.75,voice:0}))check(near(gain(single,1,single.audio.currentTime,name),.6*coefficient),'One Main scales each distinct stem independently');
  single.actions.setMainVolume(1,.2,'prepare-low-main');single.actions.setStemLevel(1,'flow',1,'explicit-positive-stem');
  single.actions.setMainVolume(1,.8,'authorize-live-main');single.audio.currentTime+=.05;
  check(single.state.stemSession.authorization.ceilingsByStem.flow===.8 && near(gain(single,1,single.audio.currentTime),.8),'Qualifying Main increase explicitly raises effective high-water');
  single.actions.dispose();await single.mixer.close();
  const sharing=await fixture();sharing.actions.setStemLevel(1,'flow',1,'authorize');sharing.audio.currentTime=.3;
  sharing.actions.setStemLevel(2,'flow',.2,'share');sharing.audio.currentTime=.4;
  check(near(sharing.state.decks[0].stems.allocatedLevels.flow,.8),'Prepared suppressed stem allocation');
  sharing.actions.setMainVolume(1,.5,'lower-main');
  check(near(sharing.state.decks[0].stems.allocatedLevels.flow,.8) && sharing.state.decks[0].stems.requestedLevels.flow===1,'Main scales allocated stem, preserves retained request');
  check(near(sharing.state.decks[1].stems.allocatedLevels.flow,.6),'Other participant restores authorized effective budget');
  scan(sharing,.4,.45);sharing.audio.currentTime=.45;sharing.actions.setMainVolume(1,1,'raise-main');scan(sharing,.45,.50);
  check(near(sharing.state.decks[1].stems.allocatedLevels.flow,.2),'Raising Main has direct effective-gain priority');
  sharing.audio.currentTime=.51;sharing.actions.setStemLevel(2,'flow',0,'zero');sharing.actions.setMainVolume(1,.2,'lower-after-zero');
  check(sharing.state.decks[1].stems.allocatedLevels.flow===0,'Main changes do not resurrect explicit zero');
  const saved=JSON.stringify(sharing.state.decks),events=JSON.stringify(sharing.gains.map(g=>g.events));let rejected=false;
  try{sharing.actions.setMainVolume(1,NaN,'invalid-main');}catch(e){rejected=true;}
  check(rejected && JSON.stringify(sharing.state.decks)===saved && JSON.stringify(sharing.gains.map(g=>g.events))===events,'Rejected Main changes no state or automation');
  sharing.actions.dispose();await sharing.mixer.close();
  // Valid endpoints, but naive simultaneous linear Main/stem ramps peak at 1.125.
  const f=createStemSchedulingFixture();for(const id of [1,2])await f.load(id);
  const initial=f.snapshot(0);initial[1]={mainVolume:1,levels:f.levels(.2)};initial[2]={mainVolume:.8,levels:f.levels(1)};
  f.mixer.applyGainSnapshot(initial);await f.mixer.startCoordinated(1,initial);f.audio.currentTime=.1;await f.mixer.startCoordinated(2,initial);f.audio.currentTime=.2;
  const target=f.snapshot(0);target[1]={mainVolume:.5,levels:f.levels(1)};target[2]={mainVolume:1,levels:f.levels(.5)};
  const when=f.mixer.applyGainSnapshot(target);
  check(f.mixer.getDiagnostics().lastRetargetReservation.gainPlan==='reductions-then-increases','Quadratic interior overshoot selects safe 2-stage plan');
  scan(f,.2,.27);check(near(gain(f,1,.27),.5)&&near(gain(f,2,.27),.5),'Coupled endpoints settle accurately');
  // Reverse during the first stage, including cancelling a not-yet-started increase.
  f.audio.currentTime=when+.002;f.mixer.applyGainSnapshot(initial);scan(f,f.audio.currentTime,.29);
  check(f.mixer.getDeck(1).getState().isPlaying&&f.mixer.getDeck(2).getState().isPlaying,'Interrupted staged plan does not pause');
  check(near(gain(f,1,.29),.2)&&near(gain(f,2,.29),.8),'Reversed staged plan settles without stale delayed increases');
  await f.mixer.close();
  // Individual effective high-water must hold even when aggregate capacity is spare.
  const low=createStemSchedulingFixture();await low.load(1);
  const lowInitial=low.snapshot(0);lowInitial[1]={mainVolume:1,levels:low.levels(.25)};
  low.mixer.applyGainSnapshot(lowInitial);await low.mixer.startCoordinated(1,lowInitial);low.audio.currentTime=.1;
  const lowTarget=low.snapshot(0);lowTarget[1]={mainVolume:.5,levels:low.levels(.5)};
  const lowWhen=low.mixer.applyGainSnapshot(lowTarget);
  check(low.mixer.getDiagnostics().lastRetargetReservation.gainPlan==='reductions-then-increases','Individual peak guard applies below aggregate unity');
  scan(low,.1,.16,[1],.25);check(near(gain(low,1,.16),.25),'Individual endpoint matches original authorized effective level');
  await low.mixer.close();
  const failure=await fixture();const prior=JSON.stringify(failure.state.decks);
  failure.gains[4].gain.setValueAtTime=()=>{throw new Error('injected Main automation failure');};
  let failed=false;try{failure.actions.setMainVolume(1,.5,'partial-main');}catch(e){failed=true;}
  check(failed && JSON.stringify(failure.state.decks)===prior,'Partial Main native failure does not publish an uncommitted gain');
  check(!failure.mixer.getDeck(1).getState().isPlaying && failure.mixer.getLastSchedulingFailure()?.operation==='retarget','Actual partial Main failure retains fail-closed protection');
  failure.actions.dispose();await failure.mixer.close();
  console.log('Live Main tests passed: '+checks+' checks; maximum participating effective sum='+maximum.toFixed(12));
}
