// Application Entry Point & Animation Loop

window.addEventListener("DOMContentLoaded", () => {
  try {
    const canvas = document.getElementById("glcanvas");

    // Initialize Simulation, Renderer, Audio and UI
    const sim = new WeatherSimulation(48, 48, 14, 42);
    const renderer = new WeatherRenderer(canvas, sim);
    const audio = new WeatherAudio();
    const ui = new WeatherUI(sim, renderer, audio);

    // Expose for inspection and headless testing
    window.weatherSim = sim;
    window.weatherRenderer = renderer;
    window.weatherAudio = audio;
    window.weatherUI = ui;

    // Responsive Canvas Resize
    const resizeCanvas = () => {
      const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);
      const w = Math.floor(window.innerWidth * dpr * renderer.renderScale);
      const h = Math.floor(window.innerHeight * dpr * renderer.renderScale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Main Simulation & Animation Loop
    const animate = (now) => {
      requestAnimationFrame(animate);

      // Simulation update
      sim.step();

      // Render 3D Scene
      renderer.render();

      // Modulate Audio Engine
      audio.update(sim, renderer);

      // Update UI Diagnostics & Graphs
      ui.update();
    };

    requestAnimationFrame(animate);
    console.log("3D Weather and Storm Laboratory successfully initialized!");

  } catch (err) {
    console.error("Initialization error:", err);
    const fallback = document.getElementById("webglFallback");
    if (fallback) fallback.classList.add("open");
  }
});
