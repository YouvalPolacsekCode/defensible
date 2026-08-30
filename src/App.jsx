import React, { useState, useEffect } from "react";

const MODULES = [
  {
    id: "trust", n: "01", part: 1,
    title: "Trust boundaries",
    sub: "Where text you didn't write starts making decisions",
    concept: [
      "Every system that reads the outside world has a line across it. On one side is content you authored — your code, your config, your prompts. On the other is content that arrived: an email body, a web page, a calendar invite, a webhook payload, a filename. The line matters because on one side text is data, and on the other side text becomes instructions.",
      "In ordinary software the line is usually obvious. A SQL injection is text from a form ending up in a query. The defence is structural: parameterised queries mean the database is told, mechanically, which part is instruction and which is data. Nobody asks the database to be careful.",
      "Systems built around a language model lose that mechanical separation. The model reads one flat stream of text and there is no syntax that says 'this part is authoritative and that part is quoted'. So the boundary has to be enforced somewhere else — by restricting what the model can do after it reads untrusted content, not by asking it to behave.",
      "The second thing to hold onto is persistence. A boundary crossing that only affects one run is a bug. A boundary crossing that writes into something read on every future run is a different category — it converts a single injection into a permanent one. Any file that gets loaded into a system prompt is therefore a much higher-value target than an ordinary data file, and needs a different class of protection.",
    ],
    caseTitle: "Seventeen doors, one paragraph of prose",
    case: [
      "An audit of a personal agent enumerated seventeen distinct paths by which text the system did not author reaches its prompt: messages, email bodies including spam and trash, PDF and OCR output from attachments, web search results, video transcripts, webhook payloads, meeting transcripts, wiki pages, issue bodies, and calendar invitations — which are attacker-controlled by definition, since anyone can send you one.",
      "The only defence in the codebase was a paragraph in the system prompt telling the model that these are data and not instructions. No structural separation, no delimiting, no restriction on what tools become unavailable after untrusted content has been read.",
      "The seventeenth path was the interesting one. Notes written during an earlier run get re-read as trusted context later — and three of those files are loaded into the system prompt on every run. An instruction injected into one of those files is no longer a one-shot; it is part of the system's identity from then on. The tool that writes files had no restriction on which paths it could target.",
    ],
    check: [
      { q: "Why is a prompt-level instruction ('treat this as data') a weaker defence than a parameterised query?",
        opts: ["It's slower at runtime", "It asks a probabilistic system to enforce a rule, rather than making the rule structurally impossible to break", "It only works on some models", "It can't handle non-English text"],
        a: 1, why: "Parameterisation removes the possibility mechanically. A prompt instruction is a request that usually works, and 'usually' is not a security property." },
      { q: "What makes a write into a system-prompt file categorically worse than a write into an ordinary note?",
        opts: ["It's harder to undo with git", "It's larger", "It converts a one-shot injection into one that reapplies on every future run", "It breaks the file format"],
        a: 2, why: "Persistence is the multiplier. One successful injection becomes permanent influence, and every subsequent run inherits it." },
    ],
    defend: [
      { q: "An interviewer says: 'You told the model not to follow instructions in emails. Isn't that enough?' Answer them.",
        model: "No, because it's a behavioural mitigation on a probabilistic system, not an invariant. It reduces the rate, it doesn't bound the outcome. The defensible version restricts capability rather than intent: after untrusted content enters the context, the set of reachable side-effecting tools should shrink — and the specific files that feed the system prompt should be unreachable from the tool layer entirely, so no amount of persuasion can touch them." },
      { q: "Name one untrusted path in something you've built that you had not previously thought of as untrusted, and say what it could reach.",
        model: "There is no model answer here — the point is whether you can enumerate your own boundaries without looking. If you can't name one, that's the finding." },
    ],
  },
  {
    id: "idem", n: "02", part: 1,
    title: "Idempotency",
    sub: "What happens when the same thing arrives twice",
    concept: [
      "An operation is idempotent when doing it twice leaves the world in the same state as doing it once. Setting a light to on is idempotent. Toggling a light is not. The distinction sounds academic until you notice that every unreliable link in a system turns 'once' into 'an unknown number of times'.",
      "The reason this comes up constantly is that a timeout tells you nothing. When a request times out, the caller knows only that it didn't hear back. The action may have completed, may have half-completed, may never have started. The caller now has two bad options: retry, and risk doing it twice; or don't, and risk it never happened. Neither is safe unless the operation itself is safe to repeat.",
      "So the design move is to push the safety into the operation rather than the caller. Prefer absolute commands over relative ones on any path that can be retried. Where the operation genuinely can't be made repeatable — sending an email, charging a card — give it a key, record that key when you act, and refuse the second call carrying the same key.",
      "The failure mode to watch for is a check-then-act with a gap in the middle. Read status, see it's open, perform the action, then mark it closed. Two callers arriving together both read 'open'. Both act. The fix is to write the intermediate state before doing the work, not after.",
    ],
    caseTitle: "Two taps, two emails",
    case: [
      "An approval queue held drafted actions — send this email, send this message — until a human tapped approve. The approve handler read the item, checked that its status was open, called the underlying function, and then marked it resolved.",
      "Nothing sat between the check and the resolve. A double-click, a mobile browser retrying, or the same page open in two tabs meant both requests read 'open' and both sent. The approve action was also a GET, which browsers retry freely and link-preview bots follow automatically.",
      "A separate system had a scheduler that computed its sleep interval by re-reading the clock at the bottom of a loop that could take longer than a minute. When it overran, it re-entered inside the same wall-clock minute, matched the same time-based automations, and fired them again. Nothing recorded that they had already run. The customer-visible symptom was blinds that opened and immediately closed — intermittent, unreproducible, and impossible to search for.",
    ],
    check: [
      { q: "Why does a timeout create an idempotency problem specifically?",
        opts: ["It always means the request failed", "It leaves the outcome unknown, so both retrying and not retrying are unsafe", "It means the network is down", "It doubles the latency"],
        a: 1, why: "The caller learns nothing about whether the work happened. That uncertainty is the whole problem." },
      { q: "In a read-check-act-write sequence, where should the intermediate state be written?",
        opts: ["After the action, so you don't record work that failed", "Before the action, so a second caller sees it's already claimed", "It doesn't matter as long as it's recorded", "In a log file rather than the store"],
        a: 1, why: "Writing after leaves the window open. Claiming first means the second caller finds a non-open status and stops, even if the first action later fails." },
    ],
    defend: [
      { q: "'Just add a retry.' Explain why that can make things worse, using a concrete action.",
        model: "A retry on a non-idempotent action multiplies it. Retrying a send produces two messages to a real person. Retrying a toggle inverts the intended state. Retrying an infrared power command turns a TV on and back off. Retries are only safe once the operation is repeatable — so the ordering is: make it idempotent, then add the retry." },
      { q: "Pick one action in a system you've built that would be harmful if it ran twice. What currently prevents that?",
        model: "The honest answer is often 'nothing, it just hasn't happened yet'. That's a finding, not a failure." },
    ],
  },
  {
    id: "unknown", n: "03", part: 1,
    title: "No versus don't know",
    sub: "The most expensive collapsed distinction in software",
    concept: [
      "Three states get flattened into two more often than almost any other mistake: yes, no, and I couldn't find out. When 'couldn't find out' silently becomes 'no', the system starts making confident false statements — and it makes them to the person least equipped to know they're false.",
      "The pattern usually enters through caching. A value is fetched periodically and cached with a time-to-live. When the cache goes stale, something has to decide what stale means. Treating stale as denial is often the safe-looking choice, because it fails closed. But it's only correct if staleness implies the underlying answer changed. If staleness usually means the network was down, denial is now a lie.",
      "The distinction that fixes it is recording why the last refresh failed, not just that the value is old. A refresh that failed with a network error is a different state from one that returned a genuine negative. They should produce different behaviour and, crucially, different words to the user.",
      "This is worth caring about beyond correctness, because these two states differ in who is at fault. A user told 'your subscription lapsed' hears an accusation. A user told 'we can't reach the server right now' hears a weather report. Same underlying condition, entirely different conversation.",
    ],
    caseTitle: "Blaming the customer for your outage",
    case: [
      "A subscription gate checked a locally cached entitlement rather than live reachability. That cache refreshed only on a successful hourly poll and carried a 24-hour expiry. Stale meant deny.",
      "So the chain was: server unreachable for more than 24 hours, cache goes stale, gate denies, and every paying customer's assistant tells them an active subscription is required. For a fault entirely on the operator's side.",
      "The audit's own summary: this converts a support call that opens with 'you charged me and turned it off' — the worst possible opening — into one that opens with 'the internet's out'. The fix touched one file. The difference was recording the failure reason and, when it was a network error, changing the words rather than the verdict.",
      "The same audit found the inverse elsewhere: a health check that returned 'connected' when the probe itself threw. A broken probe reported the connector as healthy. Unknown had been flattened the other way.",
    ],
    check: [
      { q: "A cached entitlement goes stale. What is the missing piece of information needed to decide correctly?",
        opts: ["How old the cache is", "Why the last refresh failed", "How many users are affected", "What the previous value was"],
        a: 1, why: "Age tells you the value is untrustworthy. The failure reason tells you whether to read it as a denial or as an outage." },
      { q: "Why is 'unknown treated as healthy' considered worse than 'unknown treated as degraded'?",
        opts: ["It uses more resources", "It produces false alarms", "It hides real failures — silence becomes a green light", "It's harder to implement"],
        a: 2, why: "A monitoring system that reads absence of evidence as evidence of health will be quiet during exactly the outages it exists to catch." },
    ],
    defend: [
      { q: "'Failing closed is always the safe choice.' Push back on that with a concrete counterexample.",
        model: "Failing closed is safe only when the closed state is the honest one. If staleness usually indicates an outage rather than a changed answer, failing closed produces a confident false claim about the user — and the cost lands on trust, not on function. The safe move is to fail closed on capability while being accurate about cause: deny the feature, but say you couldn't reach the server rather than that they didn't pay." },
      { q: "Find one place in your own systems where 'we couldn't check' currently renders as a definite answer. What does the user see?",
        model: "Look for cached flags, health probes with catch-alls returning a default, and any boolean that gets set from a call that might have thrown." },
    ],
  },
  {
    id: "silent", n: "04", part: 1,
    title: "Silent failure",
    sub: "When the symptom is an absence",
    concept: [
      "The failures that survive longest are the ones whose symptom is that nothing happens. A crash gets fixed within the hour because someone sees the stack trace. A pipeline that quietly stops processing looks exactly like a quiet week, and can run for months.",
      "Cursors are the classic vehicle. A cursor records how far you've processed, and everything above it is pending, everything below handled. Cursors are usually monotonic — they only move forward — which is sensible until something writes a value that's too high. Now the records below it are permanently invisible, the queue reports empty, the logs say 'nothing new', and the system cannot self-correct because moving backwards isn't allowed.",
      "The general shape is: any value that gates visibility, and can only move one way, needs a clamp against reality. Not against what the caller says it should be — against what actually exists.",
      "The second family is the swallowed error. A catch-all that logs and continues is often correct; you don't want a failed metrics write to kill a run. But the same pattern applied to the main path produces a run that reports success while doing nothing. The distinguishing question is whether the caller can tell the difference between 'completed' and 'completed nothing', and whether anything downstream acts on that difference.",
    ],
    caseTitle: "A hallucinated number blinds the whole pipeline",
    case: [
      "A model was given a tool to mark inbound records as filed up to a given id. The implementation took the maximum of the supplied id and the current cursor. There was no clamp against the highest id that actually existed.",
      "One hallucinated value — 9999 instead of 99 — would permanently suppress every record below it. Message capture, link processing, meeting transcripts: all silently stop. And because the pending check drives whether the sweep runs at all, the log line reads 'nothing new, skipping'. Indistinguishable from a quiet day. The cursor is monotonic, so it can never recover on its own.",
      "The audit called this the highest damage-to-fix ratio in the codebase: two lines, clamping to the real maximum. It had already happened once in production.",
      "Compounding it: when the model provider was down, the run threw, the error was caught and recorded, and the caller never checked. Cursors advanced anyway. Six hours of outage meant six hours of input scanned past and never seen again.",
    ],
    check: [
      { q: "Why is a monotonic cursor particularly dangerous when it can be set from an untrusted or unreliable source?",
        opts: ["It uses more storage over time", "It can't move backwards, so a single bad value is permanent", "It's slower to read", "It breaks ordering guarantees"],
        a: 1, why: "Monotonicity is a safety property against duplicates and a liability against wrong values. One overshoot cannot be undone by the system itself." },
      { q: "A scheduled job catches all exceptions, logs them, and returns normally. What's the specific danger?",
        opts: ["Logs grow too large", "The caller treats a failed run as a successful one and advances state accordingly", "The exception type is lost", "It's slower than letting it propagate"],
        a: 1, why: "Swallowing is fine for side concerns. On the main path it lets downstream state — cursors, checkpoints, 'last synced' markers — move as though work was done." },
    ],
    defend: [
      { q: "How would you detect, from the outside, that a capture pipeline had silently stopped?",
        model: "You can't detect it from the pipeline's own logs, because absence looks like quiet. You need an independent expectation: a heartbeat that asserts a minimum rate over a window, or a periodic reconciliation that counts source-side records against processed ones. The general rule is that silence has to be evaluated, not just reported — and an unknown must never be scored as healthy." },
      { q: "Name a value in your systems that gates visibility and only moves one way. What clamps it?",
        model: "Cursors, watermarks, 'last processed' timestamps, and dedup sets that never expire all qualify." },
    ],
  },
  {
    id: "invariant", n: "05", part: 1,
    title: "Stated versus enforced",
    sub: "The gap between what the docs claim and what the code guarantees",
    concept: [
      "An invariant is a property that holds no matter what. The word gets used loosely for properties a team intends to hold, which is a different and much weaker thing. The test is mechanical: if someone wrote code violating the property tomorrow, would anything stop them? If the answer is 'a reviewer might notice', it's a convention, not an invariant.",
      "Conventions aren't worthless — most codebases run on them. The failure is calling them guarantees, because then you build on top of them as though they can't break, and you describe them to other people as though they've been verified.",
      "Three cheap mechanisms turn a convention into an invariant. A type, so the wrong thing doesn't compile. A gate, so the wrong call is refused at runtime. A test that fails, so the wrong change doesn't merge. Which one you reach for matters less than that one of them exists.",
      "There's a specific trap for interfaces defined ahead of their use. Writing the abstraction first is reasonable; the trap is that a well-formed interface with a passing test looks identical, from the outside, to one that's actually load-bearing. The only difference is call sites, and nothing warns you when there are none.",
    ],
    caseTitle: "A boundary that nothing crosses",
    case: [
      "One system's documentation described a clean separation between its reasoning layer and its execution layer: protocols on both sides, in-process implementations, swap hooks, and a note that moving one half onto a remote machine would be a config change.",
      "The module was imported by exactly two files: itself, and its own test. A repository-wide search for the interface's methods outside the test returned nothing. The three services named in the docstring as consumers didn't import it; one called the underlying client directly. The claim that one layer never imports the other was false by construction, because the layer described didn't exist.",
      "The consequence is narrow but expensive: splitting the system remains a refactor rather than a config change, and anyone reading the docs — including the person who wrote them — would estimate that work wrongly by an order of magnitude.",
      "The same audit noted a different property that was genuinely enforced: the model was forbidden from using the underlying platform's identifiers, and a translation layer converted them on the way out. That one held, because it was in the code path rather than in the prose.",
    ],
    check: [
      { q: "What is the operational test for whether something is an invariant rather than a convention?",
        opts: ["Whether it's documented clearly", "Whether the team agrees on it", "Whether a violating change would be mechanically stopped", "Whether it has ever been violated"],
        a: 2, why: "Documentation and agreement are conventions. An invariant has an enforcer: a type, a gate, or a failing test." },
      { q: "Why can a passing unit test be misleading evidence about an abstraction?",
        opts: ["Tests can be flaky", "It proves the interface works in isolation, not that anything uses it", "Unit tests don't cover integration", "It might test the wrong branch"],
        a: 1, why: "A green test on a module with zero production call sites tells you the code is correct and irrelevant. Nothing surfaces the absence of callers." },
    ],
    defend: [
      { q: "Name a property of one of your systems that you would state confidently in an interview. Now say what enforces it.",
        model: "This is the whole module in one question. If the enforcer is 'the prompt says so' or 'I always do it that way', you've found a convention you've been describing as a guarantee. That's not a reason to stop claiming it — it's a reason to claim it accurately, and to know what it would take to make it true." },
    ],
  },
  {
    id: "atomic", n: "06", part: 1,
    title: "Atomic writes",
    sub: "Why read-modify-write loses data",
    concept: [
      "A write that isn't atomic has an observable middle. Something can read the file, or the process can die, while it's half-done. The two consequences are lost updates and corrupt files, and both show up as soon as more than one thread touches the same store.",
      "The lost-update shape: two writers read the same file, each adds its own change, each writes the whole thing back. The second overwrites the first. Nothing errors. The first update simply never existed, and there's no trace that it was discarded rather than never attempted.",
      "The corruption shape: writing typically truncates the file and then writes new contents. A crash between those two steps leaves an empty or partial file. What happens next depends on the read path — and a read path that responds to a parse failure by returning an empty collection and logging 'corrupt, starting fresh' will silently discard the entire store.",
      "The standard fix is small and fixes everything at once: write to a temporary file, then rename it over the target. Rename is atomic on POSIX, so a reader sees either the old file or the new one, never a half-written one. Add a lock for the read-modify-write window, and append genuinely in append mode rather than rewriting the whole file.",
    ],
    caseTitle: "One helper, six broken stores",
    case: [
      "A memory module offered read, write, and append. Read was a plain file read. Write was a plain file write. Append read the entire file, concatenated the new line, and wrote the whole thing back. No locking, no atomic replace.",
      "Writers ran on at least three threads: a scheduler, a web framework's threadpool for synchronous handlers, and a background thread spawned per request on a public endpoint. Two records arriving together could get the same id, because ids were derived from line count.",
      "The append implementation also made growth quadratic. Every new event read and rewrote the entire log. At a per-minute cadence on a store that was never trimmed, the disk write load grows without bound until the volume fills.",
      "The audit's note: fixing this one file — temporary file plus rename, a lock, and real append mode — resolved a lost-update bug, a corruption bug, and an unbounded-growth bug simultaneously. Roughly twenty-five lines.",
    ],
    check: [
      { q: "Why does write-to-temp-then-rename fix the corruption case?",
        opts: ["Renaming is faster than writing", "Rename is atomic, so a reader sees either the complete old file or the complete new one", "It keeps a backup automatically", "It avoids file locks"],
        a: 1, why: "The target path is only ever pointed at a fully-written file. There is no moment where a reader can observe a partial state." },
      { q: "Two threads append to the same file via read-concatenate-write. What is the failure?",
        opts: ["The file becomes unreadable", "One append is silently lost", "The process deadlocks", "The order is reversed"],
        a: 1, why: "Both read the same starting content; the second write overwrites the first writer's addition. No error is raised, so nothing indicates data was discarded." },
    ],
    defend: [
      { q: "'It's a single-user system, concurrency doesn't apply.' Answer that.",
        model: "Single user doesn't mean single writer. A scheduled job, an inbound webhook, and a background worker are three concurrent writers regardless of how many humans are involved. The relevant count is threads and processes touching the store, not people. And the corruption case needs no concurrency at all — one crash mid-write is enough." },
    ],
  },
  {
    id: "observe", n: "07", part: 1,
    title: "That versus why",
    sub: "Knowing something broke is not knowing what broke",
    concept: [
      "Observability splits into two questions that need different data. Is something wrong is answered by counters, health checks, and heartbeats. What is wrong is answered by text: logs, traces, error messages. Systems commonly build the first well and skip the second, because counters are cheap to ship and text is not.",
      "The consequence is a specific and frustrating operational state. You can see a component is unhealthy and you cannot see why without physical or shell access. For anything running on hardware you can't reach — a customer's machine, an embedded device — that gap is the difference between a remote fix and a visit.",
      "Two design points are worth internalising. First, silence must be evaluated rather than treated as absence of news: if a reporter hasn't checked in, that is itself a signal, and it should outrank whatever the last payload claimed. Second, an unknown should never score as healthy, because the whole point of monitoring is to catch the case where things stop.",
      "Third, and most often missed: the surface a user judges you on may not be instrumented at all. If failures on that path are caught and turned into a friendly error string, every health metric can read green while the thing people actually use is completely broken.",
    ],
    caseTitle: "Green dashboards, broken product",
    case: [
      "A fleet of devices posted around twenty-five health fields every five minutes: versions, uptime, disk, memory, container health, sensor counts, deployment state. The evaluation logic was a pure function, unit-testable, with silence evaluated first — twenty minutes late meant degraded, sixty meant down. Unknown explicitly did not mean healthy. That part was genuinely well built.",
      "But telemetry carried counters and never a line of text. No log shipping. So 'it stopped working' with no matching health rule meant knowing that something was wrong and never what. Only shell access produced the traceback.",
      "And the conversational surface — the one customers judge the product on — reported nothing at all. Failures there were caught and converted into a polite error message shown to the user. Chat could be completely broken in a home while every health field read green.",
      "Nothing paged anyone either. A device going down at 2am was visible only when a human opened the console.",
    ],
    check: [
      { q: "Why must silence be evaluated before the contents of the last report?",
        opts: ["Reports are often malformed", "A device that has stopped reporting can't tell you it's broken — its last report will claim health", "It reduces storage costs", "Reports arrive out of order"],
        a: 1, why: "The final payload from a dying system usually looks fine. Absence is the signal, and it has to outrank a stale claim of health." },
      { q: "What can counters-only telemetry fundamentally not tell you?",
        opts: ["Whether a system is up", "How many errors occurred", "Why a specific failure happened", "How much disk is free"],
        a: 2, why: "Counts localise a problem to a subsystem at best. Diagnosis needs the text — the message, the trace, the offending input." },
    ],
    defend: [
      { q: "A user says 'it stopped working.' Walk through exactly what you could determine remotely, and where you'd get stuck.",
        model: "The valuable part is the second half. Name the precise point where you'd need shell access, and what one piece of shipped data would have removed that need. Usually it's the last N error lines, or a single structured error event per failed user-facing operation." },
    ],
  },
  {
    id: "blast", n: "08", part: 1,
    title: "Blast radius",
    sub: "What one leaked value costs you",
    concept: [
      "Every credential should be describable in one sentence: what it opens, for whom, and for how long. If the sentence is hard to write, the credential is doing too many jobs — and the cost of a leak is correspondingly hard to bound.",
      "Two properties dominate. Scope: does this value open one account or the whole fleet? A per-tenant key means a leak is a single incident. A shared key held on every deployed machine means a leak from any one is a leak of all. Revocability: can you turn it off remotely? A secret that can only be replaced by physical or shell access is not really revocable, and the day it leaks you find that out.",
      "There's also a quieter failure: credentials that quietly become authorisation. A value intended to prove 'this request came from our infrastructure' turns into a full-admin bearer token when the receiving side derives permissions from headers accompanying it rather than from an identity it verified itself.",
      "The right questions to ask of any secret are the same four, every time. What does it open. Who holds a copy. How would I revoke it at 3am. How would I know it had leaked.",
    ],
    caseTitle: "A shared secret that outranks the owner",
    case: [
      "A device held a per-home secret used to sign requests to a central service. On the return path, that same secret authenticated inbound requests — and the receiving middleware took the caller's role from a request header, mapping one value to a rank above the homeowner's own administrator account, on every route including factory reset.",
      "The device's hostname was publicly resolvable. So the secret was not a signing key; it was a full-admin bearer token for that home. The comparison was a plain string equality rather than a constant-time compare.",
      "Rotation existed in exactly one path: when the secret still equalled a legacy hardcoded default. Once a device held a real per-home value, nothing rotated it again, and the destination file was on the host, which the application container could not write. Rotating a live device's secret required shell access — meaning a leak could not be revoked remotely.",
      "Elsewhere the same audit found a third-party API key shared fleet-wide, stored on every device. One extracted copy would bill the company account, and rotating it meant touching every unit.",
    ],
    check: [
      { q: "What makes a secret effectively unrevocable?",
        opts: ["It's very long", "Replacing it requires physical or shell access to each holder", "It's stored in an environment variable", "It has no expiry date"],
        a: 1, why: "Revocation you can't perform remotely isn't revocation. On the day it leaks, the recovery plan is a visit to every device." },
      { q: "Why is deriving a caller's role from a request header dangerous even when the header is stripped at the edge?",
        opts: ["Headers are slow to parse", "Anyone reaching the service directly, bypassing the edge, supplies their own role", "Headers have size limits", "It breaks caching"],
        a: 1, why: "The stripping only protects the path that goes through the edge. If the service is directly reachable, the header is attacker-supplied and the secret alone becomes full authorisation." },
    ],
    defend: [
      { q: "Pick your most sensitive credential. Answer all four questions: what it opens, who holds it, how you'd revoke it at 3am, how you'd know it leaked.",
        model: "Most people can answer the first two and stall on the third and fourth. Stalling is the result — it tells you which secret to fix first, and 'I would drive there' is a legitimate answer as long as you know it before it happens rather than during." },
    ],
  },

  {
    id: "evals", n: "09", part: 2,
    title: "Evals",
    sub: "How you'd know it did the right thing rather than a plausible one",
    concept: [
      "Ordinary software fails loudly. A model-driven system fails fluently: it produces a well-formed, confident, wrong answer, and nothing in the stack objects. So the usual safety net — errors surfacing — doesn't exist, and something has to replace it.",
      "An eval is that replacement, and it's simpler than the word suggests. A fixed set of inputs. For each, what the correct behaviour is. A way to score the actual behaviour against it. Run the set whenever anything changes. That's it — there's no framework you need before you can start, and thirty examples in a file beats an elaborate harness you never build.",
      "The reason to care is not academic quality measurement. It's that without one, you cannot change a prompt. Every edit becomes a gamble: you fix the thing you noticed and have no way to see what you broke. Teams without evals stop touching their prompts, which is a worse outcome than a mediocre eval.",
      "Score the thing you actually care about. For an agent, that's usually not the prose — it's whether the right tool was called with the right arguments, and whether the dangerous ones stayed uncalled. Those are checkable exactly, without a judge model and without ambiguity.",
    ],
    caseTitle: "Correctness rested on someone noticing",
    case: [
      "An agent with access to its owner's email, messages and calendar was asked how anyone would know it had done the right thing rather than a plausible wrong thing. Its own answer: no test suite, no eval harness, no golden set. Correctness rested on the approval gate catching irreversible mistakes, on freshness stamps, and on the owner spotting errors.",
      "Its self-report also named the deepest risk precisely: a rule that one fact must be propagated to every file it touches, enforced by the model following prose rather than by any invariant. Miss a backlink and the memory quietly disagrees with itself, with no mechanism that would ever surface the contradiction.",
      "The paired system had the opposite shape and the same hole: two thousand two hundred and fifty-seven tests, passing cleanly, and not one of them checked whether a spoken command was understood correctly. The most-used surface in the product was the least verified.",
    ],
    check: [
      { q: "What's the practical cost of having no eval set for a prompt-driven system?",
        opts: ["Slower inference", "You can't change the prompt without gambling on what you might have broken", "Higher token spend", "The model drifts over time on its own"],
        a: 1, why: "Regression invisibility is the real cost. It leads teams to freeze prompts they know are imperfect, because editing is unaccountable." },
      { q: "For an agent with tools, what's usually the most reliable thing to score?",
        opts: ["The fluency of the prose response", "Whether the right tool was called with the right arguments, and dangerous ones weren't", "Response length", "Time to first token"],
        a: 1, why: "Tool calls are discrete and checkable exactly. Grading prose needs a judge and introduces its own error; grading calls doesn't." },
    ],
    defend: [
      { q: "Design the smallest useful eval for a system you've built. What are the inputs, what's the expected output, and what would count as a regression?",
        model: "Strong answers are unglamorous: twenty to thirty real inputs pulled from actual logs, the tool call each should produce, and a pass rate that must not drop. The test of whether you understand evals is whether your answer is something you could write this week, not something that needs a project." },
      { q: "Your system depends on the model following a rule stated in prose. How would you find out it had stopped?",
        model: "You wouldn't, which is the point. Either convert the rule into something checkable after the fact — a consistency check that runs nightly and reports contradictions — or accept that it's a convention and stop describing it as a guarantee. Module 05 is the same lesson from the other direction." },
    ],
  },
  {
    id: "context", n: "10", part: 2,
    title: "Context and cost",
    sub: "The prompt is a data structure with a budget",
    concept: [
      "It's easy to treat the prompt as text you write once. In a running system it's an assembled artifact, rebuilt per request from parts with different lifetimes: a stable system section, slower-moving reference data, and volatile per-request state. Those lifetimes are the design, because they determine what can be cached and what grows.",
      "Growth is the thing to watch. Anything inlined from a collection — a device list, a user's files, a catalogue — scales with that collection. It's fine at ten items and a problem at four hundred, and nothing warns you at the crossover. Any inlined collection needs a cap, a summary, or a retrieval step, decided deliberately rather than discovered in a bill.",
      "Caching follows lifetime. Put the stable material first and mark the boundary; put volatile material last. Get the order wrong and every request invalidates the cache, so you pay full price for content that never changed.",
      "And metering isn't governing. Recording spend produces a nice chart. Bounding it requires something that reads the number and refuses. Without that, the ceiling on a runaway loop is whatever your API key allows.",
    ],
    caseTitle: "Rebuilt from scratch, every single turn",
    case: [
      "A home assistant built its system prompt fresh on every conversational turn, inlining the entire device directory — names, rooms and live state for every device in the house. No cap, no summarisation, no cache. Prompt size scaled linearly with how many devices a customer owned, which meant the best customers paid the most per sentence.",
      "The agent system had solved the caching half well: a one-hour cache breakpoint on the stable system section and tools, a rolling five-minute one on the most recent message, with volatile state deliberately placed in its own block. The lifetimes were reasoned about.",
      "But nothing bounded spend anywhere. Token usage was recorded and priced, and no code path read that number to make a decision. A triage job fired every minute; a flag that failed to clear turned each of those minutes into a full model run. An earlier incident had already produced a bill roughly three times the estimate.",
    ],
    check: [
      { q: "Why does inlining a full collection into a system prompt become a problem gradually rather than suddenly?",
        opts: ["Models get slower over time", "Cost and latency scale with the collection, and nothing signals the point where it stopped being reasonable", "Caches expire", "It only affects large models"],
        a: 1, why: "There's no error at the crossover. It works at ten, works worse at a hundred, and the first real signal is usually a bill or a complaint about latency." },
      { q: "What's the difference between metering spend and bounding it?",
        opts: ["None, they're the same mechanism", "Metering records; bounding requires something that reads the number and refuses to proceed", "Bounding is done by the provider", "Metering is more accurate"],
        a: 1, why: "A ledger nobody consults is documentation of the overspend, not a control on it." },
    ],
    defend: [
      { q: "Sketch how you'd assemble a prompt for a system with a large, slowly-changing dataset. What's cached, what isn't, and what's the cap?",
        model: "Layer by lifetime: stable instructions and tool definitions cached longest; reference data summarised or retrieved rather than inlined whole, with an explicit cap and a rule for what to do when the cap is hit; volatile per-request state last, uncached. The cap is the part most people leave out, and it's the part that decides whether this scales." },
    ],
  },
  {
    id: "tools", n: "11", part: 2,
    title: "Tool design",
    sub: "A schema is a contract with a caller that will lie to you",
    concept: [
      "Tool schemas look like ordinary function signatures, but the caller is not ordinary. It's non-deterministic, it can be influenced by anything in its context, and it will occasionally produce arguments no reasonable programmer would write. Design the interface for that caller.",
      "First rule: never read authorisation from arguments the model supplies. If a flag in the argument dict decides whether a dangerous action executes or gets held for a human, then the gate is inside the thing being gated. Anything that can influence the model's output can flip it. Authorisation belongs on a path the model cannot address at all.",
      "Second: clamp everything numeric. An unbounded count in a tool that loops per item turns one call into hundreds of sequential requests, blocking whatever lock the run holds and exhausting the downstream rate limit. The model didn't intend harm; it just picked a large number.",
      "Third: the schema is the model's entire understanding of the tool. Undeclared fields, vague descriptions, and permissive extra-property handling are all ways for arguments you never designed to reach your code. Declare exactly what's allowed and reject the rest.",
    ],
    caseTitle: "The gate that could be opened by the thing it gated",
    case: [
      "A tool that could execute scripts distinguished computing scripts from externally-acting ones. Acting scripts were supposed to be held for a human tap. The implementation read two values from the arguments: whether the script acts, and whether it was approved.",
      "Both came from the dictionary the model controls. The approved flag existed so that a human approval could re-invoke the tool and have it run — reasonable in intent. But it also meant a model emitting that flag directly would skip the human entirely, overriding the hardcoded list of acting scripts that had been added as a backstop. The schema declared three fields and not that one, and set no restriction on extra properties.",
      "In the same file, a search tool read a result count from arguments with no clamp, then issued one request per result, sequentially, per connected account. A request for five hundred across two accounts becomes a thousand sequential calls holding the global run lock.",
    ],
    check: [
      { q: "Why can't an authorisation flag live in model-supplied arguments?",
        opts: ["It's slower to parse", "Anything that can influence the model's output can set the flag, so the gate is inside the thing it gates", "Arguments aren't logged", "The schema can't express booleans"],
        a: 1, why: "The check has to sit on a path the model cannot address. If approval re-invokes a tool, give that path its own dispatch entry that never appears in the schema." },
      { q: "An unclamped count argument in a per-item loop mainly causes what?",
        opts: ["A parsing error", "Hundreds of sequential calls that block the run and exhaust rate limits", "Incorrect results", "Higher memory use only"],
        a: 1, why: "The model picks a plausible-looking large number and your code faithfully executes it. Clamping is one line and prevents the whole class." },
    ],
    defend: [
      { q: "Take one tool you've exposed to a model. What's the worst set of arguments it could be called with, and what happens?",
        model: "Look for three things: unbounded numbers, unrestricted paths or identifiers, and any field that changes what safety checks apply. The interesting answer is usually the third — a field added for convenience that turns out to sit upstream of a gate." },
    ],
  },
  {
    id: "degrade", n: "12", part: 2,
    title: "Degradation",
    sub: "What still works when the thing it depends on is gone",
    concept: [
      "Every dependency deserves an answer to one question: when this is unavailable, what specifically still works? Not a vibe about resilience — an enumerated list, derived from the code, of surfaces that survive and surfaces that don't.",
      "The reason to write it down is that this list is usually also a marketing claim, and claims made without checking the code are the ones that turn into refunds. Whatever you say in the sales conversation should be something you derived by reading call sites, not something you inferred from an architecture diagram.",
      "The most common false comfort is the configured-but-dead fallback. A secondary path exists in the codebase, is described in comments as a fallback, and cannot possibly run — because it needs a credential that provisioning never writes, or a model that was never installed. It looks like resilience in review and provides none in production.",
      "The test for a fallback is not whether the code exists. It's whether you have watched it carry real traffic. Anything untested under the condition it exists for should be described as untested, including to yourself.",
    ],
    caseTitle: "Local-first, except for the part people use",
    case: [
      "A product marketed as requiring no cloud for core operation was audited against that claim. The result split cleanly. Genuinely local: all device control, automations and schedules, sensor logic, presence, infrared, local notifications, the app itself, and even software updates. That's a substantial and real list.",
      "Not local: every natural-language surface. Anything the user said that wasn't an exact phrase match fell through to unrecognised. The automation designer, camera descriptions, and reply translation all failed too.",
      "Two fallbacks looked like coverage and weren't. A local model was configured as the backend for one minor purpose only, while the three purposes that mattered defaulted to the cloud with nothing switching them on failure. And a speech-to-text fallback resolved to a client requiring an API key that the factory imaging process never wrote — so on the day the local model failed to load, the fallback raised an auth error and the user got silence.",
      "The audit rewrote the sales line to what the code supports: your lights, climate, sensors, automations and the app keep working with no internet; talking to it in plain language needs a connection.",
    ],
    check: [
      { q: "What's the reliable way to establish what survives a dependency outage?",
        opts: ["Read the architecture diagram", "Ask whoever built it", "Trace the call sites for each surface and check which cross the boundary", "Check the uptime dashboard"],
        a: 2, why: "Diagrams describe intent. Call sites describe behaviour, and the two diverge exactly where it matters most." },
      { q: "Why is a configured-but-never-exercised fallback worse than no fallback at all?",
        opts: ["It uses more memory", "It creates confidence in resilience that doesn't exist, so nothing else compensates", "It's harder to remove later", "It slows the primary path"],
        a: 1, why: "No fallback is a known gap you plan around. An untested one is an unknown gap you've already stopped worrying about." },
    ],
    defend: [
      { q: "Pick your most important external dependency. Enumerate what survives its outage and what doesn't — then say which side the thing users judge you on falls on.",
        model: "The last clause is the one that matters. A long list of surviving background machinery is small comfort if the surface people actually touch is on the other side. That's also the sentence you should be using in sales." },
    ],
  },
  {
    id: "timeouts", n: "13", part: 2,
    title: "Timeouts and retries",
    sub: "Layered deadlines that disagree",
    concept: [
      "Every request passes through several components that each have an opinion about how long is too long: a browser, a proxy, a server, a client library, a socket. Those deadlines form a stack, and they need to be ordered deliberately — inner shorter than outer — or the layers disagree about what happened.",
      "The classic failure is an outer deadline shorter than an inner one. The user's client gives up first and shows an error. The server keeps going, completes the work, and bills for it. From the user's side the operation failed. From the system's side it succeeded. Both records are wrong about the other, and any retry now compounds it — which is where this module meets idempotency.",
      "The second trap is that 'timeout' often means per-read, not total. A response that trickles bytes slowly stays under a per-read timeout indefinitely. If you need a bound on total elapsed time, you have to impose it explicitly — a wall-clock watchdog or a subprocess with a hard kill.",
      "And retries need shape: backoff so you don't amplify an overload into an outage, jitter so a fleet doesn't retry in lockstep, and a cap so failure eventually surfaces instead of looping. Retry logic applied unevenly across providers means one dependency's bad minute takes down a daily job while another shrugs it off.",
    ],
    caseTitle: "The user sees a failure, you get the bill",
    case: [
      "A hub configured a 120-second read timeout on its model client. The browser calling it aborted at 30. So on any slow response the user saw a timeout at thirty seconds while the hub held the request open for up to ninety more — the upstream call completing, being billed, and the reply discarded.",
      "In the same system, a proxy's timeout and the client's were both set to thirty seconds, racing each other with no ordering.",
      "The agent system had the per-read trap. Media downloads used libraries whose timeout bounds each socket read rather than the transfer, so a slow-drip response could run indefinitely while staying under the limit — inside a tool call that held the global run lock, blocking interactive chat until it gave up. Two satellite processes on other machines had got this right, with a hard subprocess timeout and a self-kill. The server path hadn't.",
      "Retry coverage was uneven: the primary provider inherited two retries from its SDK, while two others had a single request each. One rate-limit response ended an entire nightly job until the same time the next day.",
    ],
    check: [
      { q: "What goes wrong when an outer timeout is shorter than an inner one?",
        opts: ["Nothing, the shortest wins correctly", "The caller reports failure while the work completes and is billed — two contradictory records", "The connection leaks", "The retry count resets"],
        a: 1, why: "Both sides end up holding a wrong account of what happened, and any retry now risks doing the work twice." },
      { q: "Why doesn't a per-read timeout bound total time?",
        opts: ["It only applies to writes", "A response that keeps trickling bytes never exceeds the per-read limit and can run indefinitely", "It's disabled by default", "It only applies to the first byte"],
        a: 1, why: "Each individual read finishes in time. Bounding the whole operation needs an explicit wall-clock deadline." },
    ],
    defend: [
      { q: "Draw the timeout stack for one request path you own, from client to upstream. Is it correctly ordered?",
        model: "Name each layer and its number. Correct means each inner deadline is meaningfully shorter than the one outside it, so the layer closest to the work is the one that gives up first and can report why. If two are equal or inverted, you have a race, and the user-facing story and the billing story will diverge." },
    ],
  },
  {
    id: "bounds", n: "14", part: 2,
    title: "Bounded before allocated",
    sub: "Checking the size after you've already loaded it",
    concept: [
      "A limit enforced after allocation isn't a limit. Reading an entire upload into memory and then checking whether it was too large means the damage — the memory, the CPU, the disk — is already done. On a small machine that's the whole process, and if that process also runs your scheduler, it's everything.",
      "The pattern repeats at every layer. Decode every page of a document and then keep the first fifteen. Parse a whole request body and then check its length. Fetch every row and then filter. In each case the correct version pushes the bound into the operation: ask for fifteen pages, check the declared length before parsing, filter in the query.",
      "Unbounded work has a second form that's slower to notice: growth over time. A store that's appended to and never trimmed, on a fixed disk, has a completion date. If each append also rewrites the whole file, the cost per append grows with total size and you get quadratic behaviour, which is fine for weeks and then abruptly isn't.",
      "The habit worth building is asking, for any input, what the maximum is and what enforces it. If the honest answer is 'whatever the caller sends', that's the finding.",
    ],
    caseTitle: "One emailed PDF takes down everything",
    case: [
      "A document reader rendered pages to images at 200 dpi and then sliced the result to the first fifteen. The rendering call had page-range parameters available and unused, so every page was decoded first regardless.",
      "A two-hundred-page scanned document is on the order of gigabytes of decoded bitmaps. The machine had 512 MB and ran the web server and the scheduler in the same process, so the out-of-memory killer would take down the entire system. The path was reachable by anyone who could email the owner an attachment.",
      "Three upload endpoints enforced their size caps after loading the payload into memory, with base64 inflating it by a third along the way. A public endpoint with no rate limit spawned a thread and an outbound connection per request. And the shared append helper rewrote whole files, on stores that were never trimmed, at a per-minute cadence — growing until the volume filled.",
    ],
    check: [
      { q: "Why is checking an upload's size after reading it into memory ineffective?",
        opts: ["The size is inaccurate at that point", "The memory has already been allocated, so the harm is done before the check runs", "It's slower than checking before", "Encodings change the size"],
        a: 1, why: "The check only prevents further processing. Refusing early — on the declared length, before parsing — is what actually protects the process." },
      { q: "What makes read-concatenate-write appends quadratic?",
        opts: ["Disk seek time", "Each append reads and rewrites the entire file, so per-append cost grows with total size", "Encoding overhead", "The lock contention"],
        a: 1, why: "Total work grows with the square of the number of appends. It's invisible for weeks and then dominant." },
    ],
    defend: [
      { q: "Name every input to one of your systems that has no maximum. For each, what's the worst case?",
        model: "Uploads, model-supplied counts, webhook bodies, collection sizes inlined into prompts, and append-only stores all belong on this list. The worst case worth naming isn't 'it gets slow' — it's which shared resource runs out and what else dies with it." },
    ],
  },
  {
    id: "tenancy", n: "15", part: 2,
    title: "One user, silently",
    sub: "Assumptions that only surface with a second customer",
    concept: [
      "Software built for its author accumulates assumptions that are invisible until someone else uses it. They rarely announce themselves as design decisions — they show up as small conveniences that happened to be true during development.",
      "The tell-tale shapes are worth memorising because they're greppable. Taking the first element of a collection where any element would do. Default identifiers that are the same on every install. Configuration read from a global when it should be per-user. Anything named 'primary' or 'default' that was never meant to stay.",
      "The consequences split into two kinds. Correctness: a household setting resolved from whichever account sorts first means the second person's preferences are silently ignored — and the symptom is a complaint that sounds like a bug in a completely different feature. Collision: two installs sharing a default identifier occupy the same row in a central store, and their data merges.",
      "There's also fleet behaviour. Anything scheduled at a fixed time, on every install, arrives at the central service simultaneously. It's fine at ten installs and a self-inflicted denial of service at a thousand. Jitter is one line, and it's always deferred because the comment says 'add this when we grow'.",
    ],
    caseTitle: "Whoever sorts first decides",
    case: [
      "A quiet-hours feature listed users from the database and took index zero. In a two-person household, quiet hours were whoever happened to sort first, and the partner's settings were ignored entirely. The same pattern appeared in a second module.",
      "It also defaulted to disabled and returned false on any exception, so on a fresh install the entire rule it gated could never fire — and quiet-hours suppression was silently inert. A failing test in the suite had been pointing at exactly this and was assumed to be test rot.",
      "Elsewhere: a default identifier meant any install without configuration registered under the same name, so two would collide on one row. A push credential was shared fleet-wide, so one compromised device compromised notifications for every customer. And a scheduled poll fired on the hour across the whole fleet, with a comment noting it was fine for the first thirty customers and jitter should be added later.",
    ],
    check: [
      { q: "Why is 'take the first user from the list' a hard bug to trace?",
        opts: ["It throws intermittently", "It produces a wrong-but-plausible result, and the complaint sounds like a bug in an unrelated feature", "It only fails under load", "It's usually in third-party code"],
        a: 1, why: "Nothing errors. Someone reports that a setting they configured was ignored, and the code path they'd suspect looks correct — because for their account it is." },
      { q: "Fleet-wide scheduled work at a fixed time causes what, and when?",
        opts: ["Clock drift", "Simultaneous load at the central service — harmless at small scale, self-inflicted outage at large", "Timezone bugs", "Duplicate execution"],
        a: 1, why: "Every install independently doing the polite thing at the same moment produces a thundering herd. Jitter costs one line and is always postponed." },
    ],
    defend: [
      { q: "Search a system you own for the shapes in this module. What did you find, and what breaks with a second user?",
        model: "Grep for index-zero access on user or account collections, for default identifiers, and for anything scheduled at an exact time. Then, for each, describe the customer's complaint rather than the code defect — that's the version you'd have to answer in support, and it's usually much harder to connect back to the cause." },
    ],
  },
  {
    id: "tests", n: "16", part: 2,
    title: "Tests that mean something",
    sub: "A large green suite is not evidence",
    concept: [
      "Test count measures effort, not coverage of risk. A suite can be large, fast and green while leaving every genuinely dangerous path unexercised — because the easy things to test and the important things to test are different sets.",
      "Two specific failures are worth being able to name. Order dependence: a test that passes alone and fails in the full run, or vice versa, indicates shared state leaking between tests. The immediate cost is a flaky result; the real cost is that people learn to ignore failures, at which point the suite has negative value.",
      "Testing the wrong seam: a test that patches a necessary-but-insufficient condition. The mock makes the code take the intended branch, but production has additional requirements the test bypassed. It passes, and it verifies nothing about the real path. When such a test fails, the instinct is to call it rot — and occasionally it's the only thing pointing at a real defect.",
      "Then there's the question of what's untested. Two independent implementations of the same protocol, one on each side of a boundary, hand-mirrored: nothing exercises a real request crossing between them, so drift only surfaces in production. Deployment scripts — the single path all code takes to reach a user — often have one test or none. Ask what breaks first, then check whether anything covers it.",
    ],
    caseTitle: "Twenty failures, nineteen dismissed",
    case: [
      "A suite collected two thousand two hundred and fifty-seven tests: 2236 passed, 20 failed, one skipped. Most of the failures passed in isolation and failed in the full run — event loop pollution from earlier tests. Order-dependent results, which the audit noted is how people stop trusting a suite.",
      "One failure was different. It patched a helper the rule appeared to depend on, but the rule actually gated on a second function requiring a configured user in the database. The test patched a necessary-but-insufficient seam, so it failed — and the reason it failed was a genuine single-user defect elsewhere in the system. A test doing its job badly and still being right.",
      "The gaps were structural rather than numerical. No end-to-end tests at all. Twelve test files for an entire frontend. Nothing exercising a signed request crossing between two hand-mirrored implementations of the same signing scheme. One shell test for a seven-hundred-line deployment script that is the only path code takes to a customer. And two files providing a live feature were untracked in version control, meaning that feature had never been through a release.",
    ],
    check: [
      { q: "A test passes alone and fails in the suite. What does that indicate, and why does it matter beyond the one test?",
        opts: ["A slow machine; increase the timeout", "Shared state leaking between tests — and people start ignoring failures, which costs more than the bug", "A missing dependency", "An outdated snapshot"],
        a: 1, why: "Order dependence makes results unreliable. Once a team routinely dismisses red as noise, the suite stops functioning as a signal at all." },
      { q: "Why is a boundary between two hand-mirrored implementations a high-risk untested area?",
        opts: ["It's hard to write tests for", "Each side is tested in isolation, so drift between them only appears in production", "It involves networking", "It changes frequently"],
        a: 1, why: "Both suites pass while the two definitions diverge. Only a real request crossing the boundary would catch it." },
    ],
    defend: [
      { q: "For a system you own: what would break first under real use, and what test covers it? If none, why not?",
        model: "The good version names a specific path, a specific failure, and either the test that guards it or an honest 'nothing does'. The usual answer is that the risky paths are the awkward ones to test — deployment, cross-boundary contracts, concurrency — and the suite grew where testing was easy. Knowing that about your own suite is the deliverable." },
    ],
  },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Serif:ital,wght@0,400;0,500;1,400&display=swap');
.df-root {
  --paper:#E4E8EA; --card:#F3F6F7; --ink:#0F2029; --soft:#4B6673;
  --rule:#C0CCD2; --teal:#0B6E6E; --flag:#B4155C;
  background:var(--paper); color:var(--ink);
  font-family:'IBM Plex Serif',Georgia,serif; min-height:100vh;
}
.df-root *{box-sizing:border-box;}
.df-mono{font-family:'IBM Plex Mono',monospace;}
.df-cond{font-family:'IBM Plex Sans Condensed',sans-serif;}
.df-btn{font-family:'IBM Plex Sans Condensed',sans-serif;font-weight:600;
  letter-spacing:.02em;transition:all .15s;cursor:pointer;}
.df-btn:focus-visible{outline:2px solid var(--teal);outline-offset:2px;}
.df-opt:hover{background:#E8EDEF;}
.df-ta{font-family:'IBM Plex Serif',serif;background:#FBFCFC;
  border:1px solid var(--rule);color:var(--ink);}
.df-ta:focus{outline:none;border-color:var(--teal);}
.df-tick{background:repeating-linear-gradient(90deg,var(--rule) 0 1px,transparent 1px 7px);}
@media (prefers-reduced-motion:reduce){.df-btn{transition:none;}}
`;

const KEY = "defensible:v1";
const PARTS = {
  1: { name: "Foundations", note: "Properties any system you ship should hold." },
  2: { name: "Model-driven systems", note: "What changes when a probabilistic component is in the loop." },
};

export default function App() {
  const [state, setState] = useState(null);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("concept");
  const [picks, setPicks] = useState({});
  const [drafts, setDrafts] = useState({});
  const [revealed, setRevealed] = useState({});
  const [miss, setMiss] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(KEY);
        setState(r ? JSON.parse(r.value) : { ledger: [] });
      } catch {
        setState({ ledger: [] });
      }
    })();
  }, []);

  const persist = async (next) => {
    setState(next);
    setSaving(true);
    try { await window.storage.set(KEY, JSON.stringify(next)); }
    catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!state) {
    return (
      <div className="df-root">
        <style>{CSS}</style>
        <div className="df-mono p-8 text-sm" style={{ color: "#4B6673" }}>Loading your ledger…</div>
      </div>
    );
  }

  const done = (id) => state.ledger.some((e) => e.id === id);
  const mod = active ? MODULES.find((m) => m.id === active) : null;

  const openModule = (id) => {
    setActive(id); setTab("concept"); setPicks({});
    setRevealed({}); setMiss(""); setDrafts({});
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const logIt = async () => {
    if (!miss.trim()) return;
    const entry = {
      id: mod.id, title: mod.title,
      date: new Date().toISOString().slice(0, 10),
      miss: miss.trim(),
      answers: mod.defend.map((d, i) => drafts[i] || ""),
    };
    await persist({ ...state, ledger: [...state.ledger.filter((e) => e.id !== mod.id), entry] });
    setActive(null);
  };

  const nextUp = MODULES.find((m) => !done(m.id));

  const row = (m) => {
    const d = done(m.id);
    const entry = state.ledger.find((e) => e.id === m.id);
    return (
      <li key={m.id}>
        <button
          onClick={() => openModule(m.id)}
          className="df-btn df-opt w-full text-left px-4 py-4 flex gap-4 items-baseline"
          style={{ background: d ? "transparent" : "var(--card)", borderTop: "1px solid var(--rule)", fontFamily: "inherit" }}
        >
          <span className="df-mono text-sm" style={{ color: d ? "var(--teal)" : "var(--rule)", minWidth: "1.8rem" }}>
            {d ? "✓" : m.n}
          </span>
          <span className="flex-1">
            <span className="df-cond block" style={{ fontSize: "1.15rem", fontWeight: 600 }}>{m.title}</span>
            <span className="block text-sm" style={{ color: "var(--soft)" }}>{entry ? entry.miss : m.sub}</span>
          </span>
          {entry && <span className="df-mono text-xs" style={{ color: "var(--soft)" }}>{entry.date}</span>}
        </button>
      </li>
    );
  };

  return (
    <div className="df-root">
      <style>{CSS}</style>

      <header className="px-5 sm:px-10 pt-9 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="df-mono text-xs tracking-widest uppercase" style={{ color: "var(--teal)" }}>a working curriculum</p>
            <h1 className="df-cond leading-none mt-1" style={{ fontSize: "clamp(2.4rem,7vw,4rem)", fontWeight: 700, letterSpacing: "-.02em" }}>
              Defensible
            </h1>
            <p className="mt-2 max-w-xl" style={{ color: "var(--soft)", fontSize: "1.02rem", lineHeight: 1.55 }}>
              Sixteen things you should be able to defend about systems you shipped.
              Read, answer, get it wrong, write down what you missed.
            </p>
          </div>
          <div className="text-right">
            <p className="df-mono text-xs uppercase tracking-widest" style={{ color: "var(--soft)" }}>Defended</p>
            <p className="df-cond" style={{ fontSize: "3rem", lineHeight: 1, fontWeight: 700, color: "var(--teal)" }}>
              {state.ledger.length}
              <span style={{ color: "var(--rule)", fontSize: "1.6rem" }}>/{MODULES.length}</span>
            </p>
          </div>
        </div>
        <div className="df-tick mt-6" style={{ height: 8, borderTop: "1px solid var(--rule)" }} />
      </header>

      <main className="px-5 sm:px-10 pb-20">
        {!mod && (
          <div>
            {nextUp && (
              <div className="mb-9 p-5 sm:p-6" style={{ background: "var(--card)", border: "1px solid var(--rule)" }}>
                <p className="df-mono text-xs uppercase tracking-widest" style={{ color: "var(--flag)" }}>Next session</p>
                <h2 className="df-cond mt-1" style={{ fontSize: "1.7rem", fontWeight: 700 }}>{nextUp.n} · {nextUp.title}</h2>
                <p style={{ color: "var(--soft)", marginTop: ".25rem" }}>{nextUp.sub}</p>
                <button onClick={() => openModule(nextUp.id)} className="df-btn mt-4 px-5 py-2.5 text-sm"
                  style={{ background: "var(--ink)", color: "var(--card)", border: "none" }}>Start</button>
              </div>
            )}

            {[1, 2].map((p) => (
              <section key={p} className="mb-10">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="df-mono text-xs" style={{ color: "var(--flag)" }}>PART {p}</span>
                  <h2 className="df-cond" style={{ fontSize: "1.35rem", fontWeight: 700 }}>{PARTS[p].name}</h2>
                </div>
                <p className="text-sm mb-3" style={{ color: "var(--soft)" }}>{PARTS[p].note}</p>
                <ol className="space-y-px">{MODULES.filter((m) => m.part === p).map(row)}</ol>
              </section>
            ))}

            {state.ledger.length > 0 && (
              <div className="mt-12">
                <h3 className="df-cond" style={{ fontSize: "1.3rem", fontWeight: 700 }}>What you got wrong</h3>
                <p className="text-sm mb-4" style={{ color: "var(--soft)" }}>The useful half of the record.</p>
                {state.ledger.map((e) => (
                  <div key={e.id} className="py-3" style={{ borderTop: "1px solid var(--rule)" }}>
                    <p className="df-mono text-xs" style={{ color: "var(--soft)" }}>{e.date} · {e.title}</p>
                    <p style={{ marginTop: ".2rem" }}>{e.miss}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mod && (
          <article>
            <button onClick={() => setActive(null)} className="df-btn df-mono text-xs mb-5 px-3 py-1.5"
              style={{ background: "transparent", border: "1px solid var(--rule)", color: "var(--soft)" }}>
              ← All modules
            </button>

            <p className="df-mono text-xs tracking-widest" style={{ color: "var(--flag)" }}>MODULE {mod.n}</p>
            <h2 className="df-cond" style={{ fontSize: "clamp(1.9rem,5vw,2.8rem)", fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.05 }}>
              {mod.title}
            </h2>
            <p style={{ color: "var(--soft)", fontSize: "1.05rem", fontStyle: "italic" }}>{mod.sub}</p>

            <nav className="flex flex-wrap gap-px mt-6 mb-7">
              {[["concept", "Concept"], ["case", "Case"], ["check", "Check"], ["defend", "Defend"]].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className="df-btn px-4 py-2 text-sm"
                  style={{ background: tab === k ? "var(--ink)" : "var(--card)", color: tab === k ? "var(--card)" : "var(--soft)", border: "1px solid var(--rule)" }}>
                  {label}
                </button>
              ))}
            </nav>

            <div style={{ maxWidth: "42rem" }}>
              {tab === "concept" && mod.concept.map((p, i) => (
                <p key={i} style={{ fontSize: "1.08rem", lineHeight: 1.72, marginBottom: "1.1rem" }}>{p}</p>
              ))}

              {tab === "case" && (
                <div style={{ background: "var(--card)", borderLeft: "3px solid var(--flag)", padding: "1.4rem" }}>
                  <p className="df-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--flag)" }}>From a real audit</p>
                  <h3 className="df-cond mb-3" style={{ fontSize: "1.35rem", fontWeight: 700 }}>{mod.caseTitle}</h3>
                  {mod.case.map((p, i) => (
                    <p key={i} style={{ fontSize: "1.03rem", lineHeight: 1.68, marginBottom: ".9rem" }}>{p}</p>
                  ))}
                </div>
              )}

              {tab === "check" && (
                <div className="space-y-8">
                  {mod.check.map((q, qi) => {
                    const picked = picks[qi];
                    return (
                      <div key={qi}>
                        <p style={{ fontSize: "1.08rem", lineHeight: 1.6, marginBottom: ".8rem" }}>{q.q}</p>
                        <div className="space-y-px">
                          {q.opts.map((o, oi) => {
                            const isPicked = picked === oi;
                            const isRight = oi === q.a;
                            let bg = "var(--card)", col = "var(--ink)";
                            if (picked !== undefined) {
                              if (isRight) { bg = "#DFF0EC"; col = "var(--teal)"; }
                              else if (isPicked) { bg = "#F7E1EA"; col = "var(--flag)"; }
                            }
                            return (
                              <button key={oi} disabled={picked !== undefined}
                                onClick={() => setPicks({ ...picks, [qi]: oi })}
                                className="df-btn df-opt w-full text-left px-4 py-3"
                                style={{ background: bg, color: col, border: "1px solid var(--rule)", fontFamily: "inherit", fontWeight: 400 }}>
                                {o}
                              </button>
                            );
                          })}
                        </div>
                        {picked !== undefined && (
                          <p className="mt-3 text-sm" style={{ color: "var(--soft)", lineHeight: 1.6 }}>{q.why}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "defend" && (
                <div className="space-y-9">
                  <p className="df-mono text-xs" style={{ color: "var(--soft)", lineHeight: 1.7 }}>
                    Write your answer before revealing. Reading a good answer teaches nothing;
                    discovering the gap between yours and it does.
                  </p>
                  {mod.defend.map((d, di) => (
                    <div key={di}>
                      <p style={{ fontSize: "1.08rem", lineHeight: 1.6, marginBottom: ".7rem", fontWeight: 500 }}>{d.q}</p>
                      <textarea value={drafts[di] || ""} onChange={(e) => setDrafts({ ...drafts, [di]: e.target.value })}
                        rows={5} placeholder="Your answer…" className="df-ta w-full p-3"
                        style={{ fontSize: "1rem", lineHeight: 1.6, resize: "vertical" }} />
                      {!revealed[di] ? (
                        <button onClick={() => setRevealed({ ...revealed, [di]: true })}
                          disabled={!(drafts[di] || "").trim()} className="df-btn mt-2 px-4 py-2 text-sm"
                          style={{ background: (drafts[di] || "").trim() ? "var(--teal)" : "var(--rule)", color: "#fff", border: "none",
                            cursor: (drafts[di] || "").trim() ? "pointer" : "not-allowed" }}>
                          Compare
                        </button>
                      ) : (
                        <div className="mt-3 p-4" style={{ background: "var(--card)", borderLeft: "3px solid var(--teal)" }}>
                          <p className="df-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--teal)" }}>A strong answer</p>
                          <p style={{ fontSize: "1.01rem", lineHeight: 1.68 }}>{d.model}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pt-6" style={{ borderTop: "1px solid var(--rule)" }}>
                    <h3 className="df-cond" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Log the session</h3>
                    <p className="text-sm mb-3" style={{ color: "var(--soft)", lineHeight: 1.6 }}>
                      One sentence: what did you get wrong, or what did you not know until now?
                      This is the only part worth re-reading later.
                    </p>
                    <textarea value={miss} onChange={(e) => setMiss(e.target.value)} rows={3}
                      placeholder="I assumed…" className="df-ta w-full p-3"
                      style={{ fontSize: "1rem", lineHeight: 1.6, resize: "vertical" }} />
                    <button onClick={logIt} disabled={!miss.trim() || saving} className="df-btn mt-3 px-5 py-2.5 text-sm"
                      style={{ background: miss.trim() ? "var(--ink)" : "var(--rule)", color: "var(--card)", border: "none",
                        cursor: miss.trim() ? "pointer" : "not-allowed" }}>
                      {saving ? "Saving…" : "Mark defended"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
