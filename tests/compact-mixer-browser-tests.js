document.getElementById('run').addEventListener('click',async()=>{
  const result=document.getElementById('result'), frame=document.getElementById('application');
  let checks=0;
  const check=(value,message)=>{checks++;if(!value)throw new Error(message);};
  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try {
    result.textContent='Running';
    const w=frame.contentWindow,d=w.document;
    const end=performance.now()+5000;
    while(!d.querySelector('.deck-faders')&&performance.now()<end)await new Promise(resolve=>setTimeout(resolve,20));
    const cards=[...d.querySelectorAll('#audio-decks > section')];
    check(cards.length===4,'Four persistent cards mount');
    check(![...d.querySelectorAll('[data-action="stop"]')].some(button=>button.getClientRects().length),'No visible Stop control');
    for(const [width,height] of [[1280,720],[1440,900],[1024,768],[900,680]]) {
      frame.style.width=width+'px';frame.style.height=height+'px';await paint();
      const rects=cards.map(card=>card.getBoundingClientRect());
      check(rects[0].top===rects[1].top&&rects[2].top===rects[3].top&&rects[0].left===rects[2].left,'Fixed 2×2 ordering');
      check(d.documentElement.scrollWidth<=w.innerWidth+1,'No page horizontal overflow at '+width);
      check(d.documentElement.scrollHeight<=w.innerHeight+1,'No page vertical overflow at '+width+'×'+height);
      for(const card of cards) {
        check(card.scrollWidth<=card.clientWidth+1&&card.scrollHeight<=card.clientHeight+1,'No card overflow');
        const faders=[...card.querySelectorAll('.deck-faders input[type="range"]')];
        check(faders.length===5,'Main plus four stems visible');
        for(const input of faders) {
          const rect=input.getBoundingClientRect();
          check(rect.width>35&&rect.top>=0&&rect.bottom<=w.innerHeight,'Fader fits viewport');
          check(input.parentElement.querySelector('output').value.length>0,'Numeric readout present');
        }
        const files=card.querySelector('.stem-files');const before=cards.map(item=>item.getBoundingClientRect().top);
        files.open=true;await paint();
        check(cards.every((item,i)=>item.getBoundingClientRect().top===before[i]),'Opening files never moves another deck');
        const panel=files.querySelector('.panel-content').getBoundingClientRect();
        check(panel.width>=card.clientWidth-20,'File overlay uses card width rather than footer width');
        check(panel.left>=0&&panel.right<=w.innerWidth+1&&panel.top>=0&&panel.bottom<=w.innerHeight+1,'File overlay fits viewport');
        const transport=card.querySelector('.deck-transport').getBoundingClientRect();
        check(panel.top>=transport.bottom,'Expanded files stay below playback controls');
        for(const button of card.querySelectorAll('.deck-transport button:not([hidden])')) {
          const rect=button.getBoundingClientRect();
          check(!files.querySelector('.panel-content').contains(d.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)),
            'Panel never intercepts playback controls');
        }
        files.querySelector('.panel-close').click();await paint();
        check(!files.open&&d.activeElement===files.querySelector('summary'),'Close dismisses panel and restores focus');
        files.open=true;await paint();
        files.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await paint();
        check(!files.open,'Escape dismisses panel');
      }
    }
    const select=d.getElementById('deck.1.sourceMode');select.value='stems';select.dispatchEvent(new w.Event('change'));await paint();
    check(!d.getElementById('deck.1.volume').disabled,'Stem source enables faders');
    const mainPicker=cards[0].querySelector('.deck-advanced input[type="file"]');
    const batch=d.getElementById('prototype.deck.1.stem.batch');
    check(mainPicker.parentElement.hidden&&!batch.parentElement.hidden,'Source switch hides complete-song picker only');
    const slide=(id,value)=>{const input=d.getElementById(id);input.value=value;input.dispatchEvent(new w.Event('input'));};
    slide('deck.1.volume',0.75);slide('deck.1.stem.voice.level',0.45);
    check(d.getElementById('deck.1.volume').parentElement.querySelector('output').value==='0.75','Main value refreshes');
    check(d.getElementById('deck.1.stem.voice.level').parentElement.querySelector('output').value==='0.450','Stem value refreshes');
    const duplicateIds=[...d.querySelectorAll('[id]')].map(element=>element.id);
    check(new Set(duplicateIds).size===duplicateIds.length,'No duplicate control identities');
    // Actual component refresh must project automatic allocations too, without input events.
    w.eval('appState.decks[0].stems = Object.freeze({ requestedLevels: appState.decks[0].stems.requestedLevels, allocatedLevels: Object.freeze({...appState.decks[0].stems.allocatedLevels, voice: 0.12345}) })');
    select.dispatchEvent(new w.Event('change'));
    check(d.getElementById('deck.1.stem.voice.level').parentElement.querySelector('output').value==='0.123','Automatic fractional allocation is readable');
    result.textContent='PASS: '+checks+' compact layout/control checks. Run batch/main/four-deck browser tests for loading and audio integration.';
  }catch(error){result.textContent='FAIL: '+error.message;console.error(error);}
});
