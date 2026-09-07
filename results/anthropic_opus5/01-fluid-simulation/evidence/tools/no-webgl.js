(() => { const o = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t) {
    return /webgl/i.test(t) ? null : o.apply(this, arguments); }; })();
