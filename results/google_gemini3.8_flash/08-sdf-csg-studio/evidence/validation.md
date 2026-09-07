# SDF and Constructive Solid Geometry Studio — Validation Report

**Project**: Real-Time Signed Distance Field (SDF) & Constructive Solid Geometry (CSG) Studio  
**File**: [index.html](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/index.html) (133 KB, completely self-contained WebGL 2 single-page application)  
**Verification Tool**: agent-browser (Chromium automated daemon)  
**Date**: September 7, 2026  

---

## 1. Executive Summary & Verification Matrix

The application is a zero-dependency, self-contained WebGL 2 3D Signed Distance Field (SDF) and Constructive Solid Geometry (CSG) studio. It implements an interactive sphere-tracing raymarcher with dynamic constructive solid geometry trees, analytical normals, screen-space ambient occlusion, soft penumbra shadows, refracted glass transmission with Beer-Lambert absorption, an interactive 3D translation gizmo, and full viewport GPU color-coded picking.

All core features, public checks, presets, responsive viewports, and persistence flows were exercised and verified using agent-browser.

| Check ID | Verification Area | Target / Expectation | Observed Behavior | Status | Evidence Artifact |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **CHK-01** | CSG Union | Union merges solid volumes seamlessly | Combined volume rendered with proper intersection contours | **PASS** | [evidence/csg_union.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_union.png) |
| **CHK-02** | CSG Subtraction | Shape B subtracted from Shape A scoops volume | Spherical cavity carved out from cube; interior receives cutter material | **PASS** | [evidence/csg_subtract.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_subtract.png) |
| **CHK-03** | CSG Intersection | Only overlapping volume retained | Overlapping lens of box and sphere rendered with shared bounds | **PASS** | [evidence/csg_intersect.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_intersect.png) |
| **CHK-04** | CSG Smooth Union | Polynomial smin blending creates organic fillet | Smooth continuous fillet joins box and sphere, blending both SDF and color | **PASS** | [evidence/csg_smooth_union.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_smooth_union.png) |
| **CHK-05** | Viewport Picking | Click on 3D surface selects object in stack/inspector | 1x1 GPU picking pass reads back object ID under mouse; selects object and moves gizmo | **PASS** | [evidence/pick_selection_box.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/pick_selection_box.png) |
| **CHK-06** | Stack Reordering | Changing top-to-bottom stack order changes geometry | Inverting sphere and box order flips subtraction from carved box to carved sphere | **PASS** | [evidence/reorder_test.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/reorder_test.png) |
| **CHK-07** | Material Properties | PBR-lite metallic, roughness, and color tuning | Specular highlights, metallic reflection, and roughness respond instantaneously | **PASS** | [evidence/mat_gold.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mat_gold.png) |
| **CHK-08** | Glass Transmission | Refraction with Beer-Lambert absorption | Secondary raymarched refracted ray traces interior ruby core with cyan absorption | **PASS** | [evidence/preset_glass.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_glass.png) |
| **CHK-09** | 8 Visualization Modes | Final, Normals, Depth, ID, Steps, Shadow, AO, Slice | All 8 diagnostic shaders compile and render accurate technical buffers | **PASS** | [evidence/mode_*.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/) |
| **CHK-10** | Curated Presets | 6 complex multi-primitive CSG scenes | Sculpture, Mechanical, Arch, Glass, Colonnade, Artifacts render without artifacts | **PASS** | [evidence/preset_*.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/) |
| **CHK-11** | Desktop Viewport | Seamless rendering on desktop (>= 1280x800) | Clean 3-column studio layout rendered at 1440x900 with active FPS HUD | **PASS** | [evidence/desktop_1440x900.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/desktop_1440x900.png) |
| **CHK-12** | Mobile Viewport | Responsive layout on 390x844 | Sidebars collapse into sliding drawer sheets accessible via bottom navigation bar | **PASS** | [evidence/mobile_390x844.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mobile_390x844.png) |
| **CHK-13** | Persistence & Recovery | LocalStorage auto-save and page reload restore | Scene state, object names, positions, materials, and ops restore identically on reload | **PASS** | [evidence/persistence_verified.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/persistence_verified.png) |
| **CHK-14** | JSON Export/Import | Full scene serialization and deserialization | Exported JSON string re-imports with identical topology and geometry | **PASS** | Verified via test script |

