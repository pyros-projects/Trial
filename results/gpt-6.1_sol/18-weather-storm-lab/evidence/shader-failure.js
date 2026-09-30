// Test-only shader compiler fault injection; no runtime dependency.
WebGL2RenderingContext.prototype.getShaderParameter=function(){return false;};
WebGL2RenderingContext.prototype.getShaderInfoLog=function(){return 'Intentional validation shader compiler failure';};
