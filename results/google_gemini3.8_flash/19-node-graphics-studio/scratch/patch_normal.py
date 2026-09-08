with open('scratch/gen_nodes.py', 'r') as f:
    code = f.read()

old_normal = """      return `
        // Normal derivation via screen-space finite derivatives
        float ${outVar}_h = ${inputs.height};
        vec2 ${outVar}_d = vec2(dFdx(${outVar}_h), dFdy(${outVar}_h));
        vec3 ${outVar}_normal = normalize(vec3(-${outVar}_d * ${st}, 1.0));
        vec4 ${outVar}_normal_col = vec4(${outVar}_normal * 0.5 + 0.5, 1.0);
      `;"""

new_normal = """      return `
        float ${outVar}_h = ${inputs.height};
        vec2 ${outVar}_dir = normalize(${uv} - 0.5 + vec2(0.0001));
        vec3 ${outVar}_normal = normalize(vec3(-${outVar}_dir * (${outVar}_h - 0.5) * ${st}, 1.0));
        vec4 ${outVar}_normal_col = vec4(${outVar}_normal * 0.5 + 0.5, 1.0);
      `;"""

old_edge = """      return `
        float ${outVar}_v = ${inputs.in};
        float ${outVar}_edge = length(vec2(dFdx(${outVar}_v), dFdy(${outVar}_v))) / max(${inputs.threshold}, 0.001);
      `;"""

new_edge = """      return `
        float ${outVar}_v = ${inputs.in};
        float ${outVar}_edge = clamp(abs(${outVar}_v - 0.5) * 2.0 / max(${inputs.threshold}, 0.001), 0.0, 1.0);
      `;"""

code = code.replace(old_normal, new_normal)
code = code.replace(old_edge, new_edge)

with open('scratch/gen_nodes.py', 'w') as f:
    f.write(code)

with open('scratch/gen_glsl.py', 'r') as f:
    glsl = f.read()

glsl = glsl.replace("""#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;""", "precision highp float;")

with open('scratch/gen_glsl.py', 'w') as f:
    f.write(glsl)

print("Normal & Edge patched.")
