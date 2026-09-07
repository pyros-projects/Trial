// Failure injection in the test browser only; delivered index.html is unchanged.
const originalContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')return null;return originalContext.call(this,type,...args);};
