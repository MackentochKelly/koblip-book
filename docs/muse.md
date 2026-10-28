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
