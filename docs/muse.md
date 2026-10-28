# Muse notes

From the Meta hackathon live session "Agents 101: Build a Multimodal AI Agent
Pt. 1" (https://vimeo.com/1239550947/045ee6e57e). Workshop code:
https://github.com/meta-models/legal-agent-workshop. Part 2 covers
verification: the agent checking its own work.

## The API

- The Meta Model API works with the OpenAI SDK. Keep the SDK, point its base
  URL at Meta's API and use the Meta key. Rate limits are the key's own.

## Muse Code

- Meta's AI coding tool, signed in with the API key.
- The session used Muse Spark 1.3. `/model` switches models and `/effort`
  sets how hard it thinks.
- It works with custom MCP servers and skills.

## How an agent works

- Each turn: plan, act (one tool call), look at the result.
- Cap the number of turns. The session used 30, and the run took about 21.
- The system prompt sets behaviour, not the task.
- The agent keeps a checklist and notes, so you can see what it did.
- It finishes with a "submit" tool.

## Trust

- Answers are unverified until checked. Models can make things up, more so
  in niche areas.
- Be explicit in prompts and ask for the source behind each answer.
- Check before showing anything to a customer.

## Working tips

- Have the AI propose a plan before it writes code.
- To undo a wrong step, ask it to revert.
- The practice run cost about $7 of tokens.
- Help: Discord office hours.

# Part 2: checking the agent's work

From "Agents 102: Best Practices for Verifiable Agents Pt. 2"
(https://vimeo.com/1239918451), same workshop code.

## Where to check

- Check at the key steps, not every step. Each check makes the agent more
  accurate but slower: 20 turns without checks, 30 with them.
- Put the check inside the tool itself (for example inside "submit"), so the
  agent can't skip it. Don't offer checking as a tool the agent may or may
  not call.
- Check the smaller steps along the way too (like the plan or checklist), so
  mistakes are caught early.
- Only allow the tools on the list. If the agent asks for any other tool,
  refuse it.

## Two kinds of check

- **Fixed rules (code):** is it complete, in the right format (for example
  JSON), with nothing forbidden in it (for example no invented numbers).
- **AI judge:** a second AI call checks that each claim is true against the
  source.
- Use both.

## When it fails

- Send the failure reason back to the agent so it tries again. It gets
  better each time (in the session: 50% → 67% → 83% covered).
- Limit the retries (the session used 3), then hand it to a person.
- For important answers, a person signs off at the end.
- Pass marks are a setting (the session used 80%). Use 100% for money,
  health and legal; lower for low-risk tasks. Experts choose the number.
- Checks that later steps don't depend on can run afterwards, without making
  the user wait.

## Working tip

- Run two Muse Code sessions: one builds and one only reviews. The reviewer
  can't change anything.
