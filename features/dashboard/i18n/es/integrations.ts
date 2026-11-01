import type en from "../en/integrations"

const integrations: typeof en = {
  tabs: {
    connected: "Conectadas",
    all: "Todas las apps",
    label: "Conectadas y todas las apps",
  },
  noneConnected: "Nada conectado todavía",
  suggested: "Sugeridas",
  seeAllApps: "Ver todas las apps",
  messaging: "Mensajes",
  calendar: "Calendario",
  payments: "Pagos",
  tracking: "Seguimiento",
  social: "Que te encuentren",
  reviews: "Reseñas",
  soon: "Próximamente",
  about: (name: string) => `Sobre ${name}`,
  whatsapp: {
    name: "WhatsApp",
    description:
      "WhatsApp Business oficial, directo de Meta. Envía recordatorios de reservas y difusiones desde el número de tu negocio.",
    manage: "Gestionar",
    useOwnNumber: "Usar tu propio número",
    disconnect: "Desconectar",
  },
  sms: {
    name: "SMS de Twilio",
    description:
      "Confirmaciones y recordatorios de reservas por mensaje de texto con Twilio, para clientes sin WhatsApp.",
  },
  email: {
    name: "Email",
    description:
      "Confirmaciones, recordatorios y cambios de reservas enviados a tus clientes por email.",
  },
  instagram: {
    name: "Instagram",
    description:
      "Un botón Reservar en tu perfil de Instagram, para que tus seguidores reserven en pocos toques.",
  },
  facebook: {
    name: "Facebook",
    description:
      "Un botón Reservar en tu página de Facebook, para que reserven sin salir.",
  },
  googleBusiness: {
    name: "Perfil de Empresa de Google",
    description:
      "Un botón Reservar en la Búsqueda y Maps de Google, donde te encuentran tus clientes.",
  },
  googleReviews: {
    name: "Reseñas de Google",
    description:
      "Después de cada visita, pide a tus clientes una reseña en Google para conseguir más reservas.",
  },
  googleCalendar: {
    name: "Google Calendar",
    description:
      "Tus reservas en tu Google Calendar, al día con cada cambio.",
    connect: "Conectar",
    disconnect: "Desconectar",
    disconnected: "Google Calendar desconectado.",
    account: (email: string) => `Conectado a ${email}`,
    reconnect: "Reconectar",
    reconnectHint: "La conexión se detuvo. Vuelve a conectar.",
    syncFailed: "No se pudo actualizar tu calendario. Lo intentamos de nuevo.",
    connectedToast: "Google Calendar conectado.",
    denied: "Permite el calendario de Koblip Book para conectar.",
    failed: "No se pudo conectar Google Calendar. Inténtalo de nuevo.",
    manage: "Gestionar",
    busyTitle: "Tus horas ocupadas bloquean",
    calendarsTitle: "Calendarios que bloquean reservas",
    mainCalendar: "Calendario principal",
    calendarsFailed: "No se pudieron cargar tus calendarios.",
    tryAgain: "Reintentar",
    busyWholeBusiness: "Tus horas ocupadas bloquean todo tu negocio.",
    busyNobody: "A nadie",
    busyNobodyHint: "No recibes reservas",
    saveFailed: "No se pudo guardar. Inténtalo de nuevo.",
    removeEvents: "Quitar también las reservas de Google Calendar",
    removeEventsFailed: "Desconectado. No se pudieron quitar las reservas de Google Calendar.",
    syncNow: "Sincronizar ahora",
    synced: (ago: string) => `Sincronizado ${ago}`,
    notSynced: "Aún sin sincronizar",
    syncNowFailed: "No se pudo sincronizar. Inténtalo de nuevo.",
  },
  appleCalendar: {
    name: "Apple Calendar",
    description:
      "Tus reservas en Apple Calendar en iPhone, iPad y Mac, siempre al día.",
  },
  outlook: {
    name: "Outlook Calendar",
    description:
      "Tus reservas en tu calendario de Outlook, al día con cada cambio.",
  },
  stripe: {
    name: "Stripe",
    description:
      "Cobra un depósito o el pago completo al reservar, para que menos clientes falten.",
  },
  metaPixel: {
    name: "Meta Pixel",
    description:
      "Mira qué anuncios de Facebook e Instagram te traen reservas.",
  },
  googleAnalytics: {
    name: "Google Analytics",
    description:
      "Mira quién visita tu página de reservas y cuántos reservan.",
  },
  koblipChat: {
    name: "Koblip Chat",
    description:
      "Recordatorios y difusiones por WhatsApp con Koblip Chat, que tiene tu conexión oficial con Meta. Las respuestas llegan a tu bandeja de Koblip Chat.",
    connect: "Conectar",
    manage: "Gestionar",
    disconnected: "Koblip Chat desconectado.",
    workspace: (name: string) => `Conectado a ${name}`,
    reconnect: "Reconectar",
    reconnectHint: "La conexión se detuvo. Vuelve a conectar.",
    connectedToast: "Koblip Chat conectado.",
    failed: "No se pudo conectar Koblip Chat. Inténtalo de nuevo.",
    messages: {
      noNumber: "Añade un número de WhatsApp en Koblip Chat para enviar mensajes.",
      settingUp: "Preparando tus mensajes de WhatsApp…",
      notSubmitted: "Tus mensajes de WhatsApp aún no se han enviado a Meta.",
      waiting: "Tus mensajes de WhatsApp esperan la aprobación de Meta.",
      rejected: "Meta no aprobó un mensaje de WhatsApp. Revísalo en Koblip Chat.",
    },
  },
}

export default integrations
