# Real Apps in the public gallery

Prompts 21–30 have two delivery targets: the complete local application and a disposable public demo. The demo makes the workflow inspectable on static Netlify hosting. It does not establish backend durability, authentication security, real HTTP delivery, or independent-device synchronization.

The following contract is embedded in each Real Apps prompt so it remains self-contained.

## Public gallery delivery

Deliver the complete local application **and** a generated, self-contained demo at `project/gallery/index.html`. The application requirements, runtime contract, and original acceptance scenarios below still apply to the full local application. The following exceptions apply only to the gallery build; a demo-only submission is incomplete.

Generate the demo from the delivered source using a concrete command documented in the project README. Inline all JavaScript, CSS, fonts, images, and synthetic seed fixtures into this one HTML file. Do not require sibling assets, a build on the hosting service, environment variables, credentials, a backend, a companion process, or any runtime network request. Use in-memory or hash navigation so every screen works from the same file, including under a nested URL. The gallery publishes this file only, never your server, database, functions, or deployment configuration.

Use the same interface and genuine domain rules as the full app. Share domain code where practical; otherwise test the browser implementation against the same fixtures and additional valid inputs. Replace only persistence and transport with explicit in-memory adapters. Implement actual parsing, validation, transactions, versions, history, scheduling, and other required algorithms; do not replace them with canned responses, precomputed fixture answers, or disabled primary workflows. Task-specific demo controls may simulate actors, devices, transport, and faults, but must say that they are simulations. They do not count as evidence of real backend or security guarantees.

Keep every mutable value in the current document's memory, including uploads, draft copies, history, operation keys, queues, and simulated service state. Do not use cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service workers, shared workers, or an external store. Do not call fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, analytics, external APIs, Netlify Forms, Functions, Blobs, or a database. Do not add `netlify` or `data-netlify` form attributes. Handle forms in JavaScript without navigation. File inputs and explicit Blob downloads are allowed; imports must be bounded, validated, and atomic. Never request real credentials or personal data.

Show a small notice: **Demo changes disappear on reset or reload.** Provide a visible **Reset demo** control that restores deterministic seed state, clears uploads and pending work, and cancels timers or late responses. Reloading, reopening, or switching away from the implementation must start a fresh demo. An explicit user download is the only way to retain demo work. Do not send data to the parent gallery or depend on it for state.

Validate the generated file over static HTTP at a nested path, inside an iframe with `sandbox="allow-scripts allow-downloads"` and no `allow-same-origin`. The hosting policy blocks network connections, external resources, form submissions, and nested frames; inline scripts/styles and embedded data/Blob assets are supported. It does not allow JavaScript eval/Function or persistent storage. Exercise the main workflow, invalid input, reset during pending work, reload, and a second independently opened demo. Verify that one demo cannot change another's data and that no application network requests or storage errors occur. Include desktop and narrow viewport checks. Record full-app and gallery-demo outcomes separately in `evidence/validation.md`; never report a simulated check as a pass for its original backend acceptance scenario.

## Publication boundary

The static exporter recognizes only `project/gallery/index.html` for a Real Apps run whose directory identifies its prompt. It does not execute project commands. Raw projects, archives, databases, metadata, and evidence stay outside the Netlify upload. The hosted demo uses a separate `/demos/` route with a restrictive response policy, including when opened directly. The viewer can reset a demo by destroying and recreating its frame.

This removes the shared application write service from the public deployment. It is not a promise that arbitrary submitted code is harmless, that browser memory has a fixed quota, or that hosting has no bandwidth costs. Original sources still need review before publication. Authentication, concurrent requests, offline reload, and durable recovery must be evaluated against the full local app in a disposable environment.

Netlify applies response headers to its [static files](https://docs.netlify.com/manage/routing/headers/). The browser's [sandbox policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox) isolates origin storage, and [connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) restricts scripted connections. These controls complement the absence of a deployed writable backend.
