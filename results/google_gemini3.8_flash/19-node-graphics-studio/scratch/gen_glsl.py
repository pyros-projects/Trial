def get_glsl_preamble():
    return """
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_frame;
uniform vec2 u_mouse;
uniform int u_diagnostic_mode; // 0=normal, 1=R, 2=G, 3=B, 4=A, 5=Luma, 6=Normal, 7=Range, 8=NaN
uniform float u_tiling;        // 1.0, 2.0, 3.0

#define PI 3.141592653589793
#define TWO_PI 6.283185307179586

// Hash functions
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash23(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// 2D Value Noise
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 2D Simplex / Gradient Noise
vec2 grad2(vec2 p) {
    float angle = hash21(p) * TWO_PI;
    return vec2(cos(angle), sin(angle));
}

float gradientNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    float n00 = dot(grad2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
    float n10 = dot(grad2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float n01 = dot(grad2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float n11 = dot(grad2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
    
    float nx0 = mix(n00, n10, u.x);
    float nx1 = mix(n01, n11, u.x);
    return mix(nx0, nx1, u.y) * 0.7071 + 0.5;
}

// Fractal Brownian Motion (fBm)
float fbm(vec2 p, int octaves, float lacunarity, float gain, bool turbulence) {
    float total = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    float maxAmp = 0.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        float n = gradientNoise(p * freq);
        if (turbulence) {
            n = abs(n * 2.0 - 1.0);
        }
        total += n * amp;
        maxAmp += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return total / maxAmp;
}

// Voronoi / Cellular Noise with metric selection
// metric: 0 = Euclidean, 1 = Manhattan, 2 = Chebyshev, 3 = Minkowski
void voronoiDist(vec2 p, int metric, float jitter, out float f1, out float f2, out vec3 cellColor, out float cellId) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    
    f1 = 8.0;
    f2 = 8.0;
    cellColor = vec3(0.0);
    cellId = 0.0;
    
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g) * jitter;
            vec2 delta = g + o - f;
            
            float d = 0.0;
            if (metric == 0) {
                d = length(delta); // Euclidean
            } else if (metric == 1) {
                d = abs(delta.x) + abs(delta.y); // Manhattan
            } else if (metric == 2) {
                d = max(abs(delta.x), abs(delta.y)); // Chebyshev
            } else {
                d = pow(pow(abs(delta.x), 1.5) + pow(abs(delta.y), 1.5), 1.0 / 1.5); // Minkowski
            }
            
            if (d < f1) {
                f2 = f1;
                f1 = d;
                cellColor = hash23(n + g);
                cellId = hash21(n + g);
            } else if (d < f2) {
                f2 = d;
            }
        }
    }
}

// Signed Distance Fields (SDF)
float sdfCircle(vec2 p, vec2 center, float r) {
    return length(p - center) - r;
}

float sdfBox(vec2 p, vec2 center, vec2 b, float r) {
    vec2 d = abs(p - center) - b + vec2(r);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

float sdfRing(vec2 p, vec2 center, float r, float th) {
    return abs(length(p - center) - r) - th * 0.5;
}

float sdfPolygon(vec2 p, vec2 center, float r, int sides) {
    p -= center;
    float s = float(sides);
    if (s < 3.0) s = 3.0;
    float an = TWO_PI / s;
    float a = atan(p.x, p.y) + PI;
    float bn = mod(a, an) - an * 0.5;
    return cos(bn) * length(p) - r;
}

float sdfStar(vec2 p, vec2 center, float rIn, float rOut, int points) {
    p -= center;
    float pt = float(points);
    if (pt < 3.0) pt = 3.0;
    float an = PI / pt;
    float a = atan(p.y, p.x) + PI;
    float bn = mod(a, 2.0 * an) - an;
    float l = length(p);
    float r = mix(rIn, rOut, step(an * 0.5, abs(bn)));
    return l - r;
}

float sdfLine(vec2 p, vec2 a, vec2 b, float th) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - th * 0.5;
}

float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * (1.0 / 4.0);
}

// Color and blending helpers
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TWO_PI * (c * t + d));
}

vec4 blendColors(vec4 base, vec4 blend, int mode, float opacity) {
    vec3 res = base.rgb;
    if (mode == 0) { // Normal
        res = blend.rgb;
    } else if (mode == 1) { // Multiply
        res = base.rgb * blend.rgb;
    } else if (mode == 2) { // Screen
        res = 1.0 - (1.0 - base.rgb) * (1.0 - blend.rgb);
    } else if (mode == 3) { // Overlay
        res = mix(2.0 * base.rgb * blend.rgb, 1.0 - 2.0 * (1.0 - base.rgb) * (1.0 - blend.rgb), step(vec3(0.5), base.rgb));
    } else if (mode == 4) { // Darken
        res = min(base.rgb, blend.rgb);
    } else if (mode == 5) { // Lighten
        res = max(base.rgb, blend.rgb);
    } else if (mode == 6) { // Color Dodge
        res = clamp(base.rgb / (max(vec3(1.0) - blend.rgb, vec3(0.001))), 0.0, 1.0);
    } else if (mode == 7) { // Color Burn
        res = clamp(1.0 - (1.0 - base.rgb) / max(blend.rgb, vec3(0.001)), 0.0, 1.0);
    } else if (mode == 8) { // Hard Light
        res = mix(2.0 * base.rgb * blend.rgb, 1.0 - 2.0 * (1.0 - base.rgb) * (1.0 - blend.rgb), step(vec3(0.5), blend.rgb));
    } else if (mode == 9) { // Soft Light
        res = (1.0 - 2.0 * blend.rgb) * base.rgb * base.rgb + 2.0 * blend.rgb * base.rgb;
    } else if (mode == 10) { // Difference
        res = abs(base.rgb - blend.rgb);
    } else if (mode == 11) { // Exclusion
        res = base.rgb + blend.rgb - 2.0 * base.rgb * blend.rgb;
    }
    float outAlpha = mix(base.a, max(base.a, blend.a), opacity);
    return vec4(mix(base.rgb, res, opacity * blend.a), outAlpha);
}

// Lighting calculation
vec3 calcBlinnPhong(vec3 norm, vec3 lightPos, vec3 baseCol, float amb, float diff, float spec, float shininess) {
    vec3 l = normalize(lightPos);
    vec3 v = vec3(0.0, 0.0, 1.0);
    vec3 h = normalize(l + v);
    
    float nDotL = max(dot(norm, l), 0.0);
    float nDotH = max(dot(norm, h), 0.0);
    float specFactor = pow(nDotH, shininess) * step(0.001, nDotL);
    
    vec3 diffuseCol = baseCol * (amb + diff * nDotL);
    vec3 specCol = vec3(spec * specFactor);
    return diffuseCol + specCol;
}

// MatCap sphere mapping
vec3 calcMatCap(vec3 norm, vec3 colA, vec3 colB, vec3 colRim) {
    vec2 muv = norm.xy * 0.5 + 0.5;
    float d = length(norm.xy);
    vec3 base = mix(colA, colB, muv.y);
    float rim = pow(1.0 - max(norm.z, 0.0), 3.0);
    return base + colRim * rim;
}

// Post diagnostics pass
vec4 applyDiagnostics(vec4 col, vec2 uv) {
    if (u_diagnostic_mode == 1) { // Red
        return vec4(vec3(col.r), 1.0);
    } else if (u_diagnostic_mode == 2) { // Green
        return vec4(vec3(col.g), 1.0);
    } else if (u_diagnostic_mode == 3) { // Blue
        return vec4(vec3(col.b), 1.0);
    } else if (u_diagnostic_mode == 4) { // Alpha
        return vec4(vec3(col.a), 1.0);
    } else if (u_diagnostic_mode == 5) { // Luminance
        float lum = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
        return vec4(vec3(lum), 1.0);
    } else if (u_diagnostic_mode == 6) { // Normal
        // Assumes col.rgb is a normal vector in [-1, 1] or [0, 1]
        vec3 n = normalize(col.rgb * 2.0 - 1.0);
        return vec4(n * 0.5 + 0.5, 1.0);
    } else if (u_diagnostic_mode == 7) { // Value Range clipping (Zebra stripes for <0 or >1)
        if (col.r < 0.0 || col.g < 0.0 || col.b < 0.0) {
            float stripe = step(0.5, fract((uv.x + uv.y) * 20.0));
            return vec4(0.0, stripe, 1.0, 1.0); // Blue zebra for underflow
        }
        if (col.r > 1.0 || col.g > 1.0 || col.b > 1.0) {
            float stripe = step(0.5, fract((uv.x + uv.y) * 20.0));
            return vec4(1.0, stripe, 0.0, 1.0); // Yellow zebra for overflow
        }
        return col;
    } else if (u_diagnostic_mode == 8) { // NaN detector
        if (col.r != col.r || col.g != col.g || col.b != col.b || col.a != col.a) {
            float stripe = step(0.5, fract((uv.x - uv.y) * 30.0));
            return vec4(1.0, 0.0, stripe, 1.0); // Magenta for NaN
        }
        return col;
    }
    return col;
}
"""
