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
  const second=createStemFileAssignments();check(!second.getState().ready,'Deck selections are independent');
  model.clear();check(!model.getState().ready&&model.getState().candidates.length===0,'Explicit clear releases selected file references');
  console.log('Batch stem assignment tests passed: mapping, singular/plural/case, conflicts, duplicates, cancellation and correction');
}
