const originalShaderSource=WebGL2RenderingContext.prototype.shaderSource;
WebGL2RenderingContext.prototype.shaderSource=function(shader,source){return originalShaderSource.call(this,shader,source+'\nINTENTIONALLY_INVALID_SHADER_FOR_ERROR_HANDLING_CHECK\n');};
