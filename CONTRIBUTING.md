# Contributing to ADE

Thank you for considering a contribution. ADE is the project and technical
identifier; Assay is the product name.

## Ways to participate

You are welcome to clone the repository, create a fork, experiment privately,
or continue the project in whatever direction makes sense to you. When an
improvement is useful to the wider community, we would be delighted to see it
flow back into the main repository through an issue, discussion or pull
request.

Contributors may also take stewardship of a module for the long term. For
example, someone interested in the database manager could own its backlog,
improve its implementation, add tests and documentation, and iterate with the
community. The same applies to any other module. Stewardship is collaborative
and does not require exclusive ownership.

## Before opening a change

- Read the [founding charter](docu/FOUNDING-CHARTER.md) and relevant specs.
- Search existing issues and pull requests before proposing duplicate work.
- For a significant or cross-cutting change, open an issue first so the scope
  and design can be discussed.
- Keep changes focused and explain the user-visible outcome.

## Local checks

```bash
npm install
npm run build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

Changes to the desktop shell should also run the relevant packaging command
for the platform available to you. Do not commit generated build output,
local databases, credentials or machine-specific configuration.

## Pull requests

A pull request should describe the problem, the approach, the checks run and
any platform limitations. Update documentation, specs or ADRs when the public
behavior or rationale changes. A maintainer may ask for a narrower change,
additional evidence or a follow-up issue; that is part of keeping the project
easy to evolve.

There is no expectation that every contribution be accepted. Review is about
the fit, evidence and maintainability of the change, not about the person who
proposed it.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). For security issues,
follow [SECURITY.md](SECURITY.md) and do not disclose a vulnerability in a
public issue.
