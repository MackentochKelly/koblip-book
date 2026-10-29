import type en from "../en/integrations"

const integrations: typeof en = {
  messaging: "Mensajes",
  whatsapp: {
    name: "WhatsApp",
    description: "WhatsApp Business oficial, de Meta",
    soon: "Próximamente",
  },
  koblipChat: {
    name: "Koblip Chat",
    description: "Recordatorios y difusiones por WhatsApp",
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
