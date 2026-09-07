(() => { const o = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t) { return t === 'webgl2' ? null : o.apply(this, arguments); }; })();
