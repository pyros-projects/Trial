# Research Record: The Planispheric Astrolabe & Celestial Analog Computer

**Date:** 2026-09-12  
**Subject:** Historical Celestial Analog Computing, Stereographic Projection Geometry, and Observational Horology  
**Artifact:** Planispheric Astrolabe Interactive Simulation & Astronomical Instrument

---

## 1. Primary Research Log

### Source 1: Astrolabe (Wikipedia)
- **Tool Used:** `read_url_content` (after initial search)
- **URL:** `https://en.wikipedia.org/wiki/Astrolabe`
- **Access Date:** 2026-09-12
- **Title:** Astrolabe
- **Sourced Facts:**
  - An astrolabe is an ancient astronomical analog computer used by astronomers, navigators, and astrologers to locate and predict the positions of the Sun, Moon, planets, and stars; determine local time given local latitude and vice versa; provide surveying capabilities; and cast horoscopes.
  - Core mechanical components:
    - **Mater** (mother): the heavy brass baseplate with a recessed cavity (*womb*) and a graduated outer rim (*limb*) divided into 360 degrees and 24 hours.
    - **Tympan** (plate): removable disc engraved for a specific observer latitude, showing the celestial coordinate grid projected stereographically (zenith, horizon, almucantars / altitude curves, azimuth arcs, celestial meridian, and unequal hour lines below the horizon).
    - **Rete** (net): pierced decorative openwork brass plate rotating about the celestial pole pin; contains pointers for major bright stars and an off-center ecliptic ring marked with zodiac signs and calendar degrees.
    - **Rule**: rotating radial pointer on the front face for aligning points on the rete with the outer hour scale.
    - **Alidade**: rotating sighting vane on the rear face with two pinhole sight plates for measuring altitudes of celestial bodies or terrestrial landmarks.
    - **Shadow Square** (Umbra Recta and Umbra Versa): engraved on the back for measuring heights of towers and distances using right-triangle proportions (base 12).
  - Mathematical basis: Stereographic projection from the South Celestial Pole onto the equatorial plane. Conformal projection where every circle on the sphere projects to a true circle (or straight line) on the plane. Concentric circles define the Tropic of Cancer (inner), Equator (middle), and Tropic of Capricorn (outer boundary of the plate).
- **Design Decisions Influenced:**
  - Architected the application to faithfully recreate both the Front (Mater, Tympan plate, Rete, Rule) and Back (Alidade, Zodiac/Calendar conversion ring, Shadow Square, Unequal hour dial) with seamless 3D/2D flipping.
  - Implemented exact stereographic projection formulas for the three concentric reference circles (Cancer, Equator, Capricorn) so the outer edge of the plate corresponds to the Tropic of Capricorn ($\delta \approx -23.44^\circ$).

---

### Source 2: Stereographic Projection (Wolfram MathWorld)
- **Tool Used:** `read_url_content`
- **URL:** `https://mathworld.wolfram.com/StereographicProjection.html`
- **Access Date:** 2026-09-12
- **Title:** Stereographic Projection -- from Wolfram MathWorld (Eric W. Weisstein)
- **Sourced Facts:**
  - Stereographic projection maps points $P(\theta, \phi)$ on a sphere of radius $R$ from a projection pole to a plane.
  - In an equatorial planispheric astrolabe with projection pole at the South Pole $(0, 0, -R)$ onto the equatorial plane:
    - Points at declination $\delta$ project at radial distance $r = R \tan((90^\circ - \delta)/2) = R \cot((90^\circ + \delta)/2)$.
    - Circles on the sphere remain exact circles in the projection plane.
    - Conformal property: preserves local angles between curves (tangents to azimuth circles intersect altitude circles at right angles $90^\circ$).
- **Design Decisions Influenced:**
  - Implemented exact mathematical circle generation for Almucantars (altitude circles $a = 0^\circ$ to $90^\circ$) and Azimuth arcs for any arbitrary latitude $\phi \in [-90^\circ, +90^\circ]$.
  - Used the conformal property to render the perpendicular intersections of azimuth curves and almucantars, giving authentic mathematical fidelity.
  - Enabled dynamic latitude plate generation: rather than only offering 2 or 3 static preset images, the user can change their latitude to any location on Earth, and the mathematical engine recomputes and redraws the plate circles instantly.

---

### Source 3: The Astrolabe Project
- **Tool Used:** `read_url_content`
- **URL:** `https://www.astrolabeproject.com/`
- **Access Date:** 2026-09-12
- **Title:** The Astrolabe Project - An obsession in progress (Richard Wymarc)
- **Sourced Facts:**
  - Richard Wymarc documents the practical construction and drafting of astrolabes using traditional straightedge/compass techniques and modern automated PostScript generation.
  - Notes the historical importance of the rete star pointers (flames or dagger-shaped pointers) and the eccentric ecliptic circle.
  - Explains how historical astrolabists laid out the unequal hour curves below the horizon by dividing each diurnal or nocturnal arc into 12 segments.
  - Highlights that most users find astrolabes intimidating because standard tools either present static paper templates or non-interactive vector drawings, missing the mechanical sensation of rotation, sight alignment, and real-time computation.
