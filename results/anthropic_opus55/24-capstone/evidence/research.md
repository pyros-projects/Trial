# Research log — Capstone: "Starfix"

Access date for every source below: **2026-09-30**. Researcher: Claude (Opus 5.5) in Claude Code.

## Tools actually used

| Tool | Used for |
|---|---|
| `WebSearch` (Claude Code built-in) | 8 searches (listed below) |
| `mcp__read-website-fast__read_website` | Opening and reading full pages |
| `agent-browser read <url> --filter <section>` (agent-browser 0.31.1 CLI) | Reading single sections of long Wikipedia pages |
| `curl` → SIMBAD TAP service (ADQL query) | Downloading J2000 star positions, proper motions, V magnitudes for the embedded star table (data, not prose) |

Failed fetches (not counted as read): `https://wif-format.org/` (fetch failed), `https://oceannavigator.com/altitude-corrections-for-sextant-sights/` (fetch failed), `https://flightsim.to/file/17738/celnav-for-msfs-celestial-navigation-sextant` (JS-rendered, no content). I make no claims about the contents of those pages.

### Search queries (verbatim)

1. `weaving draft threading tie-up treadling drawdown explained`
2. `online weaving draft editor drawdown simulator browser`
3. `Weaving Information File WIF specification format`
4. `online sextant simulator celestial navigation practice browser`
5. `intercept method celestial navigation line of position Marcq St Hilaire`
6. `change ringing simulator conduct bob single plain bob doubles extent online`
7. `celestial navigation game sextant find island landfall web`
8. `"sextant simulator" javascript OR html5 OR webgl`
9. `sextant altitude corrections dip formula height of eye refraction Bennett formula navigation`

## Sources opened and read

Domains: wikipedia.org, handwovenmagazine.com, asunder.co, steamcommunity.com, thenauticalalmanac.com, astronavigationdemystified.com, mathscinotes.com, treblesgoing.org.uk, simbad.cds.unistra.fr (data). That is well over three pages across more than two independent domains.

