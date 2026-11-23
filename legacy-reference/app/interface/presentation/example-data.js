// Fictional metadata only. No media URLs, decoded samples or production imports.
(() => {
  const design = globalThis.TuneToxDesign = globalThis.TuneToxDesign || {};
  const songs = [
    { id: 'neon', title: 'Neon Departure', artist: 'Glass Meridian', bpm: 122, key: 'A minor', duration: '4:18', color: '#54e8df' },
    { id: 'after', title: 'After the Rain', artist: 'Mira Sol', bpm: 118, key: 'D minor', duration: '5:06', color: '#f68ab9' },
    { id: 'night', title: 'Night Current', artist: 'Parallel Cities', bpm: 124, key: 'G minor', duration: '3:54', color: '#ae9bff' },
    { id: 'amber', title: 'Amber Hour', artist: 'Slow Atlas', bpm: 112, key: 'C major', duration: '4:42', color: '#ffbd70' },
    { id: 'satellite', title: 'Satellite Hearts', artist: 'Glass Meridian', bpm: 126, key: 'E minor', duration: '4:09', color: '#9fbbff' },
    { id: 'still', title: 'Still Moving', artist: 'Mira Sol', bpm: 116, key: 'F major', duration: '5:12', color: '#86dcb2' },
    { id: 'blue', title: 'Blue Electric', artist: 'Parallel Cities', bpm: 128, key: 'B minor', duration: '3:47', color: '#6ed8ff' },
    { id: 'home', title: 'The Long Way Home', artist: 'Slow Atlas', bpm: 110, key: 'G major', duration: '6:02', color: '#eebc83' }
  ];
  const playlists = [
    { id: 'all', title: 'All examples', icon: '≡', songIds: songs.map(song => song.id) },
    { id: 'afterhours', title: 'After hours', icon: '☾', songIds: ['neon', 'night', 'satellite', 'blue'] },
    { id: 'slow', title: 'Slow burn', icon: '◒', songIds: ['after', 'amber', 'still', 'home'] },
    { id: 'favorites', title: 'Favorites', icon: '♡', songIds: ['neon', 'after', 'night', 'amber', 'satellite'] }
  ];
  design.data = { songs, playlists };
})();
