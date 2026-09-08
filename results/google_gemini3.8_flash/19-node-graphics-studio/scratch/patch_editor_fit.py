with open('scratch/js_editor.py', 'r') as f:
    js = f.read()

# Improve fitView zoom clamping
js = js.replace(
    """    const scaleX = cRect.width / gw;
    const scaleY = cRect.height / gh;
    let targetZoom = Math.min(Math.min(scaleX, scaleY), 1.2);
    targetZoom = Math.max(0.35, targetZoom);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    state.zoom = targetZoom;
    state.pan.x = cRect.width / 2 - centerX * state.zoom;
    state.pan.y = cRect.height / 2 - centerY * state.zoom;""",
    """    const scaleX = (cRect.width - 60) / gw;
    const scaleY = (cRect.height - 60) / gh;
    let targetZoom = Math.min(Math.min(scaleX, scaleY), 0.95);
    targetZoom = Math.max(0.55, Math.min(1.0, targetZoom));

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    state.zoom = targetZoom;
    state.pan.x = cRect.width / 2 - centerX * state.zoom;
    state.pan.y = cRect.height / 2 - centerY * state.zoom;"""
)

with open('scratch/js_editor.py', 'w') as f:
    f.write(js)

print("Editor fitView patched.")