| # | Title | URL | What I learned (sourced) | Design decision it influenced |
|---|---|---|---|---|
| 1 | Intercept method (Wikipedia) | https://en.wikipedia.org/wiki/Intercept_method | The Marcq St Hilaire procedure (1875): measure Ho, time it, choose an assumed position (AP), compute Hc and Zn from LHA, Dec and latitude, intercept = Ho − Hc in arc-minutes = nautical miles, "computed greater away", the LOP is perpendicular to the azimuth. Sights are usually taken in twilight, when both the horizon and stars are visible. Two LOPs give a fix and three are always enough. The LOPs must cross at a good angle. Earlier LOPs are advanced by the course and distance run, which gives a running fix. Formulas for Hc and Zn are given. | The whole reduction pipeline and its on-screen "working" panel; twilight-window gating of star sights; running-fix advancement; poor-cut warning. |
| 2 | List of stars for navigation (Wikipedia) | https://en.wikipedia.org/wiki/List_of_selected_stars_for_navigation | There are 57 selected stars plus Polaris, chosen by HMNAO/USNO for brightness, spread across the sky and ease of identification. Their positions are given as SHA and Dec (SHA = 360° − RA). Polaris gives latitude but is excluded from the 57. | The embedded body list is exactly these 58 stars. The UI shows SHA and Dec. |
| 3 | ASTRON: Astro Navigation Almanac and Sight Reduction calculator | https://thenauticalalmanac.com/Astron_web/Astron_web.html | This is a browser almanac, sight reducer and LOP plotter. The user **types** Hs, IC and height of eye, and it returns GHA/Dec, Hc/Zn and the intercept. Its sample page lists values for 2021-09-10 19:00:00 UTC at AP N39°58.0′ W075°32.0′, for example GHA Aries 275°01.7′; Sun GHA 105°48.1′, Dec N04°38.0′, Hc 45°22.2′, Zn 225.7°; Arcturus SHA 145°50.7′, Dec N19°04.5′, Hc 65°35.9′, Zn 144.6°; Vega SHA 080°34.9′, Dec N38°48.5′; Polaris SHA 315°02.8′, Dec N89°21.0′. Dip for 3.0 m height of eye is −3.1′. | This is the closest existing tool. Starfix's difference is that the sextant altitude comes from the user's own hand and eye rather than typed input. I use the listed values as an **independent regression reference** for my almanac engine (see validation.md). |
| 4 | Celestial Navigation & Sextant :: eSail Sailing Simulator Feature Requests (Steam) | https://steamcommunity.com/app/794860/discussions/1/3780245614660226086/ | A sailor practising celestial navigation in a sailing simulator had to copy positions into the external Astron app for every sight. They asked for an in-game sextant that measures Hs by aligning the body, a random sight error depending on the sea state, sights only when the body and the horizon are both visible (no stars in daylight, no horizon at night), and small low islands far away that you only see when close. | This is a direct user-need signal. Starfix has an integrated sextant, error that comes from sea-state roll and horizon roughness, visibility gating from the Sun's altitude, and a low island that appears only inside its computed visibility range. |
| 5 | Position of the Sun (Wikipedia) | https://en.wikipedia.org/wiki/Position_of_the_Sun | These are the Astronomical Almanac low-precision formulas: n = JD − 2451545, L = 280.460° + 0.9856474°n, g = 357.528° + 0.9856003°n, λ = L + 1.915° sin g + 0.020° sin 2g, ε = 23.439° − 0.0000004°n, α = atan2(cos ε sin λ, cos λ), δ = asin(sin ε sin λ), R = 1.00014 − 0.01671 cos g − 0.00014 cos 2g. The stated precision is about 0.01° for 1950–2050. | Sun model. I use Meeus-style terms of the same family plus nutation and aberration. Custom voyages are limited to 1950–2050 because of the stated validity range. |
| 6 | Atmospheric refraction (Wikipedia, section "Calculating refraction", via `agent-browser read`) | https://en.wikipedia.org/wiki/Atmospheric_refraction | Bennett's formula R = cot(ha + 7.31/(ha + 4.4)) arcmin (from apparent altitude) is used in USNO software. Sæmundsson's inverse is R = 1.02 cot(h + 10.3/(h + 5.11)) (from true altitude). Refraction near the horizon is unreliable. | The "truth" sky is drawn with Sæmundsson (true → apparent). The navigator's reduction uses Bennett (apparent → true), as a real navigator would. The low-altitude warning (< 10°) comes from this source. |
| 7 | Altitude Correction for Dip (Astro Navigation Demystified) | https://astronavigationdemystified.com/altitude-correction-for-dip/ | The visible horizon lies below the true horizon when the eye is raised, so dip is always subtracted. Refraction also affects dip. | Dip is applied as a negative correction in the reduction. The deck view draws the sea horizon at −dip. |
| 8 | Correcting Sextant Measurements For Dip (mathscinotes) | https://www.mathscinotes.com/2015/10/correcting-sextant-measurements-for-dip/ | At sea only the horizon is a stable reference. Dip is proportional to √(height of eye). Published formulas differ by about 10% because the atmosphere varies. | Dip = 1.76′√h(m), a common Nautical-Almanac form. It is consistent with Astron's −3.1′ at 3.0 m. |
| 9 | Pitcairn Islands (Wikipedia, "History" section, via `agent-browser read`) | https://en.wikipedia.org/wiki/Pitcairn_Islands | Carteret sighted Pitcairn in 1767 without a marine chronometer. His latitude was reasonable but his longitude was about 3° (330 km) too far west. Cook failed to find the island in 1773. | Seeded voyage 2, "Carteret's Longitude": the chronometer is unreliable, so star fixes carry a longitude error while latitude stays good. The period-appropriate answer, latitude sailing, becomes a real strategy. |
| 10 | Learn How to Read a Simple Multi-Shaft Draft (Handwoven) | https://handwovenmagazine.com/learn-to-read-a-simple-multi-shaft-draft/ | A draft consists of the tie-up (rows are shafts, columns are treadles), threading, treadling (one row per pick) and drawdown. | Background for candidate C (weaving). |
| 11 | Bower — Free Weaving Software in Your Browser (Asunder) | https://asunder.co/app/bower | This is a browser draft editor with WIF import/export, tie-up and liftplan modes, **"Direct Edit" (paint on the drawdown, run a feasibility check, accept a decomposition back into loom structure)** and **loom optimization** to reduce the number of shafts and treadles. | Candidate C rejected. Its distinctive core, painting cloth and deriving the loom, already exists in a shipping product. |
| 12 | Abel (Trebles Going) | https://www.treblesgoing.org.uk/abel.html | Abel, Mabel and Mobel ring 3–24 bells. The user rings one bell while the software rings the rest. The user can call bobs and singles to conduct touches, with blue lines, striking reports and a library of 17,000 methods. | Candidate B rejected. Conducting and ringing touches is already mature in dedicated simulators. |
| 13 | SIMBAD astronomical database (TAP query, data only) | https://simbad.cds.unistra.fr/simbad/sim-tap | I retrieved ICRS J2000 RA/Dec, proper motion (mas/yr) and V magnitude for the 57 selected stars plus Polaris. | These values are embedded as the star table and precessed to the date in-app. Credit: "This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France." |

