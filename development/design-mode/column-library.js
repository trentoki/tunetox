// Four local library sessions share example data/actions, never production state.
(() => {
  const design = globalThis.TuneToxDesign, model = design.model, ui = design.components;
  design.createColumnLibraries = function (decks, getState, refresh, announce) {
    function active() {
      const state = getState();
      return design.isPhone() || state.layout === 'full' && state.arrangement === 'slices' &&
        matchMedia('(orientation: landscape) and (min-width: 900px) and (max-width: 1600px) and (min-height: 650px)').matches;
    }
    // Reuse library/context actions with local navigation and shared song/link data.
    function localState(index) {
      const shared = getState(), local = shared.columnLibraries[index], view = { ...shared };
      Object.keys(local).forEach(key => Object.defineProperty(view, key, {
        get: () => local[key], set: value => { local[key] = value; }, enumerable: true
      }));
      return view;
    }
    const browsers = decks.map((deck, index) => {
      const root = ui.element('section', 'column-library');
      root.setAttribute('aria-label', 'Library in deck ' + (index + 1) + ' column');
      deck.node.append(root);
      function openPlaylist(id) {
        const state = localState(index);
        state.songQueries[state.playlistId] = state.songQuery;
        state.songQuery = state.songQueries[id] || '';
        model.selectPlaylist(state, id); state.libraryView = 'songs'; refresh();
      }
      const search = ui.element('input', 'column-search'); search.type = 'search';
      search.placeholder = 'Search playlists / songs / artists';
      search.setAttribute('aria-label', 'Search playlists, songs and artists in column ' + (index + 1));
      const navigation = ui.element('nav', 'column-library-navigation');
      navigation.setAttribute('aria-label', 'Library navigation in column ' + (index + 1));
      const songTab = ui.button('column-songs-tab', 'Songs', 'Show all example songs', () => {
        openPlaylist('all');
      });
      const playlistTab = ui.button('column-playlists-tab', 'Playlists', 'Browse playlists', () => { localState(index).libraryView = 'playlists'; refresh(); });
      const linksTab = ui.button('column-links-tab', 'Links', 'Show user-created links for the song loaded on deck ' + (index + 1), () => { localState(index).libraryView = 'links'; refresh(); });
      navigation.append(songTab, playlistTab, linksTab);
      const back = ui.button('column-library-back', '← Playlists', 'Back to playlist list', () => { localState(index).libraryView = 'playlists'; refresh(); });
      root.append(navigation, search, back);
      function panel(title) {
        const node = ui.element('section', 'column-panel'), heading = ui.element('h3', '', title);
        const list = ui.element('div', 'panel-list'); list.tabIndex = 0;
        list.setAttribute('aria-label', title + ' in column ' + (index + 1));
        node.append(heading, list); root.append(node); return { node, list };
      }
      const playlists = panel('Playlists'), songs = panel('Songs');
      const playlistList = ui.createList(playlists.list, ui.playlistRow, 'No matching playlists.');
      const songList = ui.createList(songs.list, ui.songRow, 'No matching songs.');
      const footer = ui.element('div', 'column-load');
      const selected = ui.element('span', 'column-selected'); footer.append(selected);
      const loads = [1,2,3,4].map(id => {
        const button = ui.button('column-load-button', String(id), 'Load selected example into deck ' + id, () => {
          if (model.loadSelected(localState(index), id)) { announce('Example loaded into deck ' + id); refresh(); }
        });
        footer.append(button); return button;
      });
      songs.node.append(footer);
      const context = design.createLibraryContext(root, () => localState(index), refresh, announce, { browse: true });
      root.addEventListener('manage-song', event => {
        event.stopPropagation(); getState().columnLibraries[index].context = { type: 'manage', songId: event.detail }; refresh();
      });
      search.addEventListener('input', () => {
        const state = localState(index); state.searchQuery = search.value;
        if (state.libraryView === 'links') state.linksQuery = search.value;
        else if (state.libraryView === 'playlists') state.playlistQuery = search.value;
        else { model.setSongQuery(state, search.value); state.songQueries[state.playlistId] = search.value; }
        refresh();
      });
      design.enableDragDrop(root, (songId, playlistId) => {
        if (model.dropSong(localState(index), songId, playlistId)) { announce('Example added to playlist'); refresh(); }
      }, announce);
      return { render() {
        const state = localState(index);
        search.value = state.libraryView === 'links' ? state.linksQuery : state.libraryView === 'playlists' ? state.playlistQuery : state.songQuery;
        search.placeholder = state.libraryView === 'links' ? 'Search user links' : state.libraryView === 'playlists' ? 'Search playlists' : 'Search songs / artists';
        search.setAttribute('aria-label', search.placeholder + ' in column ' + (index + 1));
        songTab.setAttribute('aria-pressed', String(state.libraryView === 'songs'));
        playlistTab.setAttribute('aria-pressed', String(state.libraryView === 'playlists'));
        linksTab.setAttribute('aria-pressed', String(state.libraryView === 'links'));
        songs.node.querySelector('h3').textContent = state.playlists.find(p => p.id === state.playlistId)?.title || 'Songs';
        playlistList.render(model.visiblePlaylists(state), state.playlistId, id => openPlaylist(id), state.playlistQuery);
        const source = model.findSong(state.decks[index].songId);
        const viewingLinks = state.libraryView === 'links';
        const linkedSongs = (state.userLinks[source?.id] || []).map(model.findSong).filter(song => song && (song.title + ' ' + song.artist).toLowerCase().includes(state.linksQuery.trim().toLowerCase()));
        if (viewingLinks) songs.node.querySelector('h3').textContent = source ? 'Links from ' + source.title : 'Deck ' + (index + 1) + ' · No song loaded';
        songList.render(viewingLinks ? linkedSongs : model.visibleSongs(state), state.songId, id => {
          if (localState(index).libraryView === 'links') localState(index).songId = id;
          else model.selectSong(localState(index), id);
          refresh();
        }, viewingLinks ? 'links/' + source?.id + '/' + state.linksQuery : state.playlistId + '/' + state.songQuery);
        if (viewingLinks && songs.list.querySelector('.empty-list')) songs.list.querySelector('.empty-list').textContent = !source ? 'Load a song on this deck to view its links.' : (state.userLinks[source.id] || []).length ? 'No matching user links.' : 'No user-created links. Use Manage to add one.';
        selected.textContent = model.findSong(state.songId)?.title || 'Select song';
        loads.forEach(button => { button.disabled = !model.findSong(state.songId); });
        context.render();
        if (!state.context) {
          playlists.node.hidden = state.libraryView !== 'playlists'; songs.node.hidden = !['songs', 'links'].includes(state.libraryView);
          back.hidden = state.libraryView !== 'songs' || state.playlistId === 'all';
        }
      } };
    });
    return { active, render() { browsers.forEach(browser => browser.render()); }, showLinks(id) {
      const state = getState(); model.setDeckControl(state, id, 'columnMode', 'library');
      state.columnLibraries[id - 1].context = { type: 'links', deckId: id };
    } };
  };
})();