- **Design Decisions Influenced:**
  - Provide an interactive mechanical feel: brass tactile rendering, fluid pointer/wheel drag with angular momentum, subtle authentic metallic sheen and click sounds upon rotation.
  - Include an interactive tutorial and "Chaucer's Challenges": step-by-step interactive tasks (e.g. determine solar time from sun altitude, find time of night from star altitude, survey tower height using the shadow square) that make the instrument approachable within 60 seconds without prior knowledge.

---

### Source 4: Shadow Square (Wikipedia) & In-The-Sky.org Astrolabe Primer
- **Tool Used:** `read_url_content`
- **URLs:** `https://en.wikipedia.org/wiki/Shadow_square` and `https://in-the-sky.org/article.php?term=astrolabe`
- **Access Date:** 2026-09-12
- **Titles:** Shadow Square; Astronomy articles from In-The-Sky.org
- **Sourced Facts:**
  - The Shadow Square (or *quadratum umbrae*) divides right angles into 12 units on each side.
  - For angles $0^\circ \le \theta < 45^\circ$, the vertical scale is used: *Umbra Versa* ($V = 12 \tan\theta$). Height $H = D \times (V / 12) + h_{\text{eye}}$.
  - For angles $45^\circ < \theta \le 90^\circ$, the horizontal scale is used: *Umbra Recta* ($R = 12 \cot\theta$). Height $H = D \times (12 / R) + h_{\text{eye}}$.
  - At $\theta = 45^\circ$, the diagonal is *Umbra Media* where $R = V = 12$.
  - The rear face also contains the concentric calendar ring aligning the 365 days of the solar year with the 12 signs of the zodiac ($30^\circ$ each), compensating for Earth's orbital eccentricity (the Sun appears to travel unevenly through the signs).
- **Design Decisions Influenced:**
  - Implemented an interactive Rear Face mode containing a functional Alidade, interactive Shadow Square with real-time triangle solver, and a simulated Optical Sighting / Surveying mini-tool (allowing the user to aim at a virtual landmark and directly verify the Umbra Recta / Umbra Versa formulas).
  - Built the authentic solar calendar ring that translates between calendar dates (e.g. October 15, March 21) and ecliptic longitudes ($\lambda_\odot$).

---

## 2. Three Distinct Candidate Concepts

### Candidate 1: The Planispheric Astrolabe of Alexandria (Astronomical Analog Computer)
- **One-Sentence Purpose:** A mathematically exact planispheric astrolabe and celestial computer simulating stereographic projection of the cosmos, enabling users to solve medieval observational astronomy, solar/nocturnal timekeeping, and trigonometric surveying without modern digital tools.
- **Central Interaction:** Direct manipulation of a dual-sided brass instrument—rotating the Rete and Rule to solve solar and star altitude equations, flipping to the back to aim the Alidade and read the Shadow Square, and synthesizing custom latitude plates on demand.

### Candidate 2: The Jacquard & Dobby Weaving Mechanics Studio (Binary Textile Kinematics)
- **One-Sentence Purpose:** An interactive textile mechanics laboratory demonstrating discrete topological thread interlacing, historical binary punch-card logic, and 3D woven cloth structure physics.
- **Central Interaction:** Drafting warp threading, tie-up matrices, and treadling sequences on a loom workbench while driving real-time mechanical shedding, flying shuttle weft insertion, and beater reed dynamics with 3D thread rendering.

### Candidate 3: Chronos Horology Studio (Mechanical Escapement Dynamics & Timegrapher)
- **One-Sentence Purpose:** A contact-kinematics horological laboratory simulating the impulse transmission and rate regulation of historical mechanical watch escapements (Swiss lever, Graham deadbeat, Grasshopper).
- **Central Interaction:** Authoring and tuning pallet jewel geometries, hairspring stiffness, and impulse pin clearances, while diagnosing rate deviation (+s/d), amplitude, and beat error on a live acoustic timegrapher paper tape.

---

## 3. Concept Choice and Rationale

**Chosen Concept:** Candidate 1 — **The Planispheric Astrolabe of Alexandria**

