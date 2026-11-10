function runStemFileAssignmentTests() {
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const file=name=>({name,size:100,lastModified:10,type:'audio/wav'});
  for(const [word,category] of [['drum','transients'],['drums','transients'],['bass','flow'],['other','tune'],['others','tune'],['vocal','voice'],['vocals','voice']]) {
    for(const name of ['Song '+word+'.wav','Song_'+word.toUpperCase()+'.aiff','Song-('+word+').flac'])
      check(recognizeStemFilename(name).join()===category,'Filename word/format variations: '+name);
  }
  const files=['Song_drums.wav','Song_bass.wav','Song_other.wav','Song_vocals.wav'].map(file);
  const model=createStemFileAssignments();model.addFiles(files);
  check(model.getState().ready&&model.getFiles().transients===files[0]&&model.getFiles().voice===files[3],'One batch maps four categories');
  const before=JSON.stringify(model.getState());model.addFiles([]);model.addFiles(null);
  check(JSON.stringify(model.getState())===before,'Cancelled selection preserves candidates and assignments');
  model.addFiles([{...files[0]}]);
  check(model.getFiles().transients===files[0],'Reselection cannot silently replace the reviewed File object');
  model.addFiles([file('New_drums.wav')]);
  check(model.getFiles().transients===files[0],'Batch cannot silently overwrite an existing assignment');
  let rejected=false;try{model.assign('voice',files[0]);}catch(_){rejected=true;}
  check(rejected&&model.getFiles().voice===files[3],'Duplicate assignment rejects atomically');
  rejected=false;try{model.assign('voice',{...files[0]});}catch(_){rejected=true;}
  check(rejected,'Reselection of identical file metadata also counts as duplicate');
  model.assign('transients',null);model.assign('voice',files[0]);model.assign('transients',files[3]);
  check(model.getFiles().voice===files[0]&&model.getFiles().transients===files[3],'Explicit unassign/reassign supports manual corrections');
  const conflict=createStemFileAssignments();
  conflict.addFiles([file('drum_bass.wav'),file('mystery.wav'),file('other.wav'),file('vocal.wav')]);
  check(!conflict.getState().assignments.transients&&!conflict.getState().assignments.flow&&!conflict.getState().ready,
    'Ambiguous and unknown names are never guessed');
  conflict.assign('transients',file('drum_bass.wav'));conflict.assign('flow',file('mystery.wav'));
  check(conflict.getState().ready,'Unknown/ambiguous files can be assigned manually');
  const duplicateCategory=createStemFileAssignments();
  duplicateCategory.addFiles([file('one_drum.wav'),file('two_drums.wav'),file('bass.wav'),file('vocal.wav')]);
  check(!duplicateCategory.getState().assignments.transients,'Multiple matches for a category must not pick a winner');
  rejected=false;try{duplicateCategory.getFiles();}catch(_){rejected=true;}check(rejected,'Incomplete selection cannot load');
  const reverse=createStemFileAssignments();reverse.addFiles([...files].reverse());
  check(prototypeStemNames.every(name=>reverse.getFiles()[name]===createMapped(name)),'File order does not affect unique mapping');
  function createMapped(name){return files[{transients:0,flow:1,tune:2,voice:3}[name]];}
  // A second song is not an invitation to mix it into the reviewed first song.
  const switching=createStemFileAssignments();
  switching.addFiles(files);
  const nextFiles=['Next_drums.wav','Next_bass.wav','Next_other.wav','Next_vocals.wav'].map(file);
  const messages=switching.addFiles(nextFiles);
  check(messages.length===4&&prototypeStemNames.every(name=>switching.getFiles()[name]===createMapped(name)),
    'A second complete set retains every reviewed original assignment with explicit conflicts');
  switching.clear();switching.addFiles(nextFiles);
  check(switching.getState().candidates.length===4&&prototypeStemNames.every((name,i)=>switching.getFiles()[name]===nextFiles[i]),
    'Explicit clear then second complete set releases all old assignment references');
  const titleConflict=createStemFileAssignments();
  const ambiguous=titleConflict.addFiles(['Vocal Song_drums.wav','Vocal Song_bass.wav','Vocal Song_other.wav','Vocal Song_vocals.wav'].map(file));
  check(!titleConflict.getState().ready&&ambiguous.some(message=>message.includes('ambiguous filename')),
    'Category words in song titles remain ambiguous rather than loosening recognition');
  // Exact user-supplied names: do not normalize, abbreviate or rename these inputs.
  const reportedNames=[
    'Blessing Cassian Remix Harris Bass Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif',
    'Blessing Cassian Remix Harris Drums Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif',
    'Blessing Cassian Remix Harris Others Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif',
    'Blessing Cassian Remix Harris Vocals Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif'
  ];
  const reportedCategories=['flow','transients','tune','voice'];
  // Empty MIME is possible picker metadata; category recognition must use the unchanged name.
  const reportedFiles=reportedNames.map(name=>Object.freeze({...file(name),type:''}));
  const reported=createStemFileAssignments();
  const reportedMessages=reported.addFiles(reportedFiles);
  check(reportedMessages.length===0&&reported.getState().ready,'Exact reported AIF names auto-assign without ambiguity');
  reportedCategories.forEach((category,i)=>{
    check(recognizeStemFilename(reportedNames[i]).join()===category,'Exact reported filename recognizes only its category');
    check(reported.getFiles()[category]===reportedFiles[i]&&reportedFiles[i].name===reportedNames[i],
      'Assignment retains original read-only File reference and exact filename');
  });
  const priorSet=createStemFileAssignments();priorSet.addFiles(files);
  check(priorSet.addFiles(reportedFiles).length===4,'Exact reported set surfaces existing-assignment conflicts');
  priorSet.clear();priorSet.addFiles(reportedFiles);
  check(reportedCategories.every((category,i)=>priorSet.getFiles()[category]===reportedFiles[i]),
    'Clear then exact reported set removes stale song references without changing names');
  const second=createStemFileAssignments();check(!second.getState().ready,'Deck selections are independent');
  model.clear();check(!model.getState().ready&&model.getState().candidates.length===0,'Explicit clear releases selected file references');
  console.log('Batch stem assignment tests passed: mapping, singular/plural/case, conflicts, duplicates, cancellation and correction');
}
