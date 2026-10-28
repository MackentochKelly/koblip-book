import type en from "./en"

const messages: typeof en = {
  title: "Asistente",
  back: "Atrás",
  views: {
    label: "Vistas del asistente",
    chat: "Chat",
    recent: "Recientes",
  },
  recent: {
    empty: "Aún no hay chats",
    failed: "No se pudieron cargar tus chats",
    openFailed: "No se pudo abrir ese chat.",
  },
  newChat: "Nuevo chat",
  working: "Pensando…",
  retry: "Reintentar",
  // The one line that folds the assistant's steps.
  work: {
    done: (count: number) =>
      count === 1 ? "Revisé 1 cosa" : `Revisé ${count} cosas`,
  },
  sources: {
    bookings: (n: number) =>
      n === 1 ? "Basado en 1 reserva" : `Basado en ${n} reservas`,
    services: (n: number) =>
      n === 1 ? "Basado en 1 servicio" : `Basado en ${n} servicios`,
    team: (n: number) =>
      n === 1 ? "Basado en 1 profesional" : `Basado en ${n} profesionales`,
    customers: (n: number) =>
      n === 1 ? "Basado en 1 cliente" : `Basado en ${n} clientes`,
  },
  unverified: "Sin comprobar. Revísalo, por favor.",
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
