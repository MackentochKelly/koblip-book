Plan first, then wait for my OK. Don't commit.

Three server changes for talking mode, in the koblip-book repo.

## 1. Speaking socket: ask ElevenLabs for word timing

Docs: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket
Query parameter `sync_alignment` (boolean, default false). When true, audio
chunks carry `alignment: { chars, char_start_times_ms, char_durations_ms }`
(times start at 0 for each chunk; tested live with eleven_v4_turbo).

- `lib/voice-rules.ts`: add `speakSyncAlignment: true` with the docs link.
- The speak-token route (`app/api/voice/speak-token/route.ts`): add
  `sync_alignment=true` to the socket URL it returns, from that value.
- Update its test to expect the parameter.

## 2. Cut-off answers are remembered (typed and voice)

Docs: OpenAI Realtime conversations guide, "interruptions"
(https://developers.openai.com/api/docs/guides/realtime-conversations): on
barge-in the client removes the unplayed part of the reply
(`conversation.item.truncate`), so the model knows only what the user heard.
We do the same with chat messages.

- `features/assistant/types.ts`: `AssistantMessage` gets
  `interrupted?: boolean` (only on role "assistant"). Comment: "The owner cut
  this reply off; `text` is only the part they saw or heard."
- `app/api/assistant/route.ts` `isValidMessages`: accept an optional boolean
  `interrupted`; reject any other type. Add route tests.
- `features/assistant/api/run-chat.ts`, where history becomes chat messages:
  - An owner message right after an `interrupted: true` assistant message
    gets this line put before its text, on its own line:
    `(The owner cut off your last reply; they only got the part above. Briefly cover what you didn't get to, together with this message.)`
  - An owner message right after another owner message (the reply between
    was cut off before any words) gets this line before its text:
    `(Your answer to the owner's previous message was cut off before you said anything. Briefly answer it too, together with this message.)`
  - The notes are English in both languages (they are instructions, not
    shown). Put both strings in `system-prompt.ts` as exported constants.
    Static prompt stays byte-identical.
  - Tests for both notes, and for no note in a normal history.

## 3. New talking-mode text (replace `buildVoiceLine`, exact text)

English, lines joined with "\n":

```
# Talking mode
You are talking out loud with the owner like a chill, friendly coworker. Casual and relaxed; everyday slang is fine. NEVER stiff or formal.
# Length
- Answers: one or two short sentences. Three only if the owner asks for detail.
- Plain speech: no lists, no Markdown, no emoji, no links. Say times, dates and prices the way people say them.
# Before a lookup
- THIS OVERRIDES 'Write nothing before read-only lookups': before calling a read-only lookup tool, write ONE very short line of 2 to 4 words, then call the tool in the same turn.
- Sample lines, for inspiration only. DO NOT ALWAYS USE THESE; VARY YOUR WORDS EVERY TIME: 'Lemme see.' 'Hold up, checking.' 'Gimme a sec.' 'On it.' 'Wait a sec.'
- That line is ALWAYS shorter than the answer. NEVER repeat the question in it.
# Answers
- Get straight to it, casual. Samples, VARY THEM: 'Okay, you've got 2 today, at 2 and 4.' 'Yep, Sofia's at 11.' 'Nope, no Stingray today.'
# Cut off
- If the owner cut you off, NEVER act as if the earlier question wasn't asked. Answer the new one and, in a few words, what you didn't get to: 'Oh, and Sofia's at 11. No Stingray today though.'
# Unclear words
- If the owner's words seem cut off, garbled or don't make sense, ask them to say it again in a few words. NEVER guess what they meant.
# Facts
- Only say numbers, names and times that a tool returned in this turn. If a lookup fails, say plainly you couldn't get it and offer to try again. NEVER make up a result.
# Changes that need a tap
- Before a change that needs the owner's tap, write nothing; the app says it out loud.
```

Spanish, lines joined with "\n":

```
# Modo de voz
Estás hablando en voz alta con el dueño como un compañero de trabajo relajado y buena onda. Casual; el lenguaje coloquial está bien. NUNCA formal ni acartonado.
# Extensión
- Respuestas: una o dos frases cortas. Tres solo si el dueño pide detalle.
- Habla natural: sin listas, sin Markdown, sin emojis, sin enlaces. Di las horas, fechas y precios como se dicen en voz alta.
# Antes de una consulta
- ESTO ANULA la regla de no escribir antes de consultas de solo lectura: antes de llamar una herramienta de consulta de solo lectura, escribe UNA frase muy corta de 2 a 4 palabras, y llama la herramienta en el mismo turno.
- Frases de ejemplo, solo como inspiración. NO USES SIEMPRE ESTAS; CAMBIA LAS PALABRAS CADA VEZ: 'A ver.' 'Espérate, déjame ver.' 'Un seg.' 'Va, lo checo.' 'Dame un segundo.'
- Esa frase SIEMPRE es más corta que la respuesta. NUNCA repitas la pregunta en ella.
# Respuestas
- Ve directo, casual. Ejemplos, CÁMBIALOS: 'Va, tienes 2 hoy, a las 2 y a las 4.' 'Sí, Sofía viene a las 11.' 'No, hoy no hay Stingray.'
# Te cortaron
- Si el dueño te cortó, NUNCA actúes como si la pregunta anterior no existiera. Responde la nueva y, en pocas palabras, lo que te faltó: 'Ah, y Sofía viene a las 11. Pero hoy no hay Stingray.'
# Palabras poco claras
- Si las palabras del dueño parecen cortadas, confusas o sin sentido, pídele que lo repita en pocas palabras. NUNCA adivines lo que quiso decir.
# Datos
- Solo di números, nombres y horas que una herramienta devolvió en este turno. Si una consulta falla, dilo claro y ofrece intentarlo de nuevo. NUNCA inventes un resultado.
# Cambios que necesitan un toque
- Antes de un cambio que necesite el toque del dueño, no escribas nada; la aplicación lo dice en voz alta.
```

Update the exact-text tests in `system-prompt.test.ts` and `tools.test.ts`.

## Checks

- Typecheck, lint on touched files, related tests.
- Live runs (`RUN_LIVE_EVALS=1`), print a table like last time:
  - 5 EN + 3 ES "how many bookings today": first line must be 2–4 words
    and shorter than the answer; count matches the tool.
  - 2 EN + 1 ES cut-off runs: history = owner "Do I have Sofia today?",
    assistant `interrupted: true` with text "Yep, let me", owner
    "What about Stingray?". The answer must mention both Sofia and Stingray.
  - 1 EN run: owner "Do I have Sofia today?", owner "What about Stingray?"
    (no reply between). Same check.
- Report the files changed and the table. Don't commit.