Search-result snippets I did **not** treat as read sources: the Mobel App Store listing, Stellarium, NauticEd, OpenCPN, the Bowditch PDFs and the WIF FAQ.

## Sourced facts vs. my inferences

- **Sourced:** the intercept method steps and formulas (1). The list of selected stars and the SHA convention (2). Astron's workflow and its reference numbers (3). The eSail user's wish list (4). The solar formulas and their validity range (5). The Bennett and Sæmundsson formulas (6). The sign and √h dependence of dip (7, 8). The Carteret longitude error (9). Bower's Direct Edit and loom optimization (11). Abel and Mobel conducting (12).
- **My inferences** (not claimed by sources):
  - Tilting the sextant ("swinging the arc") biases a sight upward by roughly ψ²/(2 tan h). I derived this from the right spherical triangle and use it to make the roll-timing skill matter.
  - A 1 kn unknown current over about 20 h is enough to miss a low island seen from a small boat. This is my game-design estimate.
  - I found no single browser experience that joins sighting by hand, reduction, plotting and a voyage with a hidden current. This comes from a short search and does **not** prove that none exists.

## Three candidate concepts

| | Candidate | Purpose (one sentence) | Central interaction |
|---|---|---|---|
| A | **Starfix: find your ship by starlight** | Let anyone take a real sextant sight by hand and turn starlight, a clock and spherical trigonometry into a position fix. They then use it to find a small island against a current they cannot see. | Turn the sextant drum until a star or the Sun kisses a rolling horizon. Mark the time, watch the line of position appear, cross it with others into a fix, and steer. |
| B | Call the Changes: a change-ringing conductor | Teach the group theory of English change ringing by making you the conductor who must bring the bells back to rounds without repeating a row. | Call "Bob" or "Single" live while synthesized bells ring permutations. The app checks truth and draws blue lines. |
| C | Drawdown Reversed: a loom that answers back | Paint the cloth you want and have the app derive the smallest loom (shafts, treadles, tie-up) that could weave it, with float and structural-integrity checks. | Paint interlacements and see the minimal threading, tie-up and treadling. Fit the result to a 4- or 8-shaft loom. |

**Choice: A (Starfix).** My reasons:
- **Interest and surprise.** Very few people have ever used a sextant, and finding yourself from a star is a strong "I didn't know I wanted to try this" moment.
- **Distance from Trial.** No task in Trial measures with an instrument or solves the inverse "where am I?" problem.
- **Technical substance.** The app needs almanac astronomy (precession, nutation, aberration, sidereal time), refraction and dip, spherical trigonometry, least-squares fixes with error ellipses, running fixes, dead reckoning, and visibility geometry.
- **Feasibility.** Everything is 2D canvas plus arithmetic, and the data is a table of 58 stars. It fits comfortably in one offline file.

B and C were rejected because established tools already do their central interaction: Abel and Mobel (12) for B, Bower Direct Edit (11) for C. In both cases my build would have been a subset of existing products. C is also near Trial #19, a procedural pattern generator.

## Positioning

- **Closest Trial task: #7, Orbital Mission Planner** (gravity sandbox, trajectories, maneuvers). Both involve the sky, and that is where the overlap ends.
  - The Orbital planner is a *forward* dynamics sandbox: you shape trajectories.
  - Starfix is an *inverse measurement* problem: the sky is a fixed clock and reference, and the user's own hand-and-eye observation is the input.
  - Its core action is optical alignment under ship roll, timing and plotting, not maneuver planning.
  - Its outcome is where you are and whether you find land.
  - Trial #5 (lensing) and #13 (drone flight) share neither the purpose nor the core loop.
- **Closest researched work: Astron (3)**, which is almanac + sight reduction + plotter. Astron assumes the user already holds a sextant reading and types it in. Starfix creates that reading from the user's own manipulation of a simulated instrument, subject to roll, horizon roughness, twilight and time pressure. It then couples the fixes to a voyage whose true position is hidden and affected by an unknown current.
- **Nearest game context: eSail (4).** A sailing simulator without a sextant, whose users asked for exactly this loop. Starfix contributes the loop in one self-contained offline page.
- **Novelty claim (bounded):** Starfix is a distinctive contribution to this collection. A short search cannot establish a world first.

## Behavioral commitments (written before implementation — kept verbatim)

