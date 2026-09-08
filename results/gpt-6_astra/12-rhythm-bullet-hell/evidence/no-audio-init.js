// Test environment adapter: exercise real fallback when Web Audio is absent.
Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
