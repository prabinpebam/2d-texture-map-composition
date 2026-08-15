# Agent Graphs, Loops, and Definitions of Done

## Purpose

Agentic systems should be designed around a clearly defined hierarchy of **outcomes, definitions of done, feedback loops, and orchestration**.

An agent graph is not inherently useful simply because it contains nodes, edges, branching, or loops. These mechanisms become useful only when the agent has a sufficiently precise understanding of **what it is trying to accomplish and what constitutes successful completion**.

The fundamental principle is:

> **A loop can only close if there is a clearly defined condition for closure.**

Without a defined outcome and definition of done, an agent can execute actions indefinitely without knowing whether meaningful progress has been made.

---

## 1. Define the Outcome Before Defining the Graph

Every agentic workflow must begin with a clearly articulated outcome.

The system should be able to answer:

* What are we trying to accomplish?
* What does successful completion look like?
* How will we determine that the outcome has been achieved?
* What evidence is required to consider the outcome complete?
* What constraints must be satisfied?
* What conditions would indicate that the current approach is failing?

The outcome should be expressed in terms of **results**, rather than merely activities.

### Weak goal

> Research the competitors.

### Stronger goal

> Produce a competitive analysis covering the five identified competitors, comparing their positioning, core capabilities, pricing, strengths, weaknesses, and relevant opportunities for our product.

The second goal gives the agent something it can evaluate.

---

# 2. Definition of Done Is the Control Mechanism

A **Definition of Done (DoD)** is the criteria that determines whether an outcome has actually been achieved.

It should be:

* Specific enough to evaluate
* Observable or verifiable
* Relevant to the intended outcome
* Complete enough to prevent premature closure
* Clear enough that an agent can use it as a decision criterion

The definition of done effectively becomes the **control signal for the loop**.

```text
        ┌──────────────┐
        │   Execute    │
        └──────┬───────┘
               ↓
        ┌──────────────┐
        │   Evaluate   │
        └──────┬───────┘
               ↓
        ┌──────────────┐
        │    DONE?     │
        └───┬──────┬───┘
          YES       NO
           ↓         │
        Continue     │
        upward       │
                     ↓
                  Iterate
                     │
                     └──────→ Execute
```

The evaluation step must therefore answer a concrete question:

> **"Given the current state of the work, has the definition of done been satisfied?"**

---

# 3. Goals Must Exist at Multiple Levels

Complex agentic work is hierarchical.

A project-level outcome is usually too broad to directly guide every individual action. Conversely, a low-level action is usually too narrow to determine whether the overall project is succeeding.

Therefore, goals and definitions of done must exist at **multiple levels of granularity**.

### Project level

Defines the ultimate outcome.

> What does successful completion of the entire project look like?

### Major task / workstream level

Defines the outcomes necessary to achieve the project outcome.

> What must each major workstream accomplish?

### Task level

Defines the outcome of a specific piece of work.

> What must this task produce?

### Step level

Defines the outcome of an individual operation.

> What must this step accomplish before moving forward?

### Action level

Defines the immediate result of an agent action.

> What evidence tells us this particular action succeeded?

This creates a hierarchy:

```text
PROJECT OUTCOME
│
├── MAJOR OUTCOME
│   │
│   ├── TASK
│   │   ├── STEP
│   │   │   └── ACTION
│   │   └── STEP
│   │
│   └── TASK
│
└── MAJOR OUTCOME
    ├── TASK
    └── TASK
```

Each level should have its own definition of done.

---

# 4. Each Level Has Its Own Loop

The hierarchy of outcomes naturally creates a hierarchy of loops.

### Small loops

Small loops close individual steps.

```text
Attempt → Evaluate → Correct → Re-evaluate → Done
```

Example:

> Generate an API request → validate response → fix malformed request → validate again → request succeeds.

### Medium loops

Medium loops close tasks composed of multiple steps.

```text
Execute task
    ↓
Evaluate task outcome
    ↓
Are all task criteria satisfied?
    ├── Yes → Close task
    └── No  → Reopen relevant steps
```

### Large loops

Large loops close major workstreams.

