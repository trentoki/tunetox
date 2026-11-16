function runIncrementalStemTests() {
 let checks=0;
 const check=(x,label)=>{checks++;if(!x)throw new Error(label);};
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 function run(levels,requests,id,value,history=[1,2,3,4],extra={}){
  const decks=levels.map((level,index)=>({id:index+1,volume:1,requestedLevel:index+1===id?value:requests[index],allocatedLevel:level,active:true,participating:true,returnEligible:true}));
  if(extra.decks)extra.decks(decks);
  return calculateFourDeckStemAllocation({decks,enabled:true,relationshipEstablished:extra.sharing!==false,authorizationCeiling:extra.ceiling??1,trigger:'directGesture',priorityDeckId:id,incremental:{previousGain:decks[id-1].volume*levels[id-1],history}});
 }
 let r=run([1,0,0,0],[1,1,0,0],3,.01,[1,2]);
 check(near(r.allocationsByDeck[1],.99)&&r.allocationsByDeck[2]===0&&r.allocationsByDeck[3]===.01,'Exact 100/0/0 -> 99/0/1 reproduction');
 r=run([0,1,0,0],[1,1,0,0],2,.6,[1,2]);
 check(near(r.allocationsByDeck[1],.4)&&near(r.allocationsByDeck[2],.6),'Reverse two-deck restoration from automatic zero');
 r=run([0,1,0,0],[0,1,0,0],2,.6,[1,2]);
 check(r.allocationsByDeck[1]===0&&near(r.deficit,.4),'Manual zero retains silence and reports unreturned capacity');
 for(const history of [[1,2,3,4],[2,1,3,4],[1,3,2,4]]){
  r=run([.2,.2,.2,.4],[1,1,1,1],4,.3,history);
  const recipient=history.filter(id=>id!==4).pop();
  check(near(r.allocationsByDeck[recipient],.3),'Most recent eligible recipient wins '+history);
  check([1,2,3].filter(id=>id!==recipient).every(id=>near(r.allocationsByDeck[id],.2)),'Unrelated allocations preserved');
 }
 r=run([.2,.3,.2,.3],[1,1,1,1],4,.1,[1,2,3,4],{ceiling:.35});
 check(near(r.allocationsByDeck[3],.35)&&near(r.allocationsByDeck[2],.35),'Recipient cap spills remainder to next history entry');
 r=run([.4,.3,.3,0],[1,1,1,0],1,.41);
 check(near(r.allocationsByDeck[2],.295)&&near(r.allocationsByDeck[3],.295),'Unequal allocation donates only 1% in proportion to current gains');
 r=run([.5,.5,0,0],[1,1,0,0],1,.5);
 check(near(r.allocationsByDeck[1],.5)&&near(r.allocationsByDeck[2],.5),'Intentional equal sharing unchanged');
 r=run([.33,.33,.34,0],[1,1,1,0],1,.33);
 check(near(r.allocationsByDeck[3],.34),'Intentional thirds unchanged');
 r=run([1,1,0,0],[1,1,0,0],3,.01,[1,2],{decks:d=>d[1].participating=false});
 check(r.allocationsByDeck[2]===1&&near(r.allocationsByDeck[1],.99),'OFF deck excluded from donors');
 r=run([0,1,0,0],[1,1,0,0],2,.9,[1,2],{sharing:false});
 check(r.allocationsByDeck[1]===0,'No return before sharing established');
 r=run([.8,.8,0,0],[1,1,0,0],3,.01);
 check(r.excess>.59&&r.transfer.preexistingExcess>.59,'Preexisting excess not hidden by a large unrelated correction; native cap must reject');
 r=run([.5,.5,0,0],[1,1,0,0],1,.51,[1,2],{decks:d=>d[1].volume=.5});
 check(near(r.allocationsByDeck[2],.5),'Available effective headroom used before donors; Main semantics retained');
 let levels=[1,0,0,0],requests=[1,1,1,1],history=[1,2,3,4];
 for(let i=0;i<500;i++){
  const id=i%4+1,value=(i*37%101)/100;
  r=run(levels,requests,id,value,history);const next=[1,2,3,4].map(id=>r.allocationsByDeck[id]);
  const delta=Math.abs(value-levels[id-1]);
  check(next.every((v,index)=>index===id-1||Math.abs(v-levels[index])<=delta+1e-9),'Small gesture cannot cause larger peer jump');
  check(r.combinedGain<=1+1e-9,'Bounded after rapid gesture');
  check(next.every(v=>v>=0&&v<=1),'All coefficients bounded');
  requests[id-1]=value;levels=next;history=[...history.filter(x=>x!==id),id];
 }
 const guard=TuneToxDesign.createStemTouchPriority();
 check(guard.begin('flow',1,10)&&!guard.begin('flow',2,11),'First touch owns category');
 check(guard.begin('tune',2,11)&&guard.allows('tune',2),'Other category independent');
 guard.end(11);check(guard.allows('flow',1)&&!guard.allows('flow',2),'Second touch end cannot steal first lock');
 guard.end(10);check(guard.begin('flow',2,12),'Release allows new touch');
 guard.clear();check(guard.allows('flow',1),'Blur clears lock');
 console.log('Incremental allocation tests passed: '+checks+' checks');
}
