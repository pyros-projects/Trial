// Development-only browser fault injection. Not part of the delivered artifact.
(() => {
 const original = HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext = function(type,...args) {
  if(type !== 'webgl2') return original.call(this,type,...args);
  if(!location.search.includes('shader')) return null;
  const gl=original.call(this,type,...args);
  if(!gl) return gl;
  const shaderSource=gl.shaderSource.bind(gl);
  gl.shaderSource=(shader,source)=>shaderSource(shader,gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER?'deliberate shader syntax error':source);
  return gl;
 };
})();
