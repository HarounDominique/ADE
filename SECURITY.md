# Security policy

## Supported versions

Security fixes are considered for the latest published release and the
current `master` branch. Older releases may not receive backports.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting for
[HarounDominique/ADE](https://github.com/HarounDominique/ADE/security/advisories/new).

Include the affected version or commit, the impact, reproduction steps and
any suggested mitigation. If private reporting is unavailable, contact the
maintainers through a private GitHub channel and avoid sharing exploit details
publicly until a fix or coordinated disclosure date is agreed.

Please allow maintainers reasonable time to investigate. We will acknowledge
reports, keep the reporter informed when possible and credit the reporter if
they wish to be named.

## Scope and limitations

ADE is a local-first tool and may invoke locally installed agent providers,
toolchains and shells. Do not include real credentials, private data or
production repositories in bug reports or test fixtures. See the contribution
guide for the normal development checks.
