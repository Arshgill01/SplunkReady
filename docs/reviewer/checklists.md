# Reviewer Checklists

## Product Review

- Product is still SplunkReady.
- Product is still certification, not an assistant.
- Demo still shows confident failure before recovery.
- Security is story, Platform & Developer Experience is track.

## Architecture Review

- Fixture/live boundary is preserved.
- Contract compiler does not depend on UI.
- Grader does not depend on LLM.
- Receipt generator can cite trace ids.

## Schema Review

- New fields are documented.
- Fixture data validates.
- Receipt fields trace to contract/mission/trace/violation.
- Mission checks reference rule ids.

## Test Review

- Tests include failure cases.
- Tests run without live credentials.
- Snapshot tests are stable.
- Live smoke tests are optional.

## Demo Review

- Failure is plausible.
- Patch explains why rerun improves.
- Rerun does not look scripted.
- Video path fits under 3 minutes.

## Submission Review

- README is runnable.
- Architecture diagram exists.
- License exists.
- Devpost claims match product reality.

