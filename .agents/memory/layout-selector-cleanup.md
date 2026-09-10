---
name: Layout selector cleanup
description: CSS compatibility-selector risk when changing the main app hierarchy.
---

Legacy selectors based on main section positions can hide or restyle the wrong element after the planner and map hierarchy changes.

**Why:** A selector intended for the former second-column wrapper hid the new map container after the results panel was merged into the planner.

**How to apply:** After restructuring major layout children, search for nth-child and inline-style attribute selectors and replace them with semantic class selectors where possible.