### Selection Factors:
1. **Likely Interest & Delight:** The astrolabe is universally recognized as one of humanity's greatest analog inventions, yet almost no modern person knows how to operate one. Transforming this mythical brass instrument into a living, tactile, mathematically genuine interactive experience offers an immediate "I didn't know I wanted to try this!" revelation.
2. **Distance from Trial's 23 Tasks:**
   - None of the 23 briefs touch historical analog computing, stereographic coordinates, celestial observational horology, or archaeo-astronomical instruments.
   - Closest Trial task: **Task 7 (Orbital Mission Planner)**. However, Task 7 is a dynamic N-body / Newtonian orbital mechanics simulator with delta-v maneuvers and Keplerian orbital transfers in 3D outer space. The Astrolabe has an entirely different purpose: it is an *Earth-bound observational coordinate computer* utilizing 2D conformal stereographic projection of the celestial sphere onto local horizon planes for timekeeping, stellar observation, and terrestrial surveying. The user does not plan spacecraft orbits; they measure star altitudes and solve spherical astronomy triangles using rotating brass plates.
   - Closest Trial task 2: **Task 15 (Digital Logic / Tiny CPU)**. Task 15 simulates discrete electronic logic gates, clock cycles, and microcode. The Astrolabe is a continuous geometric analog computer operating via stereographic transforms and angular dials.
3. **Distance from Online Work:**
   - Most existing online astrolabe projects (such as Richard Wymarc's Astrolabe Generator or Keith Pickering's pages) are static PostScript/PDF generators designed for printing onto cardstock, or non-interactive SVG drawings.
   - Our implementation is an end-to-end, real-time dual-sided mechanical simulation with dynamic stereographic projection geometry for *any* latitude, interactive star catalog, live solar time solving, rear alidade with optical surveying and shadow square solver, tactile Web Audio feedback, interactive tutorial challenges, and full JSON import/export.
4. **Feasibility in Single Offline HTML File:**
   - All geometric projection math, star catalogs, canvas rendering, tactile audio synthesis, and tutorial state machines can be implemented cleanly with pure HTML5 Canvas, Web Audio API, and vanilla JavaScript without any external libraries or fonts.

---

## 4. Observable Behavioral Commitments

Before implementation, we establish these three rigorous, observable behavioral commitments:

1. **Commitment 1: Real-Time Solar Altitude to Local Solar Time Computation**
   - *What the user does:* Selects an observer latitude (e.g. Alexandria $31.2^\circ\text{N}$, London $51.5^\circ\text{N}$, or a custom user coordinate), sets a calendar date (determining the Sun's ecliptic longitude), and aligns the Sun's marker on the Rete with a chosen Almucantar altitude curve (or drags the time/sun control).
   - *What the system must do:* The system continuously calculates the stereographic intersection of the ecliptic circle at that solar longitude with the observer's horizon and altitude curves. The Rule points to the exact mathematical Local Solar Time on the 24-hour limb, verified against the analytical spherical triangle formula $\cos H = (\sin a - \sin\phi \sin\delta)/(\cos\phi \cos\delta)$.
   - *How to tell it worked:* Verify that at local noon ($H=0$, maximum altitude $a = 90^\circ - |\phi - \delta|$), the Rule points precisely to 12:00 meridian. Verify that sunrise and sunset occur when the Sun touches the $a = 0^\circ$ horizon curve, and that the calculated time matches analytical trigonometry within $\pm 0.05$ hours.

2. **Commitment 2: Nocturnal Star Altitude Sighting & True Night Hour Resolution**
   - *What the user does:* Selects a navigational star (e.g. Vega, Sirius, Arcturus, Aldebaran), adjusts its altitude (e.g. setting Vega to $40^\circ$ altitude on the western sky), with a given calendar date.
   - *What the system must do:* The system rotates the Rete according to sidereal time $\theta_{\text{sidereal}}$. Given the star's Right Ascension $\alpha$ and Declination $\delta$, the system verifies that the star's pointer rests precisely on that altitude curve on the tympan plate. It then reads off the Sun's degree on the ecliptic ring to yield the exact nocturnal solar time on the outer limb.
   - *How to tell it worked:* Rotating the star pointer along an almucantar or across the meridian causes the nocturnal time readout to advance consistently with sidereal-to-solar conversion, matching the expected time of night and updating live azimuth/altitude diagnostics.

3. **Commitment 3: Rear Alidade Sighting, Shadow Square & Tower Surveying**
   - *What the user does:* Flips the astrolabe to the reverse face (Back), rotates the Alidade sighting arm to aim at a target altitude, or uses the interactive surveying simulator.
   - *What the system must do:* The system resolves the ratio on the engraved brass Shadow Square: for angles $<45^\circ$, it reads Umbra Versa $V = 12 \tan\theta$; for angles $>45^\circ$, it reads Umbra Recta $R = 12 \cot\theta$; at $45^\circ$, it reads Umbra Media $12/12$. It calculates the object's height using medieval proportional geometry: $\text{Height} = \text{Distance} \times (V / 12) + h_{\text{eye}}$ or $\text{Distance} \times (12 / R) + h_{\text{eye}}$.
   - *How to tell it worked:* Aiming the Alidade at various target heights/distances correctly projects the index lines across the engraved shadow box, matches analytical trigonometric tangents/cotangents, and produces the accurate calculated height across both Umbra Recta and Umbra Versa regimes.
