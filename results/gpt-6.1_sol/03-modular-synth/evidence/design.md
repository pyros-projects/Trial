# Forma studio design

Deliver a complete offline music workstation in `index.html`. User explicitly requests one autonomous end-to-end run, so design and implementation decisions proceed without approval pauses. No git repository is present; the supplied directory is the isolated delivery workspace.

Use embedded CSS, inline SVG icons, native controls, Canvas visualizations, and Web Audio. Four independent tracks: three polyphonic melodic instruments and one four-voice procedural drum kit. Seeded defaults provide a musical A-minor loop. Sequencer overview, editable polyphonic piano roll / drum lanes, per-note velocity and gate, touch keyboard, synthesis inspector, mixer, effects and analyser views form one studio.

Live and OfflineAudioContext use the same graph and voice builders. A 25 ms look-ahead tick schedules 110 ms into AudioContext time. Visual frames consume scheduled events at their audio timestamp. Changes to tempo/swing apply at the next scheduled step. Stop/restart cancel voices and flush pending visual events. Voices track their lifecycle, release safely, and clean up oscillators/LFOs. Mixer mute/solo uses smoothed gains.

Project import validates version, finite bounded parameters and note arrays before replacing state. localStorage saves changes with a debounce. JSON and PCM stereo WAV download locally. Rendering is a frozen project snapshot with effect tails. No runtime fetches, external assets or imports.

Validation: deterministic timing, state normalization, events and WAV tests; real browser pointer/keyboard/edit/playback tests on desktop and phone; direct-file opening; blocked external HTTP requests; console/error/request audit; inspect actual audio waveform/FFT, graph values, and exported WAV samples. Audible listening is not implied by diagnostics.
