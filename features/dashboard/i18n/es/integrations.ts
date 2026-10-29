import type en from "../en/integrations"

const integrations: typeof en = {
  messaging: "Mensajes",
  whatsapp: {
    name: "WhatsApp",
    description: "Recordatorios y difusiones",
    connect: "Conectar",
    connected: "Conectado",
  },
  connect: {
    title: "Conectar WhatsApp",
    apiKey: "Clave API de Koblip Chat",
    apiKeyHint: "La encuentras en Koblip Chat.",
    apiKeyMissing: "Escribe tu clave API.",
    submit: "Conectar",
  },
}

export default integrations
