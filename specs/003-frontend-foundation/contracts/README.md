# Contracts: FE-01 — Frontend Foundation

**Not applicable.**

This spec issues no HTTP request (FR-023) and exposes no endpoint, so there is no contract to
define or consume.

Two things follow, and both are deliberate:

1. **No contract is invented here.** Under Constitution Principle V the backend spec defines the
   HTTP contract and lands first; the frontend spec consumes it. Sketching a speculative response
   shape in this directory would create a contract with no server behind it, which the next
   frontend spec would then have to unpick.

2. **Nothing here depends on BE-02.** Authentication is being planned in a sibling worktree. FE-01
   reads no session, guards no route and assumes no cookie name, so no decision made in BE-02 can
   invalidate anything in this spec (see plan.md, "Independence from BE-02").

The first frontend contracts directory with content in it will belong to the spec that renders real
figures, and it will reference the backend spec that defines them.
