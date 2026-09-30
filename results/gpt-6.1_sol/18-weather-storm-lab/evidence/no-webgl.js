// Test-only environment fault injection; delivered artifact remains unmodified.
const originalGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')return null;return originalGetContext.call(this,type,...args);};
