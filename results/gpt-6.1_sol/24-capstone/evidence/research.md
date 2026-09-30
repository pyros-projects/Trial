# Afterimage — research and choice

Access date for all sources: **2026-09-30**. Research used the live `web__run` tool through `functions.exec`; these were actual searches and page reads. No external code or assets will be embedded.

## Search trail

- `web__run.search_query`: `Bayesian experimental design interactive causal inference game`; `interactive substitution cipher decipher tool`; `interactive knot untangling topology game`. These explored candidate spaces; snippets were not treated as read sources.
- `web__run.search_query`: `Reed Solomon erasure coding explanation Backblaze`; `Reed Solomon interactive demonstration erasure code visual`; `interleaving burst errors Reed Solomon explanation primary`.
- `web__run.open`: the three sources below. Also used `web__run.find` for `Interleaving data` in the ITU tutorial and read the returned theoretical-description section (PDF pages 8–10).

## Read sources and decisions

1. **Brian Beach / Backblaze: Backblaze Open-sources Reed-Solomon Erasure Coding Source Code** — https://www.backblaze.com/blog/reed-solomon/
   - Sourced: redundant parity pieces permit reconstruction from a sufficient subset of pieces. A systematic coding matrix keeps the original data and appends parity; an inverse of surviving matrix rows reconstructs the data.
   - Decision: implement a small systematic byte codec in GF(256), with 24 data symbols per band and 4, 8, or 12 extra symbols. Recovery uses finite-field equations, not copying the original image.
   - Inference: making loss tactile could give the underlying algebra a more memorable purpose than displaying equations alone. No Backblaze code is copied.
2. **sigh: Reed-Solomon Error Correction** — https://sigh.github.io/reed-solomon/
   - Sourced / observed page controls: this interactive work configures check symbols, accepts a text message, lets the visitor corrupt transmitted text, and exposes encoding/decoding intermediates. It distinguishes known-location erasures (up to n−k recoverable) from unknown-location errors (half that correction budget). Its finite field uses primitive polynomial 0x11D.
   - Decision: scope Afterimage honestly to erased bytes at known locations. Explain the per-band limit; never claim correction of arbitrary altered values. Use the same standard finite-field polynomial with an original evaluation/interpolation implementation, rather than the demo's BCH algorithm.
   - Inference: spatial damage and rearrangement offer a different question: not just how much is lost, but where the lost information was distributed.
3. **ITU-hosted Optical Transport Network (OTN) Tutorial, Timothy P. Walker / AMCC** — https://www.itu.int/ITU-T/studygroups/com15/otn/OTNtutorial.pdf
   - Sourced: its theoretical FEC section describes data and redundant check bytes. Interleaving distributes a burst among multiple codewords; some codewords can recover while others fail when their individual budgets are exceeded. The document explicitly calls itself an educational tutorial, not a normative recommendation.
   - Decision: provide Rows and Woven storage arrangements and a repeatable horizontal Fold intervention. Show loss counts for all 24 code bands and partial recovery when some are beyond their limit.
   - Inference: comparing the same physical fold in two layouts should reveal that arrangement can matter more than the total loss percentage. The toy spatial mapping is our own, not a model of a particular optical transport format.

These pages cover three independently authored sources on three domains (`backblaze.com`, `sigh.github.io`, `itu.int`), the subject mechanism, and relevant interactive prior art. The sources were opened and read, rather than relying on search snippets. The short research cannot establish worldwide originality.

## Three candidates

1. **Afterimage:** make an image worth keeping, destroy parts of its redundant encoding, and reconstruct it; the central action is spatially erasing bytes and comparing storage arrangements.
2. **Glasshouse:** learn to distinguish correlation from cause in a small hidden binary world; the central action is choosing interventions that separate plausible causal mechanisms.
3. **Knot Cabinet:** discover which tangles can be undone without cutting a closed loop; the central action is applying topology-preserving moves to an over/under crossing diagram.

**Choice: Afterimage.** It turns an otherwise invisible storage mechanism into a legible, creative, repeatable experiment. It has a concrete source-to-code-to-loss-to-recovery pipeline, exact mathematical boundaries, and feasible computation at small byte counts in an offline file. It needs neither a misleading physical simulation nor a large inference library. The other candidates have good substance but pose higher explanation/interaction costs in the available single-file format.

## Place in this collection and nearest related work

The closest Trial brief is **19, Node Graphics Studio**, because the user authors a visual artifact and sees its transformation. Afterimage's purpose and action differ: there are no graphics nodes or generative texture graph. The authored picture is a payload for an information-loss experiment; the central decision is how to distribute redundancy, where to erase it, and whether surviving bytes suffice to reconstruct it. **15, Digital Logic / Tiny CPU** is adjacent in subject, but there are no typed circuits, gates, timing simulation, or processor here.

The closest researched work is **sigh's Reed-Solomon Error Correction**. That demo exposes a text codec and its polynomial intermediates. Afterimage uses editable images, direct spatial erasures, interleaving, a controlled fold comparison, and a band-by-band account of partial recovery. This is a distinctive contribution to this collection, not a claim of being the first error-correction visualization.

## Original behavioral commitments — recorded before implementation

1. **An authored memory can survive real loss.** The user paints a new 24×24 image or inscribes a short word, stores it with configurable redundancy, erases arbitrary tiles, and asks for recovery. The decoder must recover every original pixel when every code band retains at least 24 symbols. Verify decoded bytes against the separately retained original, and test non-preset data. The decoder must never receive that original.
2. **The same fold has meaningfully different outcomes.** The user stores the same image in Rows and Woven arrangements and applies the same four-row horizontal fold. Rows must report some unrecoverable bands; Woven with eight recovery pieces must reconstruct the entire image. If loss exceeds a band's budget, display unresolved pixels and useful per-band feedback instead of inventing them.
3. **Experiments are repeatable and portable.** Undo/redo must restore edits and damage as transactions. A downloaded project must restore the image, encoding choices, and erased surface; malformed imports must preserve the current experiment. Whole-session Reset must return to the authored initial state, clear history, and invalidate pending imports. Verify round-trip, invalid import, reset, and reload through real browser controls.

## Scope notes

- Erasures only, not correction of unknown altered bytes. 24×24 pixels and eight ink colors; this is an explanation of resilience, not archival software or a QR/CD implementation.
- Source artwork, glyph font, visual design, implementation, and data are original and embedded. Source titles and selectable URLs are included in the secondary About view.
- No behavioral commitments have been removed. Later deviations and validation outcomes belong below and in `validation.md`.

## Delivered outcomes

All three original commitments were fulfilled and checked against the delivered application. New `ECHO`, `BEAM`, `MEND`, `TINY` and custom pointer artwork exercised the same system as the examples. Exact decoding, the same-fold Rows/Woven difference, honest over-budget partial output, undo/redo, actual file round-trip, invalid preservation, and Reset/reload were verified through real browser input. See `validation.md` for commands, byte counts, screenshots, discovered failures and fixes. The implementation clarified that the default four-row fold removes 5–6 symbols per Woven band; the eight-symbol recovery budget and original promised outcome remain unchanged. No purpose or behavioral promise was replaced during development.
