// Force a real GLSL compilation failure through the browser's native shader compiler.
const originalSource=WebGL2RenderingContext.prototype.shaderSource;
WebGL2RenderingContext.prototype.shaderSource=function(shader,source){return originalSource.call(this,shader,source+'\nthis_is_invalid_glsl;');};
