// Init script: hide every WebGL context type to exercise the unsupported-capability path.
(() => { const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/i.test(type) ? null : orig.call(this, type, ...rest); }; })();
