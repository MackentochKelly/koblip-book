import type { PageLanguage } from "@/lib/page-language"

// The Privacy and Terms pages' words, in short plain sections. Spanish is
// typed against English, so a missing section fails the typecheck.
// The day the text last changed (shown at the top of each page).
export const LEGAL_UPDATED = new Date("2026-10-29T12:00:00Z")

const CONTACT = "contact@koblip.com"

const en = {
  updated: "Last updated",
  contact: CONTACT,
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        title: "What we collect",
        points: [
          "Your account: name, email and password (stored scrambled), or your Google profile if you sign in with Google.",
          "Your business: details from Google Maps, plus the services, team, hours and photos you add.",
          "Your clients: the name, phone, note and bookings they enter on your page.",
          "Assistant chats you type. Live voice audio is not kept.",
        ],
      },
      {
        title: "On your device",
        points: [
          "Only the cookies we need: your sign-in and your language. No ad or tracking cookies.",
          "Light or dark mode is saved on your device.",
          "Your location is used only if you allow it, to search near you, and is not stored.",
        ],
      },
      {
        title: "Who helps us",
        points: [
          "Google (Maps, Places and sign-in), Meta (AI assistant), ElevenLabs (voice) and our email provider. They get only what each task needs.",
          "We never sell your data and never show ads.",
        ],
      },
      {
        title: "How long we keep it",
        points: [
          "While your account is open.",
          "A business page that nobody claims is deleted after 24 hours.",
        ],
      },
      {
        title: "Your choices",
        points: [
          `You can ask to see, fix or delete your data at any time: write to ${CONTACT}.`,
          "Clients can ask the business, or us, to remove their details.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      {
        title: "Your account",
        points: [
          "Keep your sign-in safe. You are responsible for what happens in your account.",
          "Only claim a business you own or are allowed to manage.",
        ],
      },
      {
        title: "Your content",
        points: [
          "You are responsible for the details, photos and prices on your page.",
          "Do not post anything illegal, misleading or that you do not have the right to use.",
        ],
      },
      {
        title: "Bookings",
        points: [
          "A booking is an agreement between the business and its client. Koblip is not part of it.",
          "Businesses handle their own cancellations, payments and refunds.",
        ],
      },
      {
        title: "The assistant",
        points: [
          "AI answers can be wrong. Nothing changes until you confirm it with a tap.",
          "Details from Google Maps follow Google's own terms.",
        ],
      },
      {
        title: "Price",
        points: [
          "Koblip Book is free for now. We will tell you well before any charge starts.",
        ],
      },
      {
        title: "Ending and changes",
        points: [
          "You can close your account at any time. We may close accounts that break these terms.",
          "The service is provided as is, without promises that it will never fail.",
          "If these terms change, we will update the date above and let owners know.",
          `Questions: ${CONTACT}.`,
        ],
      },
    ],
  },
}

export type LegalWords = typeof en

const es: LegalWords = {
  updated: "Última actualización",
  contact: CONTACT,
  privacy: {
    title: "Política de privacidad",
    sections: [
      {
        title: "Qué recogemos",
        points: [
          "Tu cuenta: nombre, correo y contraseña (guardada cifrada), o tu perfil de Google si entras con Google.",
          "Tu negocio: datos de Google Maps, y los servicios, equipo, horario y fotos que añadas.",
          "Tus clientes: el nombre, teléfono, nota y reservas que escriben en tu página.",
          "Los chats que escribes al asistente. El audio de voz en vivo no se guarda.",
        ],
      },
      {
        title: "En tu dispositivo",
        points: [
          "Solo las cookies necesarias: tu sesión y tu idioma. Sin cookies de anuncios ni de rastreo.",
          "El modo claro u oscuro se guarda en tu dispositivo.",
          "Tu ubicación solo se usa si la permites, para buscar cerca de ti, y no se guarda.",
        ],
      },
      {
        title: "Quién nos ayuda",
        points: [
          "Google (Maps, Places e inicio de sesión), Meta (asistente de IA), ElevenLabs (voz) y nuestro proveedor de correo. Solo reciben lo que cada tarea necesita.",
          "Nunca vendemos tus datos y nunca mostramos anuncios.",
        ],
      },
      {
        title: "Cuánto tiempo lo guardamos",
        points: [
          "Mientras tu cuenta esté abierta.",
          "Una página de negocio que nadie reclama se borra a las 24 horas.",
        ],
      },
      {
        title: "Tus opciones",
        points: [
          `Puedes pedir ver, corregir o borrar tus datos cuando quieras: escribe a ${CONTACT}.`,
          "Los clientes pueden pedir al negocio, o a nosotros, que borren sus datos.",
        ],
      },
    ],
  },
  terms: {
    title: "Términos del servicio",
    sections: [
      {
        title: "Tu cuenta",
        points: [
          "Protege tu acceso. Eres responsable de lo que pase en tu cuenta.",
          "Reclama solo un negocio que sea tuyo o que puedas gestionar.",
        ],
      },
      {
        title: "Tu contenido",
        points: [
          "Eres responsable de los datos, fotos y precios de tu página.",
          "No publiques nada ilegal, engañoso o que no tengas derecho a usar.",
        ],
      },
      {
        title: "Reservas",
        points: [
          "Una reserva es un acuerdo entre el negocio y su cliente. Koblip no forma parte de él.",
          "Cada negocio gestiona sus cancelaciones, pagos y reembolsos.",
        ],
      },
      {
        title: "El asistente",
        points: [
          "Las respuestas de la IA pueden fallar. Nada cambia hasta que lo confirmas con un toque.",
          "Los datos de Google Maps siguen los términos de Google.",
        ],
      },
      {
        title: "Precio",
        points: [
          "Koblip Book es gratis por ahora. Te avisaremos con tiempo antes de cobrar nada.",
        ],
      },
      {
        title: "Cierre y cambios",
        points: [
          "Puedes cerrar tu cuenta cuando quieras. Podemos cerrar cuentas que incumplan estos términos.",
          "El servicio se ofrece tal cual, sin garantía de que nunca falle.",
          "Si estos términos cambian, actualizaremos la fecha de arriba y avisaremos a los dueños.",
          `Preguntas: ${CONTACT}.`,
        ],
      },
    ],
  },
}

export function legalWordsFor(language: PageLanguage): LegalWords {
  return language === "es" ? es : en
}
