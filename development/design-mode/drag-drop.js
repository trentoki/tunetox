// Session-only example moves. Delegation keeps list rerenders safe.
// Touch: drag the note/artwork handle; the rest of each row retains native scrolling.
(() => {
  globalThis.TuneToxDesign.enableDragDrop = function (library, receive, announce) {
    let songId = null, activeTarget = null, touch = null, suppressClick = false;
    const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.hidden = true;
    document.body.append(ghost);
    function targetAt(node) { return node?.closest?.('.playlist-row'); }
    function highlight(target) {
      activeTarget?.classList.remove('drop-ready'); activeTarget = target;
      activeTarget?.classList.add('drop-ready');
    }
    function finish(target) {
      if (songId && target) receive(songId, target.dataset.playlistId);
      else if (songId) announce('Example drag cancelled');
      highlight(null); songId = null; touch = null; ghost.hidden = true;
    }
    library.addEventListener('dragstart', event => {
      const row = event.target.closest('.song-row'); if (!row) return;
      songId = row.dataset.songId;
      event.dataTransfer.setData('application/x-tunetox-example', songId);
      event.dataTransfer.effectAllowed = 'copy';
      announce('Drag example to a playlist');
    });
    library.addEventListener('dragover', event => {
      if (!songId) return; const target = targetAt(event.target);
      highlight(target); if (target) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }
    });
    library.addEventListener('dragleave', event => {
      if (!library.contains(event.relatedTarget)) highlight(null);
    });
    library.addEventListener('drop', event => {
      if (!songId) return; event.preventDefault(); finish(targetAt(event.target));
    });
    library.addEventListener('dragend', () => { if (songId) finish(null); });
    library.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || !event.target.closest('.song-art')) return;
      const row = event.target.closest('.song-row'); if (!row) return;
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY, songId: row.dataset.songId, handle: event.target };
      event.target.setPointerCapture(event.pointerId);
    });
    library.addEventListener('pointermove', event => {
      if (!touch || event.pointerId !== touch.id) return;
      if (!songId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 8) return;
      songId = touch.songId; ghost.hidden = false;
      ghost.textContent = 'Drop example → playlist';
      ghost.style.left = event.clientX + 12 + 'px'; ghost.style.top = event.clientY + 12 + 'px';
      highlight(targetAt(document.elementFromPoint(event.clientX, event.clientY)));
    });
    library.addEventListener('pointerup', event => {
      if (!touch || event.pointerId !== touch.id) return;
      const wasDragging = !!songId;
      if (touch.handle.hasPointerCapture(event.pointerId)) touch.handle.releasePointerCapture(event.pointerId);
      finish(wasDragging ? targetAt(document.elementFromPoint(event.clientX, event.clientY)) : null);
      if (wasDragging) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    });
    library.addEventListener('pointercancel', () => { if (touch) finish(null); });
    library.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } }, true);
    library.addEventListener('keydown', event => { if (event.key === 'Escape' && songId) finish(null); });
  };
})();
