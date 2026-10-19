# ADR-001: TypeScript runtime and package boundary

Date: 5 October 2026. Amended 8 October 2026: Pop!_OS replaces Fedora as the Linux target under D25; the runtime and setup decisions are unchanged.

Status: TypeScript is established by D12. Node.js and package details are the engineering baseline for P01, subject to cross-platform tests.

## Context

Kitroute starts on demand and integrates with more than one host. A small package reduces setup differences between the shared core and adapters. The runtime must work on Windows and Pop!_OS Linux.

## Decision

Use Node.js 24.21.0 as the first tested baseline. Compile strict TypeScript to JavaScript with NodeNext modules. Publish compiled code rather than requiring runtime TypeScript transformation in an installed dependency.

Use npm with a committed lockfile, Node's test runner, and one private development package initially. Resolve and pin development dependency versions during P01. Keep production dependencies limited to functionality not available through the chosen runtime.

The runtime baseline is an engineering choice, not a claim that it is installed on the user's computer. P01 must prove it on both systems.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| Python core with TypeScript adapters | Not selected because the user chose TypeScript. |
| Rust executable | Not selected because it adds another implementation language. |
| Direct TypeScript distribution | Avoid for installed packages; ship JavaScript and type declarations where useful. |
| Multiple packages from the start | Defer until a host requires a separate install boundary. |

## Consequences and evidence

Developers need the supported Node runtime. A lockfile makes the development toolchain reproducible. Native binary dependencies are avoided where a tested built-in API is suitable.

P01 records runtime, build, test, and host-entry results. Update this ADR if the package requires another supported runtime floor.

Sources: [Node releases](https://nodejs.org/en/about/previous-releases), [Node TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html), and [TypeScript module configuration](https://www.typescriptlang.org/tsconfig/module.html).

Implementation: [P01](../phases/15_phase_01_foundation_discovery.md). Product decision: [D12](../../architecture/06_decision_log.md).
