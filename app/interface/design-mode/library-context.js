// Temporary contextual view. The underlying library DOM stays mounted to retain scroll/focus state.
(() => {
  const design = globalThis.TuneToxDesign, { element, button, songRow } = design.components;
  design.createLibraryContext = function (library, getState, refresh, announce, options = { browse: true }) {
    const panel = element('section', 'library-context'); panel.hidden = true;
    panel.setAttribute('aria-label', 'Contextual song management');
    panel.dataset.manageBuild = 'M1'; library.append(panel);
    let signature = '', returnFocus = null, savedScroll = []; 
    function checkbox(text, checked, change, disabled = false) {
      const label = element('label', 'management-choice');
      const input = element('input'); input.type = 'checkbox'; input.checked = checked; input.disabled = disabled;
      input.addEventListener('change', () => {
        if (options.browse && getState().context) getState().context.scroll = panel.querySelector('.context-body')?.scrollTop || 0;
        change(input.checked);
      }); label.append(input, document.createTextNode(text)); return label;
    }
    function close() {
      const state = getState(), context = state.context;
      if (options.browse && context?.trail?.length) {
        const previous = context.trail.pop(); Object.assign(context, previous); refresh();
      } else if (options.browse && context?.returnContext) { state.context = context.returnContext; refresh(); }
      else { state.context = null; refresh(); returnFocus?.focus(); }
    }
    function navigate(screen, playlistId = null) {
      const context = getState().context;
      context.trail = context.trail || [];
      context.trail.push({ screen: context.screen || 'summary', playlistId: context.playlistId || null,
        query: context.query || '', scroll: panel.querySelector('.context-body')?.scrollTop || 0 });
      Object.assign(context, { screen, playlistId, query: '', scroll: 0 }); refresh();
    }
    function render() {
      const state = getState(), context = state.context;
      const wasHidden = panel.hidden;
      if (wasHidden && context) savedScroll = [...library.querySelectorAll('.panel-list')].map(node => [node, node.scrollTop]);
      panel.hidden = !context;
      [...library.children].filter(node => node !== panel).forEach(node => { node.hidden = !!context; });
      if (!context) {
        if (!wasHidden) savedScroll.forEach(([node, top]) => { node.scrollTop = top; });
        signature = ''; return;
      }
      if (wasHidden) returnFocus = document.activeElement;
      const deck = state.decks.find(d => d.id === context.deckId);
      const song = design.model.findSong(context.type === 'links' ? deck?.songId : context.songId);
      const nextSignature = JSON.stringify([context, song?.id, state.userLinks, state.playlists]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      const returning = options.browse && (context.trail?.length || context.returnContext);
      const back = button('quiet-button context-back', returning ? '← Back' : '← Back to library', returning ? 'Return to previous view' : 'Return to library', close);
      const heading = element('h2', '', context.type === 'links' ? 'Deck ' + context.deckId + ' · Links' : 'Manage song');
      heading.append(element('span', 'manage-build-tag', ' M1'));
      const subtitle = element('p', 'context-source', song ? song.title + ' — ' + song.artist : 'No song loaded in this deck.');
      const body = element('div', 'context-body');
      panel.replaceChildren(back, heading, subtitle, body);
      if (!song) body.append(element('p', '', 'Load an example song to view its links.'));
      else if (context.type === 'links') {
        body.append(element('p', 'context-note', 'User-created links from this song · simulated'));
        const ids = state.userLinks[song.id] || [];
        if (!ids.length) body.append(element('p', '', 'No user-created links yet. Use Manage to add one.'));
        ids.forEach(id => body.append(songRow(design.model.findSong(id), state.songId === id, selected => {
          state.songId = selected; announce('Linked example selected for loading'); refresh();
        })));
        body.append(button('quiet-button', 'Manage source song', 'Manage source song links', () => {
          if (options.browse) context.scroll = body.scrollTop;
          state.context = { type: 'manage', songId: song.id, ...(options.browse ? { returnContext: context } : {}) }; refresh();
        }));
      } else if (options.browse && ['playlists', 'songs'].includes(context.screen)) {
        body.append(element('p', 'context-note', 'Linking FROM: ' + song.title + ' · select another song to add a manual link.'));
        const search = element('input', 'manage-search'); search.type = 'search'; search.value = context.query || '';
        search.placeholder = context.screen === 'playlists' ? 'Find a playlist' : 'Find a song';
        search.setAttribute('aria-label', search.placeholder + ' while linking from ' + song.title);
        search.addEventListener('input', () => {
          const start = search.selectionStart; context.query = search.value; context.scroll = body.scrollTop; refresh();
          const replacement = panel.querySelector('.manage-search'); replacement.focus(); replacement.setSelectionRange(start, start);
        });
        body.append(search);
        const query = (context.query || '').toLowerCase();
        if (context.screen === 'playlists') {
          const matches = state.playlists.filter(item => item.title.toLowerCase().includes(query));
          matches.forEach(playlist => body.append(button('manage-browse-row', playlist.title, 'Browse ' + playlist.title, () => navigate('songs', playlist.id))));
          if (!matches.length) body.append(element('p', '', 'No matching playlists.'));
        } else {
          const playlist = state.playlists.find(item => item.id === context.playlistId);
          body.append(element('h3', '', playlist?.title || 'Playlist unavailable'));
          const candidates = design.data.songs.filter(other => playlist?.songIds.includes(other.id) && other.id !== song.id &&
            (other.title + ' ' + other.artist).toLowerCase().includes(query));
          candidates.forEach(other => {
            const linked = (state.userLinks[song.id] || []).includes(other.id);
            const candidate = button('manage-link-candidate', other.title + (linked ? ' · Linked' : ' · Add link'), 'Add link from ' + song.title + ' to ' + other.title, () => {
              context.scroll = body.scrollTop; design.model.setUserLink(state, song.id, other.id, true);
              announce('Manual link from ' + song.title + ' to ' + other.title + ' added'); refresh();
            });
            candidate.disabled = linked; body.append(candidate);
          });
          if (!candidates.length) body.append(element('p', '', 'No other matching songs.'));
        }
      } else {
        body.append(element('p', 'manage-song-details', song.bpm + ' BPM · ' + song.key + ' · ' + song.duration));
        const links = element('details', 'manage-links-disclosure'); links.open = !!context.linksExpanded;
        links.append(element('summary', '', 'Links (' + (state.userLinks[song.id] || []).length + ')'));
        links.addEventListener('toggle', () => { if (links.isConnected) context.linksExpanded = links.open; });
        body.append(links);
        design.data.songs.filter(other => other.id !== song.id).forEach(other => {
          links.append(checkbox(other.title, (state.userLinks[song.id] || []).includes(other.id), checked => {
            design.model.setUserLink(state, song.id, other.id, checked); refresh();
          }));
        });
        links.append(element('p', 'context-note', 'User-created links only. Tap a playlist below to link one of its songs.'));
        state.playlists.forEach(playlist => {
          const row = element('div', 'manage-playlist-row'); row.dataset.playlistId = playlist.id;
          const membership = element('input'); membership.type = 'checkbox'; membership.checked = playlist.songIds.includes(song.id); membership.disabled = playlist.id === 'all';
          membership.setAttribute('aria-label', 'Include ' + song.title + ' in ' + playlist.title + (playlist.id === 'all' ? ' (read-only collection)' : ''));
          membership.addEventListener('change', () => {
            context.scroll = body.scrollTop; design.model.setMembership(state, song.id, playlist.id, membership.checked); refresh();
          });
          const name = button('manage-playlist-name', playlist.title, 'Open ' + playlist.title + ' songs', () => navigate('songs', playlist.id));
          row.append(membership, name); body.append(row);
        });
      }
      if (options.browse) body.scrollTop = context.scroll || 0;
      if (wasHidden) back.focus();
    }
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return { render };
  };
})();