```text
Complete workstream
       ↓
Evaluate workstream outcome
       ↓
Does it satisfy its objectives?
   ┌───┴───┐
  YES      NO
   ↓        ↓
 Close    Rework
            ↓
       Lower-level loops
```

### Project-level loop

The highest-level loop evaluates whether the entire project outcome has been achieved.

```text
Project Progress
      ↓
Evaluate Overall Outcome
      ↓
Project Definition of Done?
   ┌───┴────┐
  YES       NO
   ↓         ↓
 COMPLETE   Identify
            unresolved
            outcomes
                ↓
          Reopen appropriate
          lower-level loops
```

---

# 5. Agent Graphs Orchestrate the Loops

The **graph is the orchestration mechanism** that coordinates these different levels of loops.

It determines:

* Which task should execute next
* Which node should receive the current state
* Which evaluation should occur
* Whether a loop should continue
* Whether a loop can close
* Whether a failed outcome requires local correction
* Whether failure at a higher level requires reopening lower-level work
* When a completed lower-level outcome enables a higher-level outcome
* When the overall project can be considered complete

The graph therefore should not be thought of simply as:

> **Node A → Node B → Node C**

Instead, it should be thought of as:

> **A system for coordinating nested feedback loops around a hierarchy of outcomes.**

---

# 6. Successful Small Loops Must Contribute to Larger Loops

Closing a lower-level loop does not automatically mean that the higher-level objective has been achieved.

For example:

```text
Step A = Done
Step B = Done
Step C = Done
```

does not necessarily mean:

```text
Task = Done
```

Likewise:

```text
Task A = Done
Task B = Done
Task C = Done
```

does not necessarily mean:

```text
Project = Done
```

The higher-level evaluator must determine whether the **combined result** satisfies the higher-level definition of done.

This distinction is critical.

> **Local completion is not the same as global completion.**

An agent can successfully complete every individual action and still fail to accomplish the intended project outcome.

---

# 7. Higher-Level Loops Should Be Able to Reopen Lower-Level Loops

A mature agent graph should allow failures discovered at a higher level to propagate back down into the appropriate lower-level loop.

For example:

```text
                    PROJECT
                       │
                 Evaluate Outcome
                       │
                  ┌────┴────┐
                PASS       FAIL
                 │           │
              COMPLETE       ↓
                       Identify Cause
                             │
                 ┌───────────┼───────────┐
                 ↓           ↓           ↓
              Task A      Task B      Task C
                 │           │           │
              Rework       Rework       Done
                 │
                 ↓
            Re-evaluate
              Project
```

This allows the system to operate recursively.

A project-level failure does not necessarily mean "start over."

Instead, the agent should determine:

> **Which lower-level outcome is preventing the higher-level definition of done from being satisfied?**

Then it can reopen the smallest appropriate loop.

---

# 8. The Graph Should Prefer the Smallest Necessary Loop

When something fails, the agent should avoid restarting work unnecessarily.

If a single action failed:

> Re-run the action loop.

If a step's outcome is invalid:

> Reopen the step loop.

If a task's overall result is inadequate:

> Reopen the task loop.

If an entire workstream is inconsistent:

> Reopen the workstream loop.

If the project outcome itself has changed or been invalidated:

> Re-enter the project-level loop.

This creates an important principle:

> **Use the smallest loop capable of resolving the failure.**

This reduces unnecessary work, preserves useful state, and makes the system more efficient.

---

# 9. Evaluation Nodes Are First-Class Components

In an agent graph, execution nodes and evaluation nodes should be treated differently.

An execution node answers:

> **"What should I do?"**

An evaluation node answers:

> **"Did what I did actually achieve the intended outcome?"**

A robust graph therefore frequently follows:

```text
PLAN
  ↓
EXECUTE
  ↓
OBSERVE
  ↓
EVALUATE
  ↓
DECIDE
```

The decision determines whether to:

* Continue
* Iterate
* Correct
* Branch
* Escalate
* Move to the next task
* Close the current loop
* Close a higher-level loop

Without evaluation, loops become repetition rather than meaningful iteration.

---

# 10. Avoid Activity-Based Definitions of Done

Definitions of done should describe **outcomes**, not merely actions.

### Weak

> Research completed.

### Better

