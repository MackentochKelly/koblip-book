import type en from "../en/integrations"

const integrations: typeof en = {
  messaging: "Mensajes",
  calendar: "Calendario",
  soon: "Próximamente",
  about: (name: string) => `Sobre ${name}`,
  whatsapp: {
    name: "WhatsApp",
    description:
      "WhatsApp Business oficial, directo de Meta. Envía recordatorios de reservas y difusiones desde el número de tu negocio.",
  },
  googleCalendar: {
    name: "Google Calendar",
    description:
      "Tus reservas en tu Google Calendar, al día con cada cambio.",
  },
  koblipChat: {
    name: "Koblip Chat",
    description:
      "Recordatorios y difusiones por WhatsApp con Koblip Chat, que tiene tu conexión oficial con Meta. Las respuestas llegan a tu bandeja de Koblip Chat.",
    connect: "Conectar",
    connected: "Conectado",
  },
  connect: {
    title: "Conectar Koblip Chat",
    apiKey: "Clave API de Koblip Chat",
    apiKeyHint: "La encuentras en Koblip Chat.",
    apiKeyMissing: "Escribe tu clave API.",
    submit: "Conectar",
  },
}

export default integrations
