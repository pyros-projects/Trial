def get_presets_js():
    return """
const PRESETS = {
  'marble': {
    name: '1. Marble Texture',
    description: 'Elegantly veined polished marble stone with domain-warped fractal noise.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 180, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'fbm', title: 'Distortion fBm', x: 280, y: 120, params: { scale: 3.5, octaves: 4, lacunarity: 2.1, gain: 0.5, turbulence: true } },
      { id: 'n3', type: 'combine_vec', title: 'Warp Vector', x: 500, y: 120, params: { x: 0, y: 0, z: 0, w: 1 } },
      { id: 'n4', type: 'domain_warp', title: 'Domain Warp', x: 720, y: 180, params: { strength: 0.35 } },
      { id: 'n5', type: 'fbm', title: 'Marble Veins fBm', x: 940, y: 180, params: { scale: 5.0, octaves: 6, lacunarity: 2.0, gain: 0.55, turbulence: true } },
      { id: 'n6', type: 'color_ramp', title: 'Marble Palette', x: 1160, y: 180, params: {
        val: 0.5,
        stops: [
          { pos: 0.0, col: [0.12, 0.15, 0.18, 1.0] },
          { pos: 0.25, col: [0.35, 0.38, 0.42, 1.0] },
          { pos: 0.55, col: [0.88, 0.86, 0.82, 1.0] },
          { pos: 0.85, col: [0.96, 0.95, 0.94, 1.0] },
          { pos: 1.0, col: [0.85, 0.72, 0.45, 1.0] }
        ]
      }},
      { id: 'n7', type: 'final_output', title: 'Final Output', x: 1400, y: 200, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n2', toPort: 'uv' },
      { id: 'e2', fromNode: 'n2', fromPort: 'val', toNode: 'n3', toPort: 'x' },
      { id: 'e3', fromNode: 'n2', fromPort: 'val', toNode: 'n3', toPort: 'y' },
      { id: 'e4', fromNode: 'n1', fromPort: 'uv', toNode: 'n4', toPort: 'uv' },
      { id: 'e5', fromNode: 'n3', fromPort: 'vec2', toNode: 'n4', toPort: 'warp_vec' },
      { id: 'e6', fromNode: 'n4', fromPort: 'uv', toNode: 'n5', toPort: 'uv' },
      { id: 'e7', fromNode: 'n5', fromPort: 'val', toNode: 'n6', toPort: 'val' },
      { id: 'e8', fromNode: 'n6', fromPort: 'col', toNode: 'n7', toPort: 'color' }
    ]
  },

  'wood': {
    name: '2. Fine Wood Grain',
    description: 'Procedural oak tree rings warped by organic noise fibers.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 200, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'polar', title: 'Tree Center', x: 280, y: 100, params: { center: [0.5, 1.2] } },
      { id: 'n3', type: 'gradient_noise', title: 'Wood Grain Jitter', x: 280, y: 300, params: { scale: 18.0 } },
      { id: 'n4', type: 'add', title: 'Ring Perturbation', x: 500, y: 200, params: { a: 0, b: 0 } },
      { id: 'n5', type: 'multiply', title: 'Ring Density', x: 700, y: 200, params: { a: 1, b: 24.0 } },
      { id: 'n6', type: 'trig', title: 'Rings Modulator', x: 900, y: 200, params: { func: 'sin' } },
      { id: 'n7', type: 'remap', title: 'Normalize Rings', x: 1100, y: 200, params: { inMin: -1.0, inMax: 1.0, outMin: 0.0, outMax: 1.0, clamp: true } },
      { id: 'n8', type: 'color_ramp', title: 'Oak Wood Ramp', x: 1320, y: 200, params: {
        val: 0.5,
        stops: [
          { pos: 0.0, col: [0.24, 0.12, 0.05, 1.0] },
          { pos: 0.3, col: [0.42, 0.22, 0.09, 1.0] },
          { pos: 0.65, col: [0.65, 0.40, 0.20, 1.0] },
          { pos: 1.0, col: [0.82, 0.56, 0.32, 1.0] }
        ]
      }},
      { id: 'n9', type: 'final_output', title: 'Final Output', x: 1540, y: 220, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n2', toPort: 'uv' },
      { id: 'e2', fromNode: 'n1', fromPort: 'uv', toNode: 'n3', toPort: 'uv' },
      { id: 'e3', fromNode: 'n2', fromPort: 'r', toNode: 'n4', toPort: 'a' },
      { id: 'e4', fromNode: 'n3', fromPort: 'val', toNode: 'n4', toPort: 'b' },
      { id: 'e5', fromNode: 'n4', fromPort: 'out', toNode: 'n5', toPort: 'a' },
      { id: 'e6', fromNode: 'n5', fromPort: 'out', toNode: 'n6', toPort: 'in' },
      { id: 'e7', fromNode: 'n6', fromPort: 'out', toNode: 'n7', toPort: 'val' },
      { id: 'e8', fromNode: 'n7', fromPort: 'out', toNode: 'n8', toPort: 'val' },
      { id: 'e9', fromNode: 'n8', fromPort: 'col', toNode: 'n9', toPort: 'color' }
    ]
  },

  'clouds': {
    name: '3. Stylized Clouds',
    description: 'Drifting atmospheric clouds with soft smoothstep density over deep blue sky.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 220, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'time', title: 'Cloud Drift', x: 60, y: 380, params: { speed: 0.15, offset: 0 } },
      { id: 'n3', type: 'combine_vec', title: 'Wind Offset', x: 260, y: 350, params: { x: 0, y: 0, z: 0, w: 1 } },
      { id: 'n4', type: 'domain_warp', title: 'Cloud Translation', x: 460, y: 220, params: { strength: 1.0 } },
      { id: 'n5', type: 'fbm', title: 'Cloud Density fBm', x: 680, y: 220, params: { scale: 3.2, octaves: 6, lacunarity: 2.0, gain: 0.5, turbulence: false } },
      { id: 'n6', type: 'smoothstep', title: 'Cloud Threshold', x: 900, y: 220, params: { edge0: 0.42, edge1: 0.68, val: 0.5 } },
      { id: 'n7', type: 'gradient_linear', title: 'Sky Gradient', x: 900, y: 60, params: {
        angle_deg: 90,
        col_a: [0.15, 0.35, 0.85, 1.0],
        col_b: [0.65, 0.85, 1.0, 1.0]
      }},
      { id: 'n8', type: 'color_val', title: 'Cloud White', x: 900, y: 400, params: { color: [1.0, 1.0, 1.0, 1.0] } },
      { id: 'n9', type: 'mask', title: 'Cloud Over Sky', x: 1150, y: 200, params: { matte: 0.5 } },
      { id: 'n10', type: 'final_output', title: 'Final Output', x: 1380, y: 220, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n2', fromPort: 'time', toNode: 'n3', toPort: 'x' },
      { id: 'e2', fromNode: 'n1', fromPort: 'uv', toNode: 'n4', toPort: 'uv' },
      { id: 'e3', fromNode: 'n3', fromPort: 'vec2', toNode: 'n4', toPort: 'warp_vec' },
      { id: 'e4', fromNode: 'n4', fromPort: 'uv', toNode: 'n5', toPort: 'uv' },
      { id: 'e5', fromNode: 'n5', fromPort: 'val', toNode: 'n6', toPort: 'val' },
      { id: 'e6', fromNode: 'n8', fromPort: 'col', toNode: 'n9', toPort: 'fg' },
      { id: 'e7', fromNode: 'n7', fromPort: 'col', toNode: 'n9', toPort: 'bg' },
      { id: 'e8', fromNode: 'n6', fromPort: 'out', toNode: 'n9', toPort: 'matte' },
      { id: 'e9', fromNode: 'n9', fromPort: 'col', toNode: 'n10', toPort: 'color' }
    ]
  },

  'lava': {
    name: '4. Molten Lava Field',
    description: 'Pulsing incandescent magma fissures beneath cooling volcanic crust.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 200, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'sin_time', title: 'Lava Pulse', x: 60, y: 380, params: { frequency: 1.5, amplitude: 0.15, phase: 0, bias: 0.85 } },
      { id: 'n3', type: 'voronoi', title: 'Basalt Fractures', x: 300, y: 160, params: { scale: 5.0, jitter: 0.9, metric: 'Euclidean' } },
      { id: 'n4', type: 'multiply', title: 'Pulsing Cracks', x: 550, y: 200, params: { a: 1, b: 1 } },
      { id: 'n5', type: 'color_ramp', title: 'Magma Glow Ramp', x: 780, y: 160, params: {
        val: 0.5,
        stops: [
          { pos: 0.0, col: [0.05, 0.02, 0.02, 1.0] },
          { pos: 0.18, col: [0.65, 0.08, 0.02, 1.0] },
          { pos: 0.45, col: [1.0, 0.35, 0.02, 1.0] },
          { pos: 0.75, col: [1.0, 0.85, 0.1, 1.0] },
          { pos: 1.0, col: [1.0, 1.0, 0.9, 1.0] }
        ]
      }},
      { id: 'n6', type: 'fbm', title: 'Rock Texture', x: 780, y: 380, params: { scale: 8.0, octaves: 4, lacunarity: 2.0, gain: 0.5, turbulence: true } },
      { id: 'n7', type: 'blend', title: 'Crust Overlay', x: 1040, y: 240, params: { mode: 'Multiply', opacity: 0.4 } },
      { id: 'n8', type: 'final_output', title: 'Final Output', x: 1280, y: 250, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n3', toPort: 'uv' },
      { id: 'e2', fromNode: 'n3', fromPort: 'border', toNode: 'n4', toPort: 'a' },
      { id: 'e3', fromNode: 'n2', fromPort: 'val', toNode: 'n4', toPort: 'b' },
      { id: 'e4', fromNode: 'n4', fromPort: 'out', toNode: 'n5', toPort: 'val' },
      { id: 'e5', fromNode: 'n1', fromPort: 'uv', toNode: 'n6', toPort: 'uv' },
      { id: 'e6', fromNode: 'n5', fromPort: 'col', toNode: 'n7', toPort: 'base' },
      { id: 'e7', fromNode: 'n6', fromPort: 'val', toNode: 'n7', toPort: 'blend' },
      { id: 'e8', fromNode: 'n7', fromPort: 'col', toNode: 'n8', toPort: 'color' }
    ]
  },

  'circuit': {
    name: '5. Cyber Circuit Board',
    description: 'Manhattan Voronoi orthogonal bus traces with glowing electronic solder pads.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 220, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'voronoi', title: 'Manhattan Grid', x: 300, y: 150, params: { scale: 7.0, jitter: 1.0, metric: 'Manhattan' } },
      { id: 'n3', type: 'step', title: 'Trace Mask', x: 550, y: 150, params: { edge: 0.88, val: 0.5 } },
      { id: 'n4', type: 'color_val', title: 'PCB Substrate', x: 550, y: 320, params: { color: [0.03, 0.12, 0.08, 1.0] } },
      { id: 'n5', type: 'color_val', title: 'Glowing Trace Copper', x: 550, y: 440, params: { color: [0.0, 0.95, 0.65, 1.0] } },
      { id: 'n6', type: 'mask', title: 'Composite Traces', x: 800, y: 220, params: { matte: 0.5 } },
      { id: 'n7', type: 'sdf_ring', title: 'Solder Pads', x: 800, y: 400, params: { radius: 0.08, thickness: 0.04, blur: 0.01 } },
      { id: 'n8', type: 'blend', title: 'Blend Solder Rings', x: 1050, y: 260, params: { mode: 'Screen', opacity: 0.9 } },
      { id: 'n9', type: 'final_output', title: 'Final Output', x: 1280, y: 260, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n2', toPort: 'uv' },
      { id: 'e2', fromNode: 'n2', fromPort: 'f1', toNode: 'n3', toPort: 'val' },
      { id: 'e3', fromNode: 'n5', fromPort: 'col', toNode: 'n6', toPort: 'fg' },
      { id: 'e4', fromNode: 'n4', fromPort: 'col', toNode: 'n6', toPort: 'bg' },
      { id: 'e5', fromNode: 'n3', fromPort: 'out', toNode: 'n6', toPort: 'matte' },
      { id: 'e6', fromNode: 'n1', fromPort: 'uv', toNode: 'n7', toPort: 'uv' },
      { id: 'e7', fromNode: 'n6', fromPort: 'col', toNode: 'n8', toPort: 'base' },
      { id: 'e8', fromNode: 'n7', fromPort: 'mask', toNode: 'n8', toPort: 'blend' },
      { id: 'e9', fromNode: 'n8', fromPort: 'col', toNode: 'n9', toPort: 'color' }
    ]
  },

  'cellular': {
    name: '6. Cellular Organism',
    description: 'Pulsating biological tissue with undulating membranes and bioluminescent nuclei.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 220, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'sin_time', title: 'Breath Pulse', x: 60, y: 380, params: { frequency: 1.2, amplitude: 0.2, phase: 0, bias: 1.0 } },
      { id: 'n3', type: 'wave_warp', title: 'Organic Ripple', x: 300, y: 220, params: { frequency: 6.0, amplitude: 0.04, speed: 1.5 } },
      { id: 'n4', type: 'voronoi', title: 'Cell Membranes', x: 540, y: 200, params: { scale: 6.0, jitter: 0.85, metric: 'Euclidean' } },
      { id: 'n5', type: 'smoothstep', title: 'Membrane Wall', x: 780, y: 150, params: { edge0: 0.08, edge1: 0.35, val: 0.5 } },
      { id: 'n6', type: 'color_ramp', title: 'Bioluminescence', x: 1020, y: 180, params: {
        val: 0.5,
        stops: [
          { pos: 0.0, col: [0.02, 0.05, 0.12, 1.0] },
          { pos: 0.3, col: [0.08, 0.25, 0.45, 1.0] },
          { pos: 0.6, col: [0.12, 0.75, 0.65, 1.0] },
          { pos: 0.85, col: [0.85, 0.95, 0.98, 1.0] },
          { pos: 1.0, col: [1.0, 0.4, 0.8, 1.0] }
        ]
      }},
      { id: 'n7', type: 'final_output', title: 'Final Output', x: 1260, y: 200, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n3', toPort: 'uv' },
      { id: 'e2', fromNode: 'n3', fromPort: 'uv', toNode: 'n4', toPort: 'uv' },
      { id: 'e3', fromNode: 'n4', fromPort: 'border', toNode: 'n5', toPort: 'val' },
      { id: 'e4', fromNode: 'n5', fromPort: 'out', toNode: 'n6', toPort: 'val' },
      { id: 'e5', fromNode: 'n6', fromPort: 'col', toNode: 'n7', toPort: 'color' }
    ]
  },

  'neon_tunnel': {
    name: '7. Neon Hyperspace Tunnel',
    description: 'Infinite swirling synthwave tunnel in polar coordinates.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 220, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'time', title: 'Travel Speed', x: 60, y: 380, params: { speed: 0.8, offset: 0 } },
      { id: 'n3', type: 'polar', title: 'Tunnel Perspective', x: 280, y: 200, params: { center: [0.5, 0.5] } },
      { id: 'n4', type: 'divide', title: 'Perspective Inverse', x: 500, y: 150, params: { a: 0.8, b: 1 } },
      { id: 'n5', type: 'subtract', title: 'Forward Motion', x: 720, y: 180, params: { a: 1, b: 0 } },
      { id: 'n6', type: 'combine_vec', title: 'Tunnel UV', x: 920, y: 180, params: { x: 0, y: 0, z: 0, w: 1 } },
      { id: 'n7', type: 'tile_offset', title: 'Tunnel Tiling', x: 1120, y: 180, params: { tiling: [8, 12], offset: [0, 0] } },
      { id: 'n8', type: 'palette_map', title: 'Synthwave Neon', x: 1340, y: 180, params: { preset: 'Neon Synth' } },
      { id: 'n9', type: 'final_output', title: 'Final Output', x: 1560, y: 200, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n3', toPort: 'uv' },
      { id: 'e2', fromNode: 'n3', fromPort: 'r', toNode: 'n4', toPort: 'b' },
      { id: 'e3', fromNode: 'n4', fromPort: 'out', toNode: 'n5', toPort: 'a' },
      { id: 'e4', fromNode: 'n2', fromPort: 'time', toNode: 'n5', toPort: 'b' },
      { id: 'e5', fromNode: 'n5', fromPort: 'out', toNode: 'n6', toPort: 'x' },
      { id: 'e6', fromNode: 'n3', fromPort: 'theta', toNode: 'n6', toPort: 'y' },
      { id: 'e7', fromNode: 'n6', fromPort: 'vec2', toNode: 'n7', toPort: 'uv' },
      { id: 'e8', fromNode: 'n7', fromPort: 'uv', toNode: 'n8', toPort: 'val' },
      { id: 'e9', fromNode: 'n8', fromPort: 'col', toNode: 'n9', toPort: 'color' }
    ]
  },

  'terrain': {
    name: '8. Procedural Terrain & Biomes',
    description: 'Multi-octave heightfield with derived normal map, directional sun lighting, and altitude biomes.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 220, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'fbm', title: 'Terrain Heightfield', x: 280, y: 200, params: { scale: 3.5, octaves: 6, lacunarity: 2.0, gain: 0.5, turbulence: false } },
      { id: 'n3', type: 'color_ramp', title: 'Biome Elevation', x: 540, y: 120, params: {
        val: 0.5,
        stops: [
          { pos: 0.0, col: [0.05, 0.15, 0.35, 1.0] }, // Deep ocean
          { pos: 0.25, col: [0.12, 0.45, 0.65, 1.0] }, // Shallow water
          { pos: 0.28, col: [0.85, 0.75, 0.52, 1.0] }, // Beach sand
          { pos: 0.45, col: [0.18, 0.48, 0.22, 1.0] }, // Forest
          { pos: 0.72, col: [0.45, 0.42, 0.38, 1.0] }, // Mountain rock
          { pos: 0.88, col: [0.95, 0.96, 0.98, 1.0] }  // Snow peaks
        ]
      }},
      { id: 'n4', type: 'normal_map', title: 'Derive Normals', x: 540, y: 320, params: { strength: 6.0 } },
      { id: 'n5', type: 'phong', title: 'Sunlight Shading', x: 800, y: 200, params: {
        light_pos: [1.5, 2.0, 1.2],
        ambient: 0.3,
        diffuse: 0.8,
        specular: 0.4,
        shininess: 24.0
      }},
      { id: 'n6', type: 'final_output', title: 'Final Output', x: 1060, y: 220, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n2', toPort: 'uv' },
      { id: 'e2', fromNode: 'n2', fromPort: 'val', toNode: 'n3', toPort: 'val' },
      { id: 'e3', fromNode: 'n2', fromPort: 'val', toNode: 'n4', toPort: 'height' },
      { id: 'e4', fromNode: 'n1', fromPort: 'uv', toNode: 'n4', toPort: 'uv' },
      { id: 'e5', fromNode: 'n4', fromPort: 'normal', toNode: 'n5', toPort: 'normal' },
      { id: 'e6', fromNode: 'n3', fromPort: 'col', toNode: 'n5', toPort: 'base_col' },
      { id: 'e7', fromNode: 'n5', fromPort: 'col', toNode: 'n6', toPort: 'color' }
    ]
  },

  'plasma': {
    name: '9. Demoscene Plasma 1995',
    description: 'Classic sinusoidal multi-frequency wave interference and rotating palette.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 200, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'time', title: 'Time Driver', x: 60, y: 360, params: { speed: 1.5, offset: 0 } },
      { id: 'n3', type: 'multiply', title: 'Frequency Scale', x: 280, y: 160, params: { a: 1, b: 12.0 } },
      { id: 'n4', type: 'trig', title: 'Wave 1 (Sin X)', x: 500, y: 120, params: { func: 'sin' } },
      { id: 'n5', type: 'trig', title: 'Wave 2 (Cos Y)', x: 500, y: 260, params: { func: 'cos' } },
      { id: 'n6', type: 'add', title: 'Interference', x: 720, y: 180, params: { a: 0, b: 0 } },
      { id: 'n7', type: 'add', title: 'Time Modulation', x: 920, y: 200, params: { a: 0, b: 0 } },
      { id: 'n8', type: 'palette_map', title: 'Psychedelic Palette', x: 1140, y: 200, params: { preset: 'Rainbow' } },
      { id: 'n9', type: 'final_output', title: 'Final Output', x: 1360, y: 220, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n3', toPort: 'a' },
      { id: 'e2', fromNode: 'n3', fromPort: 'out', toNode: 'n4', toPort: 'in' },
      { id: 'e3', fromNode: 'n3', fromPort: 'out', toNode: 'n5', toPort: 'in' },
      { id: 'e4', fromNode: 'n4', fromPort: 'out', toNode: 'n6', toPort: 'a' },
      { id: 'e5', fromNode: 'n5', fromPort: 'out', toNode: 'n6', toPort: 'b' },
      { id: 'e6', fromNode: 'n6', fromPort: 'out', toNode: 'n7', toPort: 'a' },
      { id: 'e7', fromNode: 'n2', fromPort: 'time', toNode: 'n7', toPort: 'b' },
      { id: 'e8', fromNode: 'n7', fromPort: 'out', toNode: 'n8', toPort: 'val' },
      { id: 'e9', fromNode: 'n8', fromPort: 'col', toNode: 'n9', toPort: 'color' }
    ]
  },

  'poster': {
    name: '10. Bauhaus Modernist Poster',
    description: 'Crisp geometric composition with overlapping circle SDF, diagonal stripes, and risograph colors.',
    nodes: [
      { id: 'n1', type: 'uv', title: 'UV Coordinates', x: 60, y: 220, params: { scale: [1, 1], offset: [0, 0], centered: false } },
      { id: 'n2', type: 'sdf_circle', title: 'Center Sphere', x: 300, y: 120, params: { center: [0.5, 0.5], radius: 0.32, blur: 0.005 } },
      { id: 'n3', type: 'tile_offset', title: 'Diagonal Stripes', x: 300, y: 320, params: { tiling: [12, 12], offset: [0, 0] } },
      { id: 'n4', type: 'trig', title: 'Stripe Sine', x: 520, y: 320, params: { func: 'sin' } },
      { id: 'n5', type: 'step', title: 'Stripe Bands', x: 720, y: 320, params: { edge: 0.0, val: 0.5 } },
      { id: 'n6', type: 'color_val', title: 'Risograph Crimson', x: 720, y: 120, params: { color: [0.92, 0.18, 0.22, 1.0] } },
      { id: 'n7', type: 'color_val', title: 'Warm Cream BG', x: 720, y: 480, params: { color: [0.96, 0.94, 0.88, 1.0] } },
      { id: 'n8', type: 'color_val', title: 'Bauhaus Cobalt', x: 920, y: 240, params: { color: [0.12, 0.25, 0.78, 1.0] } },
      { id: 'n9', type: 'mask', title: 'Mask Circle', x: 1140, y: 160, params: { matte: 0.5 } },
      { id: 'n10', type: 'blend', title: 'Composite Poster', x: 1360, y: 200, params: { mode: 'Normal', opacity: 1.0 } },
      { id: 'n11', type: 'final_output', title: 'Final Output', x: 1580, y: 220, params: { gamma: 2.2, srgb: true } }
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromPort: 'uv', toNode: 'n2', toPort: 'uv' },
      { id: 'e2', fromNode: 'n1', fromPort: 'uv', toNode: 'n3', toPort: 'uv' },
      { id: 'e3', fromNode: 'n3', fromPort: 'uv', toNode: 'n4', toPort: 'in' },
      { id: 'e4', fromNode: 'n4', fromPort: 'out', toNode: 'n5', toPort: 'val' },
      { id: 'e5', fromNode: 'n6', fromPort: 'col', toNode: 'n9', toPort: 'fg' },
      { id: 'e6', fromNode: 'n7', fromPort: 'col', toNode: 'n9', toPort: 'bg' },
      { id: 'e7', fromNode: 'n2', fromPort: 'mask', toNode: 'n9', toPort: 'matte' },
      { id: 'e8', fromNode: 'n9', fromPort: 'col', toNode: 'n10', toPort: 'base' },
      { id: 'e9', fromNode: 'n8', fromPort: 'col', toNode: 'n10', toPort: 'blend' },
      { id: 'e10', fromNode: 'n10', fromPort: 'col', toNode: 'n11', toPort: 'color' }
    ]
  }
};
"""