> Research contains evidence from the required sources and answers all defined research questions.

### Weak

> Code written.

### Better

> Implementation satisfies the defined requirements, passes the required tests, and produces the expected behavior.

### Weak

> Design completed.

### Better

> Design addresses all defined user scenarios, satisfies the specified constraints, and passes the agreed evaluation criteria.

The agent must be able to distinguish:

```text
"I performed the activity."
```

from:

```text
"The intended outcome was achieved."
```

---

# 11. The Agent Needs an Explicit Outcome Model

For meaningful autonomy, the agent's state should contain enough information to understand:

* **Goal** — What are we trying to accomplish?
* **Current state** — Where are we now?
* **Success criteria** — What constitutes success?
* **Evidence** — What evidence do we currently have?
* **Gap** — What remains unsatisfied?
* **Next action** — What should happen next?
* **Loop level** — Which level of the hierarchy are we currently operating at?
* **Exit condition** — What allows this loop to close?

Conceptually:

```text
Outcome
├── Goal
├── Definition of Done
├── Current State
├── Evidence
├── Outstanding Gaps
├── Next Action
├── Evaluation
└── Exit Condition
```

---

# 12. Agent Graphs Are Outcome-Oriented, Not Action-Oriented

The graph should not merely encode:

```text
Do A → Do B → Do C → Done
```

It should encode something closer to:

```text
Achieve Outcome A
      ↓
Verify Outcome A
      ↓
Achieve Outcome B
      ↓
Verify Outcome B
      ↓
Consolidate
      ↓
Evaluate Larger Outcome
      ↓
    Done?
   /     \
 YES      NO
         ↓
   Identify gap
         ↓
   Reopen relevant
      sub-loop
```

This distinction is fundamental to agentic systems.

A workflow describes **what happens**.

An agent graph additionally describes **how the system knows whether what happened was sufficient**.

---

# 13. Overall Principle

The complete model is:

```text
                    PROJECT OUTCOME
                          │
                  Definition of Done
                          │
                    Project Loop
                          │
             ┌────────────┴────────────┐
             │                         │
       Major Outcome A           Major Outcome B
             │                         │
        Task Loops                 Task Loops
             │                         │
        Step Loops                 Step Loops
             │                         │
       Action Loops               Action Loops
             │                         │
             └────────────┬────────────┘
                          │
                    Consolidation
                          │
                    Evaluation
                          │
                  Project Done?
                    /       \
                  YES        NO
                   │          │
                COMPLETE   Identify Gap
                              │
                         Reopen the
                       smallest relevant
                           loop
```

The fundamental relationship is:

> **Clearly defined outcome → definition of done → evaluation → bounded loop → graph orchestration → larger outcome.**

---

# 14. Design Rules

When building an agent graph:

1. **Define the overall outcome before designing the graph.**
2. **Define an explicit Definition of Done for the overall project.**
3. **Break the project outcome into meaningful intermediate outcomes.**
4. **Give every meaningful task its own Definition of Done.**
5. **Give important individual steps their own success criteria.**
6. **Create feedback loops around outcomes, not merely around actions.**
7. **Include explicit evaluation points in the graph.**
8. **Make loop exit conditions explicit.**
9. **Allow higher-level evaluations to reopen lower-level loops.**
10. **Prefer the smallest loop capable of resolving a failure.**
11. **Do not confuse activity completion with outcome completion.**
12. **Require evidence before closing important loops.**
13. **Ensure lower-level outcomes contribute directly to higher-level outcomes.**
14. **Continuously evaluate whether local progress is still aligned with the overall goal.**
15. **Treat the graph as an orchestration layer for nested loops, not merely as a sequence of actions.**

---

## Core Principle

> **Agentic systems are fundamentally systems for closing outcome-driven feedback loops.**
>
> **The graph provides the orchestration. The loops provide iteration and correction. The Definition of Done provides the criteria for closure. The hierarchy of outcomes connects small loops to larger loops, allowing the agent to progressively achieve the overall project outcome.**
>
> **Without a sufficiently precise outcome and Definition of Done, there is no reliable basis for knowing whether a loop should continue, stop, or escalate—and therefore no reliable basis for autonomous agent behavior.**
