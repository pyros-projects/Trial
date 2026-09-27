// Init script: hide WebGL2 so the app must fall back to its WebGL1 + OES_texture_half_float path.
(() => { const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : orig.call(this, type, ...rest); }; })();
