(() => {
 const step=document.querySelector('#sequencer .step'),note=document.querySelector('#pianoRoll .note-cell');
 const s=step.getBoundingClientRect(),n=note.getBoundingClientRect();
 if(document.documentElement.scrollWidth>innerWidth) throw new Error('Page overflows horizontally');
 if(s.width<20||n.width<20||n.height<18) throw new Error(`Touch targets too small: step=${s.width}, note=${n.width}×${n.height}`);
 return {pass:true,stepWidth:s.width,noteWidth:n.width,noteHeight:n.height,pageWidth:document.documentElement.scrollWidth};
})()
