const originalGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:originalGetContext.call(this,kind,...args);};
