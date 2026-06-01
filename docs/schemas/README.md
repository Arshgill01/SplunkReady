# Schema Notes

This directory defines the canonical shapes implementation must follow.

The schema files here are written as human-readable contracts first. Future waves may convert them into TypeScript/Zod/JSON Schema.

Required schema families:

- environment contract;
- mission;
- trace event;
- violation;
- readiness receipt;
- policy patch.

Schema changes require updating:

- compiler;
- fixture data;
- mission runner;
- grader;
- UI;
- receipt generator;
- tests.

