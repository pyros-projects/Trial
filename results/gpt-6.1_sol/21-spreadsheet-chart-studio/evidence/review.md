# Independent code review

A fresh, read-only reviewer inspected index.html, the design, and core tests without touching the shared browser.

Confirmed findings:

1. Important: relative copy of =SUM(A1:A2) from B2 to A2 generates =SUM(#REF!:#REF!) but the parser accepts only reference tokens at range endpoints, producing #PARSE! instead of #REF!. The same copied range in an inactive IF branch incorrectly causes #PARSE! instead of the selected result.
2. Originally Minor, re-graded Important: valid subnormal numeric chart data (5e-324, 1e-323) underflows the tick step and produces NaN geometry, breaking preview and exports. Because finite values are explicitly supported, this needs correction.

No other concrete findings in dependency evaluation, string-preserving rebasing, atomic imports, history, or ordinary chart gaps/zero/negatives. Browser editing/download tests are performed independently by the main agent.

Fixes and actual retest results are recorded in validation.md and logs/review-*.

Resolution: both confirmed review findings were corrected. Active copied invalid ranges now return #REF! and inactive branches remain lazy; subnormal values have finite rendered geometry. The complete final browser workflow and 8/8 core tests passed after these fixes. Further exploratory testing found and corrected sandbox native-form submission, identical-import history, and color-control focus continuity; these are documented separately in validation.md.
