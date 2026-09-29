(() => {
 const d=window.forma.diagnostics, resources=window.forma.engine.voices.size;
 if(d.playing || d.voices || d.held || resources) throw new Error(`Stopped engine must release resources: playing=${d.playing}, active=${d.voices}, held=${d.held}, resources=${resources}`);
 return {pass:true,resources};
})()
