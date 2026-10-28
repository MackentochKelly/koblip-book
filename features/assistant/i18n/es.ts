import type en from "./en"

const messages: typeof en = {
  title: "Asistente",
  back: "Atrás",
  newChat: "Nuevo chat",
  working: "Pensando…",
  retry: "Reintentar",
  // The one line that folds the assistant's steps.
  work: {
    done: (count: number) =>
      count === 1 ? "Revisé 1 cosa" : `Revisé ${count} cosas`,
  },
  // Under each answer.
  actions: {
    copy: "Copiar",
    retry: "Reintentar",
  },
  empty: {
    title: "¿En qué te ayudo hoy?",
    // One tap sends the words as they are.
    suggestions: {
      today: "¿Qué hay para hoy?",
      free: "¿Quién está libre mañana?",
      book: "Reservar a un cliente",
      services: "Ver mis servicios",
    },
  },
  composer: {
    placeholder: "Pregunta o dime qué hacer",
    label: "Mensaje",
    send: "Enviar",
    mic: "Hablar",
    stop: "Detener",
    micDenied: "Permite el micrófono para hablar.",
  },
  confirm: {
    // Closes the card; the other button says the action itself.
    cancel: "Ahora no",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
  },
  errors: {
    rate_limited: "Demasiados mensajes. Espera un momento.",
    unavailable: "El asistente no está disponible. Inténtalo de nuevo.",
    too_long: "Ese mensaje es demasiado largo.",
    not_allowed: "No puedo hacer eso aquí.",
    expired: "Esa solicitud caducó. Pídelo de nuevo.",
    empty_audio: "No oí nada. Inténtalo de nuevo.",
    bad_request: "Esa grabación no funcionó. Inténtalo de nuevo.",
  },
}

export default messages
