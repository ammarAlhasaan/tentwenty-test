# What's left, and what I'd build next

The work was scoped to the stated **8–12 hour budget**, and I kept to it. That budget shaped what
went in and what didn't — below is the honest list rather than a silent gap.

## In progress

**Unit tests for the cost model.** Planned in [`specs/009-cost-model-tests/`](specs/009-cost-model-tests)
and landing shortly: nine cases on the calculation layer, run with Vitest. Covered in more detail in
the [README](README.md#tests). I focused them on the arithmetic that actually carries risk — the
reconciliation self-check, the rate formulas, and the missing-data behaviour.

## Next, in the order I'd do it

1. **Wider test coverage.** The parsers first — they touch messy real-world spreadsheets and are the
   next most likely place for a defect. Then the analytics service, and a small number of
   end-to-end checks on the critical path (upload → dashboard).

2. **Localisation.** The copy is written in one language and is not extracted. Arabic support also
   means RTL layout, so this is a real piece of work rather than a string swap — worth doing
   properly, not in the margins of an assessment.

3. **A simpler upload experience.** Today the page has three separate inputs, one per file type, and
   the user has to know which is which. Better: one drop zone that accepts any of the files, detects
   what each one is from its columns, tells the user what it found, and asks for confirmation only
   when it's unsure.

## Smaller things

- Saved period filters, so a manager returns to the view they left.
- Export of any table to CSV.
