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
    mic: "Dictar",
    stop: "Detener",
    micDenied: "Permite el micrófono para hablar.",
    voiceIntro: {
      title: "Habla con tu asistente",
      speak:
        "Habla con naturalidad. Te responde en voz alta y lo escribe todo en el chat.",
      tap: "Los cambios siguen necesitando un toque en la pantalla.",
      privacy: "Tu voz se convierte en texto. No guardamos la grabación.",
      continue: "Continuar",
      neverShow: "No mostrar de nuevo",
    },
    live: {
      start: "Hablar en vivo",
      connecting: "Conectando…",
      listening: "Escuchando…",
      thinking: "Pensando…",
      talking: "Hablando…",
      mute: "Silenciar",
      unmute: "Activar micrófono",
      end: "Terminar",
      confirmLine: "Para hacerlo, toca el botón en la pantalla.",
    },
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
