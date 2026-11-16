function runH531StateChecks() {
 let count=runH53StateChecks();
 const check=(value,label)=>{count++;if(!value)throw new Error(label);};
 const owners=TuneToxDesign.h531Pointers.createOwners();
 check(owners.claim(1,'high'),'First pointer claims a knob');
 check(owners.claim(2,'mid'),'Independent second knob');
 check(owners.claim(3,'main'),'Third independent fader');
 check(!owners.claim(4,'high'),'Second touch cannot steal a held knob');
 check(!owners.claim(1,'low'),'One pointer cannot control two controls');
 check(owners.count()===3,'Only successful owners retained');
 check(!owners.release(2,'high'),'Wrong control cannot release another pointer');
 check(owners.owner('high')===1,'Original ownership survives unrelated release');
 check(owners.release(2,'mid'),'Release exact owner');
 check(owners.count()===2&&owners.owner('main')===3,'Other active pointers survive');
 check(owners.claim(4,'mid'),'Released control can be acquired again');
 for(const [pointer,control] of owners.entries())owners.release(pointer,control);
 check(owners.count()===0,'Cancellation clears every owner');
 return count;
}