---

## 2. Test Execution Details

### 2.1 CSG Operations Verification

Using two overlapping primitives (a rounded box at origin and an offset sphere at [0.65, 0.5, 0.65]), we systematically tested the primary Boolean and blending operations:

1. **CSG Union (op = 0)**:
   - Both primitives combine into a continuous solid shell.
   - Evidence: [evidence/csg_union.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_union.png) shows the red sphere embedded into the blue rounded cube.
2. **CSG Subtraction (op = 1)**:
   - The cutter primitive removes volume from the target.
   - Evaluated formula: d_sub = max(d_A, -d_B).
   - Evidence: [evidence/csg_subtract.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_subtract.png) shows the spherical scoop removed from the cube, revealing the interior wall with the sphere material.
3. **CSG Intersection (op = 2)**:
   - Only the shared volume is retained.
   - Evaluated formula: d_int = max(d_A, d_B).
   - Evidence: [evidence/csg_intersect.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_intersect.png) displays the exact overlap volume.
4. **Smooth Union (op = 3, k = 0.35)**:
   - Polynomial smooth minimum formula blending both distance and surface material colors.
   - Evidence: [evidence/csg_smooth_union.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/csg_smooth_union.png) demonstrates the organic fillet blending geometry and material properties.

---

### 2.2 3D Viewport GPU Mouse Picking

GPU picking is implemented through a specialized 1x1 framebuffer render pass:
- When the user clicks on the 3D viewport, a dedicated picking shader marches a ray through that single pixel.
- Upon hitting a surface, it encodes the primitive unique ID into the color channel: fragColor = vec4(float(id + 1) / 255.0, 0, 0, 1.0).
- gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel) returns the exact object hit in constant time without any CPU mesh geometry overhead.
- Verification: Clicking at viewport coordinates {normX: 0.35, normY: 0.45} selected CSG Box (ID: 5), updated the Scene Stack active selection, positioned the 3D transform gizmo at the box pivot, and populated the Inspector panel with the box parameters (Half X/Y/Z = 0.90).
- Evidence: [evidence/pick_selection_box.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/pick_selection_box.png).

---

### 2.3 Scene Stack Reordering

Constructive solid geometry is non-commutative for subtraction and intersection:
- **Test**: The scene stack had CSG Box as Root and CSG Sphere as Subtraction (yielding a carved box).
- **Action**: Swapped order so that CSG Sphere is Root and CSG Box is Subtraction.
- **Result**: Geometry immediately updated to a sphere with a cubic chunk removed.
- Evidence: [evidence/reorder_test.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/reorder_test.png).

---

### 2.4 Eight Technical Visualization Modes

The studio includes eight live visualization modes selectable via the top navigation bar or keyboard shortcuts (1 to 8):

1. **Mode 0: Final Lit & Shaded** ([evidence/mode_0_final.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_0_final.png))  
   Full PBR-lite pipeline with key light, fill light, ambient occlusion, soft penumbra shadows, specular reflections, and tone mapping.
2. **Mode 1: Surface Normals** ([evidence/mode_1_normals.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_1_normals.png))  
   Calculated analytically via tetrahedron numerical gradient, mapped to RGB (0.5 * n + 0.5).
3. **Mode 2: Linear Depth Ramp** ([evidence/mode_2_depth.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_2_depth.png))  
   Displays ray distance normalized from camera near to far.
4. **Mode 3: Object ID Map** ([evidence/mode_3_id.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_3_id.png))  
   False-color mapping uniquely identifying each CSG primitive and its contribution to the final composite boundary.
