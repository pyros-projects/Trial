import sys, os

import gen_css
import gen_html
import gen_glsl
import gen_nodes
import gen_presets
import js_state_compiler
import js_editor
import js_inspector
import js_timeline
import js_ui_export

print("Assembling index.html...")

css = gen_css.get_css()
html_body = gen_html.get_html_body()
glsl_preamble = gen_glsl.get_glsl_preamble()
nodes_js = gen_nodes.get_nodes_js()
presets_js = gen_presets.get_presets_js()
state_compiler_js = js_state_compiler.get_state_compiler_js()
editor_js = js_editor.get_editor_js()
inspector_js = js_inspector.get_inspector_js()
timeline_js = js_timeline.get_timeline_js()
ui_export_js = js_ui_export.get_ui_export_js()

# Escape backticks and dollar signs if any in glsl_preamble
escaped_glsl = glsl_preamble.replace('\\', '\\\\').replace('`', '\\`').replace('$', '\\$')

full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Node-Based Generative Graphics Studio</title>
<style>
{css}
</style>
</head>
<body data-theme="dark">
{html_body}

<script>
function getGlslPreamble() {{
  return `{escaped_glsl}`;
}}

{nodes_js}

{presets_js}

{state_compiler_js}

{editor_js}

{inspector_js}

{timeline_js}

{ui_export_js}
</script>
</body>
</html>
"""

output_path = os.path.abspath('index.html')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(full_html)

print(f"Successfully assembled {output_path}! File size: {len(full_html)} bytes ({len(full_html)/1024:.1f} KB)")
