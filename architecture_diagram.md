# SplunkReady Architecture Diagram

```mermaid
flowchart LR
  subgraph Splunk["Splunk deployment"]
    S1["Splunk MCP Server"]
    S2["Indexes, sourcetypes, saved searches, knowledge objects"]
    S3["Optional hosted-model tools: saia_explain_spl, saia_optimize_spl"]
  end

  subgraph Agent["Agent under certification"]
    A1["Bundled specimen agent"]
    A2["Gemini-backed specimen when env-gated"]
    A3["External agent trace or MCP transcript"]
  end

  subgraph Compiler["Agent Readiness Compiler"]
    C1["Fixture/live adapter boundary"]
    C2["Environment Contract"]
    C3["Readiness Profile"]
    C4["Mission runner and trace recorder"]
    C5["Deterministic grader rules"]
    C6["Policy patch exporter"]
  end

  subgraph Output["Reviewable outputs"]
    O1["Readiness Receipt"]
    O2["Proof audit"]
    O3["Proof manifest"]
    O4["Local Workbench UI"]
    O5["Submission evidence pack"]
  end

  S1 --> C1
  S2 --> C1
  S3 -. advisory only .-> C6
  A1 --> C4
  A2 --> C4
  A3 --> C4
  C1 --> C2
  C2 --> C3
  C3 --> C4
  C4 --> C5
  C5 --> O1
  C5 --> C6
  C5 --> O2
  O1 --> O4
  O2 --> O3
  O3 --> O5
  C6 --> O1
```

## Boundary Notes

- Fixture and live Splunk paths share the same adapter interface before the compiler sees data.
- The grader is deterministic wherever possible. Hosted-model output can explain or suggest policy patches, but it is not the pass/fail authority.
- SplunkReady never auto-mutates Splunk. Policy patches are review artifacts.
- The workbench is a local review surface for receipts, proof audits, manifests, redacted exports, and run evidence.
- The tracked evidence pack lives in `submission-evidence/` and can be verified from a clean clone.
