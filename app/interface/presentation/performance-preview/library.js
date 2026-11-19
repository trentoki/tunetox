// H4 local browsers: shared fictional songs/links, four independent navigation sessions.
(() => {
 const d=globalThis.TuneToxDesign,m=d.model,ui=d.components;
 function sorted(items,key,descending){
  return [...items].sort((a,b)=>{
   const left=a[key],right=b[key];const comparison=typeof left==='number'?left-right:String(left||'').localeCompare(String(right||''),undefined,{numeric:true});
   return (descending?-comparison:comparison)||a.id.localeCompare(b.id);
  });
 }
 d.h4Library={sorted};
 d.createColumnLibraries=function(cards,getState,refresh,announce){
  const browsers=cards.map((card,index)=>{
   const id=index+1,local=()=>getState().columnLibraries[index];
   Object.assign(local(),{sort:'title',descending:false,scrolls:{},groups:{local:true,apple:false,soundcloud:false}});
   const root=ui.element('section','column-library h4-library'),top=card.node.querySelector('.h3-library-top');card.node.append(root);
   const selector=d.compact.createSlideSelector(id,()=>getState().decks[index],view=>{
    saveScroll();rememberQuery();local().libraryView=view;local().context=null;if(view==='songs'){local().playlistId='all';local().songQuery=local().songQueries.all||'';}refresh();
   },{reselect:true,modes:['songs','playlists','links'],labels:{songs:'Songs',playlists:'Playlists',links:'Links'},current:()=>local().libraryView,prefix:'h4-library-',label:'Library section for deck '});
   selector.node.classList.add('h4-library-selector');top.insertBefore(selector.node,top.lastChild);
   const arrange=ui.element('div','h4-arrange'),direction=ui.button('','↑','Reverse arrangement order',()=>{saveScroll();local().descending=!local().descending;refresh();});
   const sortSelector=d.compact.createSlideSelector(id,()=>getState().decks[index],key=>{saveScroll();local().sort=key;refresh();},{modes:['title','bpm','key','artist'],labels:{title:'Title',bpm:'BPM',key:'Key',artist:'Artist'},current:()=>local().sort,prefix:'h5-sort-',label:'Sort songs in deck '});
   const playlistSort=d.compact.createSlideSelector(id,()=>getState().decks[index],()=>{},{modes:['title'],labels:{title:'Playlist name'},current:()=> 'title',prefix:'h5-playlist-sort-',label:'Arrange playlists in deck '});sortSelector.node.classList.add('h5-sort');playlistSort.node.classList.add('h5-playlist-sort');arrange.append(sortSelector.node,playlistSort.node,direction);
   const search=ui.element('input','column-search');search.type='search';search.placeholder='Search songs / artists';search.setAttribute('aria-label','Search Library in deck '+id);
   const contextbar=ui.element('div','h4-library-contextbar'),back=ui.button('','← Back','Return to previous Library context',()=>{
    saveScroll();const state=local();if(state.context?.screen==='songs')state.context.screen='summary';else if(state.context)state.context=null;else {rememberQuery();state.libraryView='playlists';}refresh();
   }),caption=ui.element('span'),done=ui.button('','Done','Finish managing song',()=>{saveScroll();local().context=null;refresh();});contextbar.append(back,caption,done);
   const list=ui.element('div','panel-list h4-library-list');list.tabIndex=0;list.setAttribute('aria-label','Library rows for deck '+id);
   const footer=ui.element('div','column-load'),selected=ui.element('span','column-selected');footer.append(selected);
   const loads=[1,2,3,4].map(target=>{const b=ui.button('column-load-button',''+target,'Load selected example into deck '+target,()=>{
    const state=local();if(d.h4Queue.load(getState(),target,state.songId)){announce('Example loaded or queued on D'+target+' · Wave selected');refresh();}else announce('Queue already occupied; Swap the queued song before loading another.');
   });footer.append(b);return b;});
   back.replaceChildren(d.h5Icon('back'),ui.element('span','','Back'));root.append(arrange,search,contextbar,list,footer);
   let signature='',scrollKey='';
   function key(){const s=local();return [s.libraryView,s.playlistId,s.context?.songId||'',s.context?.screen||''].join('/');}
   function saveScroll(){if(scrollKey)local().scrolls[scrollKey]=list.scrollTop;}
   function rememberQuery(){const state=local();if(!state.context&&state.libraryView==='songs')state.songQueries[state.playlistId]=state.songQuery;}
   list.addEventListener('scroll',saveScroll,{passive:true});

   search.addEventListener('input',()=>{saveScroll();const state=local();const field=state.context?'manageQuery':state.libraryView==='playlists'?'playlistQuery':state.libraryView==='links'?'linksQuery':'songQuery';state[field]=search.value;rememberQuery();refresh();});
   root.addEventListener('manage-song',event=>{event.stopPropagation();saveScroll();local().context={type:'manage',songId:event.detail,screen:'summary'};local().manageQuery='';refresh();});
   d.enableDragDrop(root,(songId,playlistId)=>{if(m.dropSong(getState(),songId,playlistId)){announce('Example playlist membership added');refresh();}},announce);
   const matches=(item,query)=>(item.title+' '+(item.artist||'')).toLowerCase().includes(query.toLowerCase().trim());
   function checkedRow(row,checked,label,change,disabled=false){
    const wrapper=ui.element('div','h4-choice-row'),input=ui.element('input');input.type='checkbox';input.checked=checked;input.disabled=disabled;input.setAttribute('aria-label',label);input.addEventListener('change',()=>{saveScroll();change(input.checked);refresh();});wrapper.append(input,row);return wrapper;
   }
   function songRow(song,source){
    const row=ui.songRow(song,local().songId===song.id,()=>{local().songId=song.id;refresh();});
    if(!source)return row;
    row.querySelector('.song-manage').hidden=true;
    return checkedRow(row,(getState().userLinks[source.id]||[]).includes(song.id),'Link '+song.title+' to '+source.title,checked=>m.setUserLink(getState(),source.id,song.id,checked));
   }
   function playlistRow(playlist,source){
    const row=ui.playlistRow(playlist,local().playlistId===playlist.id,()=>{
     saveScroll();rememberQuery();local().playlistId=playlist.id;
     if(!local().context)local().songQuery=local().songQueries[playlist.id]||'';
     if(local().context)local().context.screen='songs';else local().libraryView='songs';refresh();
    });
    if(!source)return row;
    return checkedRow(row,playlist.songIds.includes(source.id),'Include '+source.title+' in '+playlist.title,checked=>m.setMembership(getState(),source.id,playlist.id,checked),playlist.id==='all');
   }
   function heading(text){list.append(ui.element('h3','h4-list-heading',text));}
   function addSongs(items,source){const s=local();for(const song of sorted(items,s.sort,s.descending))list.append(songRow(song,source));if(!items.length)list.append(ui.element('p','empty-list','No matching songs.'));}
   function addPlaylists(source,query){const s=local();for(const playlist of sorted(getState().playlists.filter(p=>matches(p,query)),'title',s.descending))list.append(playlistRow(playlist,source));}
   return {render(){
    const state=local(),shared=getState(),source=m.findSong(state.context?.songId),loaded=m.findSong(shared.decks[index].songId);
    selector.render();const managing=!!source,playlistScreen=managing?state.context.screen==='songs':state.libraryView==='songs'&&state.playlistId!=='all';
    const playlistView=state.libraryView==='playlists'&&!managing;sortSelector.node.hidden=playlistView;playlistSort.node.hidden=!playlistView;sortSelector.render();playlistSort.render();
    direction.textContent=state.descending?'↓':'↑';direction.setAttribute('aria-label',state.descending?'Use ascending order':'Use descending order');
    search.value=managing?state.manageQuery||'':state.libraryView==='playlists'?state.playlistQuery:state.libraryView==='links'?state.linksQuery:state.songQuery;
    search.placeholder=managing?'Search links / playlists / artists':state.libraryView==='playlists'?'Search playlists':state.libraryView==='links'?'Search user links / artists':'Search songs / artists';
    back.hidden=!managing&&!playlistScreen;done.hidden=!managing;
    caption.textContent=managing?'Manage · '+source.title:playlistScreen?shared.playlists.find(p=>p.id===state.playlistId)?.title:'D'+id+' · '+(state.libraryView==='links'?'User-created links':state.libraryView);
    caption.title=managing?'Linking source stays '+source.title:caption.textContent;
    selected.textContent=m.findSong(state.songId)?.title||'Select song';loads.forEach(b=>b.disabled=!m.findSong(state.songId));
    const next=JSON.stringify([state.libraryView,state.playlistId,state.context,state.songId,search.value,state.sort,state.descending,state.groups,shared.playlists,shared.userLinks,loaded?.id]);
    if(signature===next)return;saveScroll();signature=next;scrollKey=key();list.replaceChildren();const query=search.value;
    if(managing){
     if(state.context.screen==='songs'){
      heading(shared.playlists.find(p=>p.id===state.playlistId)?.title||'Songs');
      addSongs(d.data.songs.filter(s=>s.id!==source.id&&shared.playlists.find(p=>p.id===state.playlistId)?.songIds.includes(s.id)&&matches(s,query)),source);
     }else{
      heading('Links · user-created');
      const candidates=d.data.songs.filter(s=>s.id!==source.id&&matches(s,query));
      // Existing links are expanded first; unlinked candidates remain selectable below.
      const ids=shared.userLinks[source.id]||[];addSongs(candidates.filter(s=>ids.includes(s.id)),source);
      const others=candidates.filter(s=>!ids.includes(s.id));if(others.length){heading('Add links');addSongs(others,source);}
      heading('Playlists');addPlaylists(source,query);
     }
    }else if(state.libraryView==='playlists'){
     for(const [group,label] of [['local','Local TuneTox playlists'],['apple','Apple Music / iTunes · simulated'],['soundcloud','SoundCloud · simulated']]){
      const toggle=ui.button('h4-source-group',(state.groups[group]?'▾ ':'▸ ')+label,'Expand '+label,()=>{saveScroll();state.groups[group]=!state.groups[group];refresh();});toggle.dataset.source=group;toggle.setAttribute('aria-expanded',String(state.groups[group]));list.append(toggle);
      if(state.groups[group]){if(group==='local')addPlaylists(null,query);else list.append(ui.element('p','h4-external-example','Example collection · no connection, import or playback.'));}
     }
    }else if(state.libraryView==='links'){
     const ids=shared.userLinks[loaded?.id]||[];heading(loaded?'Links from '+loaded.title:'No song loaded');addSongs(d.data.songs.filter(s=>ids.includes(s.id)&&matches(s,query)));
    }else{
     const playlist=shared.playlists.find(p=>p.id===state.playlistId);addSongs(d.data.songs.filter(s=>playlist?.songIds.includes(s.id)&&matches(s,query)));
    }
    // Use one row factory in browsing and Manage: same geometry and typography.
    list.querySelectorAll('.song-manage').forEach(button=>{button.replaceChildren(d.h5Icon('settings'));button.title='Manage song';});
    list.scrollTop=state.scrolls[scrollKey]||0;
   }};
  });
  return {render(){browsers.forEach(browser=>browser.render());}};
 };
})();
