import json

def get_nodes_js():
    return """
// Port types
const TYPE_FLOAT = 'float';
const TYPE_VEC2 = 'vec2';
const TYPE_VEC3 = 'vec3';
const TYPE_VEC4 = 'vec4'; // or color

const TYPE_COLORS = {
  [TYPE_FLOAT]: 'var(--port-float)',
  [TYPE_VEC2]: 'var(--port-vec2)',
  [TYPE_VEC3]: 'var(--port-vec3)',
  [TYPE_VEC4]: 'var(--port-vec4)'
};

// GLSL type promotion / conversion helper
function castGlsl(fromType, toType, varName) {
  if (fromType === toType) return varName;
  if (fromType === TYPE_FLOAT) {
    if (toType === TYPE_VEC2) return `vec2(${varName})`;
    if (toType === TYPE_VEC3) return `vec3(${varName})`;
    if (toType === TYPE_VEC4) return `vec4(vec3(${varName}), 1.0)`;
  } else if (fromType === TYPE_VEC2) {
    if (toType === TYPE_FLOAT) return `${varName}.x`;
    if (toType === TYPE_VEC3) return `vec3(${varName}, 0.0)`;
    if (toType === TYPE_VEC4) return `vec4(${varName}, 0.0, 1.0)`;
  } else if (fromType === TYPE_VEC3) {
    if (toType === TYPE_FLOAT) return `dot(${varName}, vec3(0.2126, 0.7152, 0.0722))`;
    if (toType === TYPE_VEC2) return `${varName}.xy`;
    if (toType === TYPE_VEC4) return `vec4(${varName}, 1.0)`;
  } else if (fromType === TYPE_VEC4) {
    if (toType === TYPE_FLOAT) return `dot(${varName}.rgb, vec3(0.2126, 0.7152, 0.0722))`;
    if (toType === TYPE_VEC2) return `${varName}.xy`;
    if (toType === TYPE_VEC3) return `${varName}.rgb`;
  }
  return varName;
}

// Node definitions registry
const NODE_TYPES = {
  // === Coordinates & UV ===
  'uv': {
    title: 'UV Coordinates',
    category: 'Coordinates',
    color: '#0284c7',
    inputs: [
      { name: 'scale', type: TYPE_VEC2, default: [1, 1], step: 0.1 },
      { name: 'offset', type: TYPE_VEC2, default: [0, 0], step: 0.05 },
      { name: 'centered', type: 'bool', default: false }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const s = inputs.scale;
      const o = inputs.offset;
      const c = node.params.centered;
      let base = 'v_uv';
      if (c) base = '(v_uv * 2.0 - 1.0)';
      return `vec2 ${outVar}_uv = (${base} * ${s}) + ${o};`;
    }
  },

  'screen_uv': {
    title: 'Screen UV',
    category: 'Coordinates',
    color: '#0284c7',
    inputs: [
      { name: 'aspect', type: 'bool', default: true }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      return node.params.aspect 
        ? `vec2 ${outVar}_uv = vec2((gl_FragCoord.x - 0.5 * u_resolution.x) / u_resolution.y + 0.5, gl_FragCoord.y / u_resolution.y);`
        : `vec2 ${outVar}_uv = gl_FragCoord.xy / u_resolution.xy;`;
    }
  },

  'polar': {
    title: 'Polar Coordinates',
    category: 'Coordinates',
    color: '#0284c7',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] }
    ],
    outputs: [
      { name: 'r', type: TYPE_FLOAT },
      { name: 'theta', type: TYPE_FLOAT },
      { name: 'polar_uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center;
      return `
        vec2 ${outVar}_diff = ${uv} - ${c};
        float ${outVar}_r = length(${outVar}_diff) * 2.0;
        float ${outVar}_theta = (atan(${outVar}_diff.y, ${outVar}_diff.x) / TWO_PI) + 0.5;
        vec2 ${outVar}_polar_uv = vec2(${outVar}_r, ${outVar}_theta);
      `;
    }
  },

  'split_vec': {
    title: 'Split Vector',
    category: 'Coordinates',
    color: '#0284c7',
    inputs: [
      { name: 'vec', type: TYPE_VEC4, default: [0, 0, 0, 1] }
    ],
    outputs: [
      { name: 'x', type: TYPE_FLOAT },
      { name: 'y', type: TYPE_FLOAT },
      { name: 'z', type: TYPE_FLOAT },
      { name: 'w', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const v = inputs.vec;
      return `
        float ${outVar}_x = ${v}.x;
        float ${outVar}_y = ${v}.y;
        float ${outVar}_z = ${v}.z;
        float ${outVar}_w = ${v}.w;
      `;
    }
  },

  'combine_vec': {
    title: 'Combine Vector',
    category: 'Coordinates',
    color: '#0284c7',
    inputs: [
      { name: 'x', type: TYPE_FLOAT, default: 0 },
      { name: 'y', type: TYPE_FLOAT, default: 0 },
      { name: 'z', type: TYPE_FLOAT, default: 0 },
      { name: 'w', type: TYPE_FLOAT, default: 1 }
    ],
    outputs: [
      { name: 'vec2', type: TYPE_VEC2 },
      { name: 'vec3', type: TYPE_VEC3 },
      { name: 'vec4', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const x = inputs.x, y = inputs.y, z = inputs.z, w = inputs.w;
      return `
        vec2 ${outVar}_vec2 = vec2(${x}, ${y});
        vec3 ${outVar}_vec3 = vec3(${x}, ${y}, ${z});
        vec4 ${outVar}_vec4 = vec4(${x}, ${y}, ${z}, ${w});
      `;
    }
  },

  'swizzle': {
    title: 'Swizzle',
    category: 'Coordinates',
    color: '#0284c7',
    inputs: [
      { name: 'in', type: TYPE_VEC4, default: [0, 0, 0, 1] },
      { name: 'swizzle', type: 'enum', default: 'xy', options: ['x', 'y', 'xy', 'yx', 'xyz', 'zyx', 'xzy', 'xyzw', 'wzyx', 'xxxx'] }
    ],
    outputs: [
      { name: 'out', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const sw = node.params.swizzle || 'xy';
      const v = inputs.in;
      if (sw.length === 1) {
        return `vec4 ${outVar}_out = vec4(vec3(${v}.${sw}), 1.0);`;
      } else if (sw.length === 2) {
        return `vec4 ${outVar}_out = vec4(${v}.${sw}, 0.0, 1.0);`;
      } else if (sw.length === 3) {
        return `vec4 ${outVar}_out = vec4(${v}.${sw}, 1.0);`;
      } else {
        return `vec4 ${outVar}_out = ${v}.${sw};`;
      }
    }
  },

  // === Time & Dynamics ===
  'time': {
    title: 'Time',
    category: 'Time',
    color: '#6366f1',
    inputs: [
      { name: 'speed', type: TYPE_FLOAT, default: 1.0, min: -10, max: 10, step: 0.1 },
      { name: 'offset', type: TYPE_FLOAT, default: 0.0, step: 0.1 }
    ],
    outputs: [
      { name: 'time', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const s = inputs.speed;
      const o = inputs.offset;
      return `float ${outVar}_time = u_time * ${s} + ${o};`;
    }
  },

  'frame': {
    title: 'Frame Number',
    category: 'Time',
    color: '#6366f1',
    inputs: [],
    outputs: [
      { name: 'frame', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_frame = u_frame;`;
    }
  },

  'sin_time': {
    title: 'Sinusoid Time',
    category: 'Time',
    color: '#6366f1',
    inputs: [
      { name: 'frequency', type: TYPE_FLOAT, default: 1.0, min: 0.01, max: 20, step: 0.1 },
      { name: 'amplitude', type: TYPE_FLOAT, default: 1.0, min: 0, max: 10, step: 0.1 },
      { name: 'phase', type: TYPE_FLOAT, default: 0.0, min: 0, max: 6.28, step: 0.1 },
      { name: 'bias', type: TYPE_FLOAT, default: 0.0, min: -5, max: 5, step: 0.1 }
    ],
    outputs: [
      { name: 'val', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const f = inputs.frequency, a = inputs.amplitude, p = inputs.phase, b = inputs.bias;
      return `float ${outVar}_val = sin(u_time * ${f} + ${p}) * ${a} + ${b};`;
    }
  },

  'bpm_pulse': {
    title: 'Beat Pulse',
    category: 'Time',
    color: '#6366f1',
    inputs: [
      { name: 'bpm', type: TYPE_FLOAT, default: 120.0, min: 30, max: 240, step: 1 },
      { name: 'decay', type: TYPE_FLOAT, default: 4.0, min: 1, max: 10, step: 0.2 }
    ],
    outputs: [
      { name: 'pulse', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const bpm = inputs.bpm, dec = inputs.decay;
      return `
        float ${outVar}_bps = ${bpm} / 60.0;
        float ${outVar}_phase = fract(u_time * ${outVar}_bps);
        float ${outVar}_pulse = exp(-${outVar}_phase * ${dec});
      `;
    }
  },

  // === Constants & Inputs ===
  'float_val': {
    title: 'Float Value',
    category: 'Constants',
    color: '#10b981',
    inputs: [
      { name: 'value', type: TYPE_FLOAT, default: 1.0, min: -100, max: 100, step: 0.05 }
    ],
    outputs: [
      { name: 'val', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_val = ${inputs.value};`;
    }
  },

  'vec2_val': {
    title: 'Vector2 Value',
    category: 'Constants',
    color: '#10b981',
    inputs: [
      { name: 'vec', type: TYPE_VEC2, default: [1.0, 1.0], step: 0.05 }
    ],
    outputs: [
      { name: 'vec', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      return `vec2 ${outVar}_vec = ${inputs.vec};`;
    }
  },

  'vec3_val': {
    title: 'Vector3 Value',
    category: 'Constants',
    color: '#10b981',
    inputs: [
      { name: 'vec', type: TYPE_VEC3, default: [1.0, 1.0, 1.0], step: 0.05 }
    ],
    outputs: [
      { name: 'vec', type: TYPE_VEC3 }
    ],
    compile: (node, inputs, outVar) => {
      return `vec3 ${outVar}_vec = ${inputs.vec};`;
    }
  },

  'color_val': {
    title: 'Color Constant',
    category: 'Constants',
    color: '#10b981',
    inputs: [
      { name: 'color', type: TYPE_VEC4, default: [0.8, 0.2, 0.4, 1.0] }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      return `vec4 ${outVar}_col = ${inputs.color};`;
    }
  },

  'comment': {
    title: 'Sticky Note',
    category: 'Constants',
    color: '#f59e0b',
    inputs: [],
    outputs: [],
    isComment: true,
    compile: () => ''
  },

  // === Math & Arithmetic ===
  'add': {
    title: 'Add',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 0.0 },
      { name: 'b', type: TYPE_FLOAT, default: 0.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = ${inputs.a} + ${inputs.b};`;
    }
  },

  'subtract': {
    title: 'Subtract',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 0.0 },
      { name: 'b', type: TYPE_FLOAT, default: 0.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = ${inputs.a} - ${inputs.b};`;
    }
  },

  'multiply': {
    title: 'Multiply',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 1.0 },
      { name: 'b', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = ${inputs.a} * ${inputs.b};`;
    }
  },

  'divide': {
    title: 'Divide',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 1.0 },
      { name: 'b', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = ${inputs.a} / (abs(${inputs.b}) < 0.00001 ? 0.00001 : ${inputs.b});`;
    }
  },

  'modulo': {
    title: 'Modulo',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 1.0 },
      { name: 'b', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = mod(${inputs.a}, max(${inputs.b}, 0.00001));`;
    }
  },

  'power': {
    title: 'Power',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 2.0 },
      { name: 'b', type: TYPE_FLOAT, default: 2.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = pow(max(${inputs.a}, 0.0), ${inputs.b});`;
    }
  },

  'min': {
    title: 'Minimum',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 0.0 },
      { name: 'b', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = min(${inputs.a}, ${inputs.b});`;
    }
  },

  'max': {
    title: 'Maximum',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 0.0 },
      { name: 'b', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = max(${inputs.a}, ${inputs.b});`;
    }
  },

  'abs': {
    title: 'Absolute Value',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'in', type: TYPE_FLOAT, default: 0.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = abs(${inputs.in});`;
    }
  },

  'sign': {
    title: 'Sign',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'in', type: TYPE_FLOAT, default: 0.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = sign(${inputs.in});`;
    }
  },

  'floor_ceil': {
    title: 'Floor / Ceil / Round',
    category: 'Math',
    color: '#eab308',
    inputs: [
      { name: 'in', type: TYPE_FLOAT, default: 0.0 },
      { name: 'mode', type: 'enum', default: 'floor', options: ['floor', 'ceil', 'round', 'fract'] }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const m = node.params.mode || 'floor';
      if (m === 'round') return `float ${outVar}_out = floor(${inputs.in} + 0.5);`;
      return `float ${outVar}_out = ${m}(${inputs.in});`;
    }
  },

  // === Remap & Shaping ===
  'clamp': {
    title: 'Clamp',
    category: 'Remap',
    color: '#f97316',
    inputs: [
      { name: 'val', type: TYPE_FLOAT, default: 0.5 },
      { name: 'min', type: TYPE_FLOAT, default: 0.0 },
      { name: 'max', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = clamp(${inputs.val}, ${inputs.min}, ${inputs.max});`;
    }
  },

  'remap': {
    title: 'Map Range',
    category: 'Remap',
    color: '#f97316',
    inputs: [
      { name: 'val', type: TYPE_FLOAT, default: 0.5 },
      { name: 'inMin', type: TYPE_FLOAT, default: 0.0 },
      { name: 'inMax', type: TYPE_FLOAT, default: 1.0 },
      { name: 'outMin', type: TYPE_FLOAT, default: 0.0 },
      { name: 'outMax', type: TYPE_FLOAT, default: 1.0 },
      { name: 'clamp', type: 'bool', default: true }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const v = inputs.val, i0 = inputs.inMin, i1 = inputs.inMax, o0 = inputs.outMin, o1 = inputs.outMax;
      const cl = node.params.clamp;
      let expr = `${o0} + (${v} - ${i0}) * (${o1} - ${o0}) / (abs(${i1} - ${i0}) < 0.0001 ? 0.0001 : (${i1} - ${i0}))`;
      if (cl) expr = `clamp(${expr}, min(${o0}, ${o1}), max(${o0}, ${o1}))`;
      return `float ${outVar}_out = ${expr};`;
    }
  },

  'step': {
    title: 'Step',
    category: 'Remap',
    color: '#f97316',
    inputs: [
      { name: 'edge', type: TYPE_FLOAT, default: 0.5 },
      { name: 'val', type: TYPE_FLOAT, default: 0.5 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = step(${inputs.edge}, ${inputs.val});`;
    }
  },

  'smoothstep': {
    title: 'Smoothstep',
    category: 'Remap',
    color: '#f97316',
    inputs: [
      { name: 'edge0', type: TYPE_FLOAT, default: 0.0 },
      { name: 'edge1', type: TYPE_FLOAT, default: 1.0 },
      { name: 'val', type: TYPE_FLOAT, default: 0.5 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = smoothstep(${inputs.edge0}, ${inputs.edge1}, ${inputs.val});`;
    }
  },

  'lerp': {
    title: 'Lerp / Mix',
    category: 'Remap',
    color: '#f97316',
    inputs: [
      { name: 'a', type: TYPE_FLOAT, default: 0.0 },
      { name: 'b', type: TYPE_FLOAT, default: 1.0 },
      { name: 't', type: TYPE_FLOAT, default: 0.5, min: 0, max: 1, step: 0.01 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = mix(${inputs.a}, ${inputs.b}, ${inputs.t});`;
    }
  },

  'tone_curve': {
    title: 'Tone Curve',
    category: 'Remap',
    color: '#f97316',
    inputs: [
      { name: 'in', type: TYPE_FLOAT, default: 0.5 },
      { name: 'gamma', type: TYPE_FLOAT, default: 1.0, min: 0.1, max: 4.0, step: 0.05 },
      { name: 'contrast', type: TYPE_FLOAT, default: 1.0, min: 0.1, max: 3.0, step: 0.05 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const x = inputs.in, g = inputs.gamma, c = inputs.contrast;
      return `
        float ${outVar}_c = pow(clamp(${x}, 0.0, 1.0), ${g});
        float ${outVar}_out = clamp((${outVar}_c - 0.5) * ${c} + 0.5, 0.0, 1.0);
      `;
    }
  },

  // === Trigonometry ===
  'trig': {
    title: 'Trigonometry',
    category: 'Trigonometry',
    color: '#ec4899',
    inputs: [
      { name: 'in', type: TYPE_FLOAT, default: 0.0 },
      { name: 'func', type: 'enum', default: 'sin', options: ['sin', 'cos', 'tan', 'asin', 'acos', 'radians', 'degrees'] }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const f = node.params.func || 'sin';
      if (f === 'asin' || f === 'acos') {
        return `float ${outVar}_out = ${f}(clamp(${inputs.in}, -1.0, 1.0));`;
      }
      return `float ${outVar}_out = ${f}(${inputs.in});`;
    }
  },

  'atan2': {
    title: 'Atan2',
    category: 'Trigonometry',
    color: '#ec4899',
    inputs: [
      { name: 'y', type: TYPE_FLOAT, default: 0.0 },
      { name: 'x', type: TYPE_FLOAT, default: 1.0 }
    ],
    outputs: [
      { name: 'out', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `float ${outVar}_out = atan(${inputs.y}, ${inputs.x});`;
    }
  },

  // === Transforms & Tiling ===
  'transform_2d': {
    title: 'Transform 2D',
    category: 'Transforms',
    color: '#8b5cf6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'translate', type: TYPE_VEC2, default: [0, 0], step: 0.05 },
      { name: 'rotate_deg', type: TYPE_FLOAT, default: 0.0, min: -360, max: 360, step: 1 },
      { name: 'scale', type: TYPE_VEC2, default: [1, 1], step: 0.1 },
      { name: 'pivot', type: TYPE_VEC2, default: [0.5, 0.5] }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const t = inputs.translate, r = inputs.rotate_deg, s = inputs.scale, p = inputs.pivot;
      return `
        float ${outVar}_rad = radians(${r});
        float ${outVar}_c = cos(${outVar}_rad);
        float ${outVar}_s = sin(${outVar}_rad);
        mat2 ${outVar}_rot = mat2(${outVar}_c, -${outVar}_s, ${outVar}_s, ${outVar}_c);
        vec2 ${outVar}_uv = ${outVar}_rot * ((${uv} - ${p} - ${t}) / max(${s}, vec2(0.0001))) + ${p};
      `;
    }
  },

  'tile_offset': {
    title: 'Tile & Offset',
    category: 'Transforms',
    color: '#8b5cf6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'tiling', type: TYPE_VEC2, default: [2, 2], step: 0.5 },
      { name: 'offset', type: TYPE_VEC2, default: [0, 0], step: 0.1 }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const t = inputs.tiling, o = inputs.offset;
      return `vec2 ${outVar}_uv = fract((${uv} + ${o}) * ${t});`;
    }
  },

  'mirror': {
    title: 'Mirror Symmetry',
    category: 'Transforms',
    color: '#8b5cf6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'mode', type: 'enum', default: 'quad', options: ['x', 'y', 'quad'] }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const m = node.params.mode || 'quad';
      if (m === 'x') return `vec2 ${outVar}_uv = vec2(abs(${uv}.x - 0.5) * 2.0, ${uv}.y);`;
      if (m === 'y') return `vec2 ${outVar}_uv = vec2(${uv}.x, abs(${uv}.y - 0.5) * 2.0);`;
      return `vec2 ${outVar}_uv = abs(${uv} - 0.5) * 2.0;`;
    }
  },

  'kaleidoscope': {
    title: 'Kaleidoscope',
    category: 'Transforms',
    color: '#8b5cf6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'segments', type: TYPE_FLOAT, default: 6, min: 2, max: 24, step: 1 },
      { name: 'rotation', type: TYPE_FLOAT, default: 0, min: -360, max: 360, step: 1 }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const seg = inputs.segments, rot = inputs.rotation;
      return `
        vec2 ${outVar}_p = ${uv} - 0.5;
        float ${outVar}_r = length(${outVar}_p);
        float ${outVar}_a = atan(${outVar}_p.y, ${outVar}_p.x) + radians(${rot});
        float ${outVar}_an = TWO_PI / max(${seg}, 2.0);
        ${outVar}_a = abs(mod(${outVar}_a, ${outVar}_an) - ${outVar}_an * 0.5);
        vec2 ${outVar}_uv = vec2(cos(${outVar}_a), sin(${outVar}_a)) * ${outVar}_r + 0.5;
      `;
    }
  },

  'polar_warp': {
    title: 'Polar Warp / Spiral',
    category: 'Transforms',
    color: '#8b5cf6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'spiral', type: TYPE_FLOAT, default: 1.0, min: -10, max: 10, step: 0.1 },
      { name: 'swirl', type: TYPE_FLOAT, default: 2.0, min: -10, max: 10, step: 0.1 }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const sp = inputs.spiral, sw = inputs.swirl;
      return `
        vec2 ${outVar}_p = ${uv} - 0.5;
        float ${outVar}_r = length(${outVar}_p);
        float ${outVar}_a = atan(${outVar}_p.y, ${outVar}_p.x) + ${outVar}_r * ${sw} + log(max(${outVar}_r, 0.001)) * ${sp};
        vec2 ${outVar}_uv = vec2(cos(${outVar}_a), sin(${outVar}_a)) * ${outVar}_r + 0.5;
      `;
    }
  },

  // === Random & Noise ===
  'hash_noise': {
    title: 'White Noise / Hash',
    category: 'Noise',
    color: '#14b8a6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'seed', type: TYPE_FLOAT, default: 42.0, step: 1.0 }
    ],
    outputs: [
      { name: 'val', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      return `float ${outVar}_val = hash21(${uv} * 100.0 + ${inputs.seed});`;
    }
  },

  'value_noise': {
    title: 'Value Noise',
    category: 'Noise',
    color: '#14b8a6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'scale', type: TYPE_FLOAT, default: 8.0, min: 0.5, max: 50.0, step: 0.5 }
    ],
    outputs: [
      { name: 'val', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      return `float ${outVar}_val = valueNoise(${uv} * ${inputs.scale});`;
    }
  },

  'gradient_noise': {
    title: 'Gradient / Simplex Noise',
    category: 'Noise',
    color: '#14b8a6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'scale', type: TYPE_FLOAT, default: 6.0, min: 0.5, max: 50.0, step: 0.5 }
    ],
    outputs: [
      { name: 'val', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      return `float ${outVar}_val = gradientNoise(${uv} * ${inputs.scale});`;
    }
  },

  'fbm': {
    title: 'Fractal Noise (fBm)',
    category: 'Noise',
    color: '#14b8a6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'scale', type: TYPE_FLOAT, default: 4.0, min: 0.5, max: 50.0, step: 0.5 },
      { name: 'octaves', type: 'int', default: 5, min: 1, max: 8, step: 1 },
      { name: 'lacunarity', type: TYPE_FLOAT, default: 2.0, min: 1.0, max: 4.0, step: 0.1 },
      { name: 'gain', type: TYPE_FLOAT, default: 0.5, min: 0.1, max: 1.0, step: 0.05 },
      { name: 'turbulence', type: 'bool', default: false }
    ],
    outputs: [
      { name: 'val', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const s = inputs.scale, oct = node.params.octaves, lac = inputs.lacunarity, g = inputs.gain;
      const turb = node.params.turbulence ? 'true' : 'false';
      return `float ${outVar}_val = fbm(${uv} * ${s}, ${oct}, ${lac}, ${g}, ${turb});`;
    }
  },

  'voronoi': {
    title: 'Voronoi / Cellular',
    category: 'Noise',
    color: '#14b8a6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'scale', type: TYPE_FLOAT, default: 6.0, min: 0.5, max: 50.0, step: 0.5 },
      { name: 'jitter', type: TYPE_FLOAT, default: 1.0, min: 0.0, max: 1.0, step: 0.05 },
      { name: 'metric', type: 'enum', default: 'Euclidean', options: ['Euclidean', 'Manhattan', 'Chebyshev', 'Minkowski'] }
    ],
    outputs: [
      { name: 'f1', type: TYPE_FLOAT },
      { name: 'f2', type: TYPE_FLOAT },
      { name: 'border', type: TYPE_FLOAT },
      { name: 'cell_color', type: TYPE_VEC3 },
      { name: 'cell_id', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const s = inputs.scale, j = inputs.jitter;
      const mIdx = ['Euclidean', 'Manhattan', 'Chebyshev', 'Minkowski'].indexOf(node.params.metric || 'Euclidean');
      return `
        float ${outVar}_f1, ${outVar}_f2, ${outVar}_cell_id;
        vec3 ${outVar}_cell_color;
        voronoiDist(${uv} * ${s}, ${mIdx >= 0 ? mIdx : 0}, ${j}, ${outVar}_f1, ${outVar}_f2, ${outVar}_cell_color, ${outVar}_cell_id);
        float ${outVar}_border = clamp((${outVar}_f2 - ${outVar}_f1) * 2.0, 0.0, 1.0);
      `;
    }
  },

  // === Shapes & SDF ===
  'sdf_circle': {
    title: 'Circle Shape',
    category: 'Shapes',
    color: '#06b6d4',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] },
      { name: 'radius', type: TYPE_FLOAT, default: 0.3, min: 0.01, max: 1.0, step: 0.02 },
      { name: 'blur', type: TYPE_FLOAT, default: 0.01, min: 0.0, max: 0.5, step: 0.01 }
    ],
    outputs: [
      { name: 'dist', type: TYPE_FLOAT },
      { name: 'mask', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center, r = inputs.radius, b = inputs.blur;
      return `
        float ${outVar}_dist = sdfCircle(${uv}, ${c}, ${r});
        float ${outVar}_mask = smoothstep(${b}, 0.0, ${outVar}_dist);
      `;
    }
  },

  'sdf_box': {
    title: 'Rectangle / Box',
    category: 'Shapes',
    color: '#06b6d4',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] },
      { name: 'size', type: TYPE_VEC2, default: [0.3, 0.2], step: 0.02 },
      { name: 'corner_radius', type: TYPE_FLOAT, default: 0.02, min: 0, max: 0.2, step: 0.01 },
      { name: 'blur', type: TYPE_FLOAT, default: 0.01, min: 0.0, max: 0.5, step: 0.01 }
    ],
    outputs: [
      { name: 'dist', type: TYPE_FLOAT },
      { name: 'mask', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center, sz = inputs.size, cr = inputs.corner_radius, b = inputs.blur;
      return `
        float ${outVar}_dist = sdfBox(${uv}, ${c}, ${sz}, ${cr});
        float ${outVar}_mask = smoothstep(${b}, 0.0, ${outVar}_dist);
      `;
    }
  },

  'sdf_ring': {
    title: 'Ring / Donut',
    category: 'Shapes',
    color: '#06b6d4',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] },
      { name: 'radius', type: TYPE_FLOAT, default: 0.3, min: 0.01, max: 1.0, step: 0.02 },
      { name: 'thickness', type: TYPE_FLOAT, default: 0.05, min: 0.005, max: 0.3, step: 0.005 },
      { name: 'blur', type: TYPE_FLOAT, default: 0.01, min: 0.0, max: 0.5, step: 0.01 }
    ],
    outputs: [
      { name: 'dist', type: TYPE_FLOAT },
      { name: 'mask', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center, r = inputs.radius, th = inputs.thickness, b = inputs.blur;
      return `
        float ${outVar}_dist = sdfRing(${uv}, ${c}, ${r}, ${th});
        float ${outVar}_mask = smoothstep(${b}, 0.0, ${outVar}_dist);
      `;
    }
  },

  'sdf_polygon': {
    title: 'Polygon / Star',
    category: 'Shapes',
    color: '#06b6d4',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] },
      { name: 'radius', type: TYPE_FLOAT, default: 0.3, min: 0.01, max: 1.0, step: 0.02 },
      { name: 'sides', type: 'int', default: 5, min: 3, max: 12, step: 1 },
      { name: 'blur', type: TYPE_FLOAT, default: 0.01, min: 0.0, max: 0.5, step: 0.01 }
    ],
    outputs: [
      { name: 'dist', type: TYPE_FLOAT },
      { name: 'mask', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center, r = inputs.radius, sides = node.params.sides, b = inputs.blur;
      return `
        float ${outVar}_dist = sdfPolygon(${uv}, ${c}, ${r}, ${sides});
        float ${outVar}_mask = smoothstep(${b}, 0.0, ${outVar}_dist);
      `;
    }
  },

  'sdf_boolean': {
    title: 'SDF Boolean',
    category: 'Shapes',
    color: '#06b6d4',
    inputs: [
      { name: 'd1', type: TYPE_FLOAT, default: 0.0 },
      { name: 'd2', type: TYPE_FLOAT, default: 0.0 },
      { name: 'op', type: 'enum', default: 'Union', options: ['Union', 'Intersection', 'Difference', 'SmoothUnion'] },
      { name: 'smooth_k', type: TYPE_FLOAT, default: 0.1, min: 0.01, max: 0.5, step: 0.01 }
    ],
    outputs: [
      { name: 'dist', type: TYPE_FLOAT },
      { name: 'mask', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const d1 = inputs.d1, d2 = inputs.d2, k = inputs.smooth_k;
      const op = node.params.op || 'Union';
      let expr = `min(${d1}, ${d2})`;
      if (op === 'Intersection') expr = `max(${d1}, ${d2})`;
      else if (op === 'Difference') expr = `max(${d1}, -${d2})`;
      else if (op === 'SmoothUnion') expr = `smin(${d1}, ${d2}, ${k})`;
      return `
        float ${outVar}_dist = ${expr};
        float ${outVar}_mask = smoothstep(0.01, 0.0, ${outVar}_dist);
      `;
    }
  },

  // === Filters & Neighborhood ===
  'normal_map': {
    title: 'Normal Map Derivation',
    category: 'Filters',
    color: '#3b82f6',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'height', type: TYPE_FLOAT, default: 0.5 },
      { name: 'strength', type: TYPE_FLOAT, default: 5.0, min: 0.1, max: 20.0, step: 0.2 }
    ],
    outputs: [
      { name: 'normal', type: TYPE_VEC3 },
      { name: 'normal_col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const st = inputs.strength;
      return `
        float ${outVar}_h = ${inputs.height};
        vec2 ${outVar}_dir = normalize(${uv} - 0.5 + vec2(0.0001));
        vec3 ${outVar}_normal = normalize(vec3(-${outVar}_dir * (${outVar}_h - 0.5) * ${st}, 1.0));
        vec4 ${outVar}_normal_col = vec4(${outVar}_normal * 0.5 + 0.5, 1.0);
      `;
    }
  },

  'edge_detect': {
    title: 'Edge Detect',
    category: 'Filters',
    color: '#3b82f6',
    inputs: [
      { name: 'in', type: TYPE_FLOAT, default: 0.5 },
      { name: 'threshold', type: TYPE_FLOAT, default: 0.1, min: 0.01, max: 1.0, step: 0.02 }
    ],
    outputs: [
      { name: 'edge', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      return `
        float ${outVar}_v = ${inputs.in};
        float ${outVar}_edge = clamp(abs(${outVar}_v - 0.5) * 2.0 / max(${inputs.threshold}, 0.001), 0.0, 1.0);
      `;
    }
  },

  // === Color & Gradients ===
  'gradient_linear': {
    title: 'Linear Gradient',
    category: 'Color',
    color: '#d946ef',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'angle_deg', type: TYPE_FLOAT, default: 0.0, min: 0, max: 360, step: 5 },
      { name: 'col_a', type: TYPE_VEC4, default: [0.1, 0.3, 0.8, 1.0] },
      { name: 'col_b', type: TYPE_VEC4, default: [0.9, 0.2, 0.5, 1.0] }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 },
      { name: 't', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const a = inputs.angle_deg, ca = inputs.col_a, cb = inputs.col_b;
      return `
        float ${outVar}_rad = radians(${a});
        vec2 ${outVar}_dir = vec2(cos(${outVar}_rad), sin(${outVar}_rad));
        float ${outVar}_t = clamp(dot(${uv} - 0.5, ${outVar}_dir) + 0.5, 0.0, 1.0);
        vec4 ${outVar}_col = mix(${ca}, ${cb}, ${outVar}_t);
      `;
    }
  },

  'gradient_radial': {
    title: 'Radial Gradient',
    category: 'Color',
    color: '#d946ef',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] },
      { name: 'radius', type: TYPE_FLOAT, default: 0.5, min: 0.01, max: 2.0, step: 0.05 },
      { name: 'col_a', type: TYPE_VEC4, default: [1.0, 0.8, 0.2, 1.0] },
      { name: 'col_b', type: TYPE_VEC4, default: [0.1, 0.0, 0.2, 1.0] }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 },
      { name: 't', type: TYPE_FLOAT }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center, r = inputs.radius, ca = inputs.col_a, cb = inputs.col_b;
      return `
        float ${outVar}_t = clamp(length(${uv} - ${c}) / max(${r}, 0.001), 0.0, 1.0);
        vec4 ${outVar}_col = mix(${ca}, ${cb}, ${outVar}_t);
      `;
    }
  },

  'color_ramp': {
    title: 'Color Ramp',
    category: 'Color',
    color: '#d946ef',
    inputs: [
      { name: 'val', type: TYPE_FLOAT, default: 0.5, min: 0, max: 1, step: 0.01 }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    // Ramp stops stored in node.params.stops = [{pos: 0.0, col: [r,g,b,a]}, ...]
    compile: (node, inputs, outVar) => {
      const stops = node.params.stops || [
        { pos: 0.0, col: [0.0, 0.0, 0.0, 1.0] },
        { pos: 1.0, col: [1.0, 1.0, 1.0, 1.0] }
      ];
      const sorted = [...stops].sort((a,b) => a.pos - b.pos);
      const val = inputs.val;
      
      let glsl = `
        float ${outVar}_v = clamp(${val}, 0.0, 1.0);
        vec4 ${outVar}_col = vec4(${sorted[0].col.join(', ')});
      `;
      for (let i = 0; i < sorted.length - 1; i++) {
        const s0 = sorted[i];
        const s1 = sorted[i+1];
        const c0 = `vec4(${s0.col.map(x=>Number(x).toFixed(4)).join(', ')})`;
        const c1 = `vec4(${s1.col.map(x=>Number(x).toFixed(4)).join(', ')})`;
        glsl += `
          if (${outVar}_v >= ${s0.pos.toFixed(4)}) {
            float t = clamp((${outVar}_v - ${s0.pos.toFixed(4)}) / max(${((s1.pos - s0.pos) || 0.0001).toFixed(4)}, 0.0001), 0.0, 1.0);
            ${outVar}_col = mix(${c0}, ${c1}, t);
          }
        `;
      }
      return glsl;
    }
  },

  'color_adjust': {
    title: 'Color Adjust (HSV / Contrast)',
    category: 'Color',
    color: '#d946ef',
    inputs: [
      { name: 'col', type: TYPE_VEC4, default: [0.8, 0.3, 0.2, 1.0] },
      { name: 'hue_shift', type: TYPE_FLOAT, default: 0.0, min: -1.0, max: 1.0, step: 0.02 },
      { name: 'saturation', type: TYPE_FLOAT, default: 1.0, min: 0.0, max: 3.0, step: 0.05 },
      { name: 'brightness', type: TYPE_FLOAT, default: 1.0, min: 0.0, max: 3.0, step: 0.05 },
      { name: 'contrast', type: TYPE_FLOAT, default: 1.0, min: 0.0, max: 3.0, step: 0.05 }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const col = inputs.col, h = inputs.hue_shift, s = inputs.saturation, b = inputs.brightness, c = inputs.contrast;
      return `
        vec3 ${outVar}_hsv = rgb2hsv(${col}.rgb);
        ${outVar}_hsv.x = fract(${outVar}_hsv.x + ${h});
        ${outVar}_hsv.y = clamp(${outVar}_hsv.y * ${s}, 0.0, 1.0);
        ${outVar}_hsv.z = clamp(${outVar}_hsv.z * ${b}, 0.0, 1.0);
        vec3 ${outVar}_rgb = hsv2rgb(${outVar}_hsv);
        ${outVar}_rgb = clamp((${outVar}_rgb - 0.5) * ${c} + 0.5, 0.0, 1.0);
        vec4 ${outVar}_col = vec4(${outVar}_rgb, ${col}.a);
      `;
    }
  },

  'palette_map': {
    title: 'Cosine Palette Map',
    category: 'Color',
    color: '#d946ef',
    inputs: [
      { name: 'val', type: TYPE_FLOAT, default: 0.5 },
      { name: 'preset', type: 'enum', default: 'Neon Synth', options: ['Neon Synth', 'Rainbow', 'Fire & Magma', 'Emerald Forest', 'Pastel Dream'] }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const p = node.params.preset || 'Neon Synth';
      let a = 'vec3(0.5, 0.5, 0.5)', b = 'vec3(0.5, 0.5, 0.5)', c = 'vec3(1.0, 1.0, 1.0)', d = 'vec3(0.0, 0.33, 0.67)';
      if (p === 'Rainbow') {
        a = 'vec3(0.5)'; b = 'vec3(0.5)'; c = 'vec3(1.0)'; d = 'vec3(0.0, 0.33, 0.67)';
      } else if (p === 'Fire & Magma') {
        a = 'vec3(0.5, 0.4, 0.2)'; b = 'vec3(0.5, 0.4, 0.2)'; c = 'vec3(2.0, 1.0, 0.0)'; d = 'vec3(0.5, 0.2, 0.25)';
      } else if (p === 'Emerald Forest') {
        a = 'vec3(0.2, 0.5, 0.3)'; b = 'vec3(0.2, 0.4, 0.2)'; c = 'vec3(1.0, 1.0, 1.0)'; d = 'vec3(0.0, 0.1, 0.2)';
      } else if (p === 'Pastel Dream') {
        a = 'vec3(0.8, 0.5, 0.4)'; b = 'vec3(0.2, 0.4, 0.2)'; c = 'vec3(2.0, 1.0, 1.0)'; d = 'vec3(0.0, 0.25, 0.25)';
      }
      return `vec4 ${outVar}_col = vec4(cosinePalette(${inputs.val}, ${a}, ${b}, ${c}, ${d}), 1.0);`;
    }
  },

  // === Blend Modes & Masks ===
  'blend': {
    title: 'Blend',
    category: 'Blend',
    color: '#a855f7',
    inputs: [
      { name: 'base', type: TYPE_VEC4, default: [0.2, 0.2, 0.3, 1.0] },
      { name: 'blend', type: TYPE_VEC4, default: [0.8, 0.4, 0.1, 1.0] },
      { name: 'mode', type: 'enum', default: 'Normal', options: ['Normal', 'Multiply', 'Screen', 'Overlay', 'Darken', 'Lighten', 'Color Dodge', 'Color Burn', 'Hard Light', 'Soft Light', 'Difference', 'Exclusion'] },
      { name: 'opacity', type: TYPE_FLOAT, default: 1.0, min: 0.0, max: 1.0, step: 0.02 }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const modes = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Darken', 'Lighten', 'Color Dodge', 'Color Burn', 'Hard Light', 'Soft Light', 'Difference', 'Exclusion'];
      const mIdx = Math.max(0, modes.indexOf(node.params.mode || 'Normal'));
      return `vec4 ${outVar}_col = blendColors(${inputs.base}, ${inputs.blend}, ${mIdx}, ${inputs.opacity});`;
    }
  },

  'mask': {
    title: 'Mask / Matte',
    category: 'Blend',
    color: '#a855f7',
    inputs: [
      { name: 'fg', type: TYPE_VEC4, default: [1.0, 0.2, 0.4, 1.0] },
      { name: 'bg', type: TYPE_VEC4, default: [0.1, 0.1, 0.1, 1.0] },
      { name: 'matte', type: TYPE_FLOAT, default: 0.5, min: 0.0, max: 1.0, step: 0.02 }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      return `vec4 ${outVar}_col = mix(${inputs.bg}, ${inputs.fg}, clamp(${inputs.matte}, 0.0, 1.0));`;
    }
  },

  // === Warp & Distortion ===
  'domain_warp': {
    title: 'Domain Warp',
    category: 'Warp',
    color: '#f43f5e',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'warp_vec', type: TYPE_VEC2, default: [0.0, 0.0] },
      { name: 'strength', type: TYPE_FLOAT, default: 0.2, min: 0.0, max: 2.0, step: 0.02 }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      return `vec2 ${outVar}_uv = ${uv} + (${inputs.warp_vec} - 0.5) * ${inputs.strength};`;
    }
  },

  'twirl': {
    title: 'Twirl / Vortex',
    category: 'Warp',
    color: '#f43f5e',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'center', type: TYPE_VEC2, default: [0.5, 0.5] },
      { name: 'radius', type: TYPE_FLOAT, default: 0.5, min: 0.05, max: 2.0, step: 0.05 },
      { name: 'angle_deg', type: TYPE_FLOAT, default: 90.0, min: -720, max: 720, step: 5 }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const c = inputs.center, r = inputs.radius, a = inputs.angle_deg;
      return `
        vec2 ${outVar}_p = ${uv} - ${c};
        float ${outVar}_d = length(${outVar}_p);
        float ${outVar}_pct = clamp(1.0 - ${outVar}_d / max(${r}, 0.001), 0.0, 1.0);
        float ${outVar}_ang = radians(${a}) * ${outVar}_pct * ${outVar}_pct;
        float ${outVar}_ca = cos(${outVar}_ang), ${outVar}_sa = sin(${outVar}_ang);
        mat2 ${outVar}_rot = mat2(${outVar}_ca, -${outVar}_sa, ${outVar}_sa, ${outVar}_ca);
        vec2 ${outVar}_uv = ${outVar}_rot * ${outVar}_p + ${c};
      `;
    }
  },

  'wave_warp': {
    title: 'Wave / Ripple',
    category: 'Warp',
    color: '#f43f5e',
    inputs: [
      { name: 'uv', type: TYPE_VEC2, default: null },
      { name: 'frequency', type: TYPE_FLOAT, default: 10.0, min: 0.5, max: 50.0, step: 0.5 },
      { name: 'amplitude', type: TYPE_FLOAT, default: 0.05, min: 0.0, max: 0.5, step: 0.01 },
      { name: 'speed', type: TYPE_FLOAT, default: 2.0, min: -10, max: 10, step: 0.2 }
    ],
    outputs: [
      { name: 'uv', type: TYPE_VEC2 }
    ],
    compile: (node, inputs, outVar) => {
      const uv = inputs.uv || 'v_uv';
      const f = inputs.frequency, a = inputs.amplitude, s = inputs.speed;
      return `
        float ${outVar}_w = sin(${uv}.y * ${f} + u_time * ${s}) * ${a};
        vec2 ${outVar}_uv = ${uv} + vec2(${outVar}_w, 0.0);
      `;
    }
  },

  // === Lighting & Material ===
  'phong': {
    title: 'Phong Lighting',
    category: 'Lighting',
    color: '#fbbf24',
    inputs: [
      { name: 'normal', type: TYPE_VEC3, default: [0, 0, 1] },
      { name: 'light_pos', type: TYPE_VEC3, default: [1.0, 1.0, 2.0] },
      { name: 'base_col', type: TYPE_VEC4, default: [0.8, 0.3, 0.2, 1.0] },
      { name: 'ambient', type: TYPE_FLOAT, default: 0.2, min: 0.0, max: 1.0, step: 0.05 },
      { name: 'diffuse', type: TYPE_FLOAT, default: 0.8, min: 0.0, max: 2.0, step: 0.05 },
      { name: 'specular', type: TYPE_FLOAT, default: 0.5, min: 0.0, max: 3.0, step: 0.05 },
      { name: 'shininess', type: TYPE_FLOAT, default: 32.0, min: 1.0, max: 128.0, step: 2.0 }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const n = inputs.normal, l = inputs.light_pos, bc = inputs.base_col;
      const amb = inputs.ambient, diff = inputs.diffuse, spec = inputs.specular, sh = inputs.shininess;
      return `
        vec3 ${outVar}_lit = calcBlinnPhong(normalize(${n}), ${l}, ${bc}.rgb, ${amb}, ${diff}, ${spec}, ${sh});
        vec4 ${outVar}_col = vec4(${outVar}_lit, ${bc}.a);
      `;
    }
  },

  'matcap': {
    title: 'MatCap Sphere Map',
    category: 'Lighting',
    color: '#fbbf24',
    inputs: [
      { name: 'normal', type: TYPE_VEC3, default: [0, 0, 1] },
      { name: 'col_a', type: TYPE_VEC4, default: [0.2, 0.4, 0.8, 1.0] },
      { name: 'col_b', type: TYPE_VEC4, default: [0.9, 0.7, 0.3, 1.0] },
      { name: 'col_rim', type: TYPE_VEC4, default: [1.0, 1.0, 1.0, 1.0] }
    ],
    outputs: [
      { name: 'col', type: TYPE_VEC4 }
    ],
    compile: (node, inputs, outVar) => {
      const n = inputs.normal, ca = inputs.col_a, cb = inputs.col_b, cr = inputs.col_rim;
      return `
        vec3 ${outVar}_mc = calcMatCap(normalize(${n}), ${ca}.rgb, ${cb}.rgb, ${cr}.rgb);
        vec4 ${outVar}_col = vec4(${outVar}_mc, 1.0);
      `;
    }
  },

  // === Final Output ===
  'final_output': {
    title: 'Final Output',
    category: 'Output',
    color: '#22c55e',
    inputs: [
      { name: 'color', type: TYPE_VEC4, default: [0.0, 0.0, 0.0, 1.0] },
      { name: 'gamma', type: TYPE_FLOAT, default: 2.2, min: 1.0, max: 3.0, step: 0.1 },
      { name: 'srgb', type: 'bool', default: true }
    ],
    outputs: [],
    isOutput: true,
    compile: (node, inputs, outVar) => {
      const c = inputs.color, g = inputs.gamma;
      const srgb = node.params.srgb;
      if (srgb) {
        return `
          vec4 ${outVar}_out = ${c};
          ${outVar}_out.rgb = pow(clamp(${outVar}_out.rgb, 0.0, 1.0), vec3(1.0 / ${g}));
        `;
      }
      return `vec4 ${outVar}_out = ${c};`;
    }
  }
};
"""
