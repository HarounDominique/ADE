# ADE — Assay Founding Charter

This charter states how ADE is offered to the open source community and what
kind of project its maintainers hope to build with others.

## Identity

**ADE** is the name of the project, repository, command, binary and technical
namespace. **Assay** is the product name used when describing the workstation
to users. The distinction is intentional and follows [ADR-0032](adr/0032-product-identity.md).

Assay is a local-first workstation for agentic software engineering. Its
purpose is to make intent, changes, execution, verification and review visible
in one place. The governing principle is simple: an agent's account of its own
work is not authority over the result; the code, tests, evidence and Git are.

## An open invitation

ADE is released under the MIT licence. Anyone is welcome to clone it, fork it,
study it, adapt it, redistribute it or continue it in a different direction,
subject to the licence and the licences of the included third-party work.

An independent continuation is not a failure of the project. It may be the
right outcome for a different community, product direction or set of
constraints. We want people to have the freedom to take ADE where they think
it should go.

At the same time, positive progress is especially welcome in the main ADE
repository. If a fix, feature, refactoring, documentation improvement or
platform adaptation can benefit the broader project, please consider sending
it upstream as an issue, discussion or pull request. The maintainers will
review it on its merits; contribution is an invitation, not an obligation.

## Modules are places to take ownership

ADE is deliberately modular. A contributor or group of contributors may take
responsibility for a module, learn its boundaries, improve its implementation,
strengthen its tests and documentation, and iterate on it over time.

For example, someone may choose to become the steward of the database-manager
module: first understanding its current contract, then improving its schema
browser, runtime detection, reliability, cross-platform behaviour or user
experience. The same is true of the editor, agent providers, workflow,
terminal, Git integration, local runtime or any other module.

Module stewardship does not require exclusive ownership. It means bringing
care, continuity and technical context to an area while collaborating with
everyone else whose work crosses its boundary. The module specs, ADRs, tests
and review history remain the shared source of truth.

## How we collaborate

- Start with the smallest useful contribution that makes the intended outcome
  clear.
- Use issues or discussions to explore uncertain or cross-cutting changes
  before investing in a large implementation.
- Keep changes focused, tested and documented at the level appropriate to
  their impact.
- Preserve the project's explicit boundaries: local-first operation,
  observable evidence, human approval where required, and no claim stronger
  than what the implementation verifies.
- Explain the reasoning behind consequential changes. ADE uses specs and ADRs
  so that future contributors do not have to rediscover old decisions.
- Treat people with respect. Good technical disagreement is welcome; personal
  hostility is not.

## The main repository

The main repository is a place for shared progress, not a claim of ownership
over every possible future of ADE. Maintainers are responsible for protecting
the project's clarity, quality and release discipline. They may decline a
change that is valuable in isolation but does not fit the current direction,
or suggest that it belongs in a fork or companion project.

Such a decision should be explained clearly and respectfully. A declined pull
request is not a judgement on the contributor or the value of the idea.

## What success looks like

Success is not only adoption or a growing number of stars. It is a project in
which more people can understand the system, run it, improve a meaningful
part of it and carry its ideas into their own work. The best outcome is a
healthy network of users, contributors, module stewards, forks and related
projects — with useful improvements flowing back to ADE whenever their authors
choose to share them.

This charter is a statement of intent. The repository's licence, contribution
guidelines, code of conduct, security policy, specifications and ADRs define
the operational details.
