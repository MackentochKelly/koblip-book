import type en from "../en/integrations"

const integrations: typeof en = {
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
    connected: "Conectado",
    disconnect: "Desconectar",
    disconnected: "Koblip Chat desconectado.",
    key: (last4: string) => `Clave que termina en ${last4}`,
  },
  connect: {
    title: "Conectar Koblip Chat",
    apiKey: "Clave API de Koblip Chat",
    apiKeyHint: "La encuentras en Koblip Chat.",
    apiKeyMissing: "Escribe tu clave API.",
    workspaceId: "ID del espacio de trabajo",
    workspaceIdHint: "Lo encuentras en Koblip Chat.",
    workspaceIdMissing: "Escribe el ID de tu espacio de trabajo.",
    submit: "Conectar",
    errors: {
      invalid_key: "Esa clave no funciona. Revísala e inténtalo de nuevo.",
      wrong_workspace: "Ese ID de espacio de trabajo no corresponde a la clave.",
      no_permission: "Esta clave no puede iniciar mensajes. Usa una con acceso completo.",
      unreachable: "No se pudo contactar a Koblip Chat. Inténtalo de nuevo.",
    },
  },
}

export default integrations
