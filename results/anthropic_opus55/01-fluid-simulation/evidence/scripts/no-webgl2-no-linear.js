// Init script: hide WebGL2 AND the half-float linear-filtering extension, forcing the WebGL1 path with
// manual bilinear filtering in the shaders (MANUAL_FILTERING / PRESSURE_NEAREST).
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type === 'webgl2') return null;
    const gl = orig.call(this, type, ...rest);
    if (gl && /webgl/i.test(type) && !gl.__patched) {
      const getExt = gl.getExtension.bind(gl);
      gl.getExtension = (name) => (/_linear$/.test(name) ? null : getExt(name));
      gl.__patched = true;
    }
    return gl;
  };
})();