5. **Mode 4: Ray Steps Heatmap** ([evidence/mode_4_steps.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_4_steps.png))  
   Thermal heatmap showing sphere tracer step count per pixel (grazing angles and CSG boundaries register higher step counts).
6. **Mode 5: Soft Shadows** ([evidence/mode_5_shadow.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_5_shadow.png))  
   Isolated penumbra shadow buffer calculated via Inigo Quilez cone-tracing shadow estimator.
7. **Mode 6: Ambient Occlusion** ([evidence/mode_6_ao.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_6_ao.png))  
   5-step normal-offset distance field ambient occlusion buffer.
8. **Mode 7: Distance Field Slice** ([evidence/mode_7_slice.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mode_7_slice.png))  
   Horizontal cutting plane displaying exact Signed Distance Field isoline contours: zero-crossing boundary highlighted in white, negative interior in warm red, positive exterior in concentric blue ripples.

---

### 2.5 Six Curated Presets

All six complex scenes load instantaneously and render cleanly without NaN or precision breakdown:

1. **Abstract Sculpture** ([evidence/preset_sculpture.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_sculpture.png)):  
   Bevelled pedestal, twisted pillar, golden torus, and smooth-blended iridescent sphere.
2. **Mechanical Cutaway** ([evidence/preset_mechanical.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_mechanical.png)):  
   Chamfered valve body with orthogonal bore subtractions, inspection quarter-cutaway, and internal piston.
3. **Impossible Arch** ([evidence/preset_arch.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_arch.png)):  
   Monumental archway with cylinder portal cutout and suspended glowing emissive halo ring.
4. **Glass Sculpture** ([evidence/preset_glass.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_glass.png)):  
   Hollowed-out glass vessel with secondary raymarched refraction, Beer-Lambert attenuation, brass base, and glowing internal ruby core.
5. **Repeating Colonnade** ([evidence/preset_colonnade.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_colonnade.png)):  
   Classical pavilion with four symmetric column pillars, ground podium, roof entablature, and central twisted obelisk.
6. **Numerical Artifact Sandbox** ([evidence/preset_artifacts.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/preset_artifacts.png)):  
   High-frequency wavy cylinder, razor-thin grazing plate, and near-tangent subtracted sphere demonstrating raymarching edge cases.

---

### 2.6 Responsive Layout & Mobile Usability

- **Desktop (1440x900)**:  
  Left Scene Stack sidebar, central high-resolution 3D viewport with camera toolbar and performance HUD, and right Inspector / Settings panel ([evidence/desktop_1440x900.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/desktop_1440x900.png)).
- **Mobile (390x844)**:  
  Sidebars automatically transform into slide-up drawer sheets ([evidence/mobile_stack_open.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mobile_stack_open.png) and [evidence/mobile_inspector_open.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/mobile_inspector_open.png)).  
  A bottom tab bar allows seamless toggling between Viewport, Stack, and Inspector.

---

### 2.7 Persistence & JSON Serialization

- **LocalStorage Auto-Save**: Tested by renaming a pillar to Custom Pillar Test, translating it, saving, and triggering a full browser reload. Upon reload, the scene restored all 4 objects with the custom name and translated coordinates ([evidence/persistence_verified.png](file:///home/pyro/projects/naked/gemini38/08-sdf-csg-studio/evidence/persistence_verified.png)).
- **JSON Export / Import**: Serialized the full scene graph to JSON, cleared the workspace, re-imported the JSON, and verified that object count, transform hierarchies, and CSG properties matched the original scene exactly.

---

## 3. Conformance & Non-Regression Summary

1. **Strictly Zero Dependencies**: No external CDN links, no NPM bundle dependencies, no external font downloads. Runs entirely offline from a local file:// URI.
2. **WebGL 2 Compatibility**: Tested with OpenGL ES Shading Language 3.00. Resolved strict ES typing restrictions.
3. **No Console Errors**: Executed window.__errors checks throughout all automation steps; zero errors recorded.