1. **Hand-taken sight → correct line of position.**
   - *User:* picks a star or the Sun on the deck, turns the sextant micrometer (wheel, arrow keys, drag or buttons) until the reflected body touches the moving horizon, and presses Mark.
   - *System:* records only the chronometer time and the arc reading, then reduces them: IC, dip, refraction and semidiameter give Ho; the almanac gives GHA and Dec; AP → LHA → Hc and Zn; the intercept follows. It then plots the LOP.
   - *Evidence it worked:* almanac and Hc/Zn values reproduce the Astron reference within about 0.3′. A sight with the body exactly on the horizon gives an LOP within about 0.5 nm of the hidden true position. Deliberately setting the arc 5′ high moves the LOP about 5 nm toward the body.
2. **Fix quality follows the navigator's choices.**
   - *User:* takes two or more sights and chooses which to combine.
   - *System:* advances earlier LOPs by the dead-reckoning run (running fix), solves a least-squares fix with an error ellipse and cocked hat, and flags poor cuts.
   - *Evidence it worked:* three stars spread in azimuth give a small ellipse and a small true error, shown in the debrief or the practice truth overlay. Two stars with similar azimuths give an elongated ellipse and a "poor cut" warning. Marking while the sextant is tilted biases the LOP.
3. **A voyage in which the current is hidden and only fixes find land.**
   - *User:* sets course and speed, advances time to twilight or noon, adopts fixes and steers.
   - *System:* moves the true position with a current the user cannot see, so dead reckoning drifts. The island appears ("Land ho!") only inside its computed visibility range. A provisions deadline ends the voyage, and a debrief reveals the true track against the DR and the fixes.
   - *Evidence it worked:* in the seeded voyage, sailing the DR course without sights misses the island and ends in failure. Correcting course from a fix produces landfall. Reset and restart restore the initial state.

## Additional data look-ups during implementation (same day, via `agent-browser read`)

These were read to get the embedded island data right. They are facts used as data, not design inspiration.

| Page | URL | Data taken |
|---|---|---|
| Bermuda (Wikipedia) | https://en.wikipedia.org/wiki/Bermuda | 32°17′46″N 64°46′58″W; highest elevation 79 m |
| Gibbs Hill Lighthouse (Wikipedia) | https://en.wikipedia.org/wiki/Gibbs_Hill_Lighthouse | focal height 108 m, range 26 nmi |
| Clipperton Island (Wikipedia) | https://en.wikipedia.org/wiki/Clipperton_Island | 10°18′N 109°13′W; highest point 29 m |
| Pitcairn Island (Wikipedia) | https://en.wikipedia.org/wiki/Pitcairn_Island | 25°04′00″S 130°06′24″W; highest point 346 m |
| Flores Island (Azores) (Wikipedia) | https://en.wikipedia.org/wiki/Flores_Island_(Azores) | 39°26′37″N 31°11′57″W; 915 m (default for the custom-voyage form) |

The scenario details are my inventions for play: start positions, dead-reckoning errors, currents, dates and provisions. They were tuned with a Node sweep of closest approach (see validation.md, fix 5).

## Scope changes during implementation

The commitments above are unchanged, and all three were fulfilled (see validation.md). These are the changes made along the way, and why:

1. **Iterated fix (added).** With DR errors of 45 nm or more and a wrong clock, intercepts reached 60–127 nm. The straight-line plotting approximation then biased latitude by about 2.8′. A navigator would re-work the sights from the new position, and the app now does the same automatically (up to 4 iterations).
2. **Honest running-fix uncertainty (added).** A Sun-only running fix was 5.4 nm off, while its displayed 95% ellipse was only 2.7 × 2.2 nm. Advanced LOPs are now weighted with σ = √(1² + (0.8·hours)²) nm.
3. **Scenario tuning (changed).** In the first versions of Clipperton and Pitcairn, sailing on DR alone still found the island, which would have broken commitment 3. The currents, DR errors and the Pitcairn approach direction were changed. Pitcairn is now approached from the north, so the clock error crosses the track.
4. **Separate "sextant error" statistic (added).** The debrief separates hand-and-eye error (arc-minutes) from LOP error, which includes clock error, so that Pitcairn does not blame the player's sextant work for the chronometer.
5. **Simplifications (kept, disclosed in the About view):**
   - No Moon or planets.
   - A whole-horizon mirror view instead of a split mirror.
   - Visibility of stars, horizon and island from simple rules.
   - The index correction is given rather than measured.
6. **Not built (outside the concept):**
   - Undo: it is a game, which has restart, abandon, per-sight delete and export/import instead.
   - Persistence beyond explicit export/import.
