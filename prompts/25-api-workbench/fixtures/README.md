# Public fixtures: API Workbench: Stateful Request Laboratory

These synthetic files make the task's seed and examples portable. They are specification data, not model-generated benchmark results or a reference implementation. The raw task also describes the essential scenario so the prompt remains usable alone.

The model may translate the fixture structure into its own internal schema, but must preserve the specified identities, values, invariants, and expected outcomes. Include equivalent seed/input data in the generated app. Do not special-case an expected answer instead of implementing the general behavior.

Expose only this task's complete prompt.md and public fixtures to the agent. Keep evaluator-private cases and prior scores outside its workspace. The agent may build, execute, test and improve throughout the run. Acceptance scenarios are also available in ../acceptance.md.
