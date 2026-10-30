import type { PageLanguage } from "@/lib/page-language"

// The admin area's words. Spanish is typed against English, so a missing
// word fails the typecheck.
const en = {
  locale: "en-US",
  admin: "Admin",
  groups: { app: "App" },
  nav: {
    overview: "Overview",
    businesses: "Businesses",
    owners: "Owners",
    bookings: "Bookings",
  },
  overview: {
    businesses: "Businesses",
    owners: "Owners",
    bookings: "Bookings",
    newOwners: "New owners this week",
  },
  businesses: {
    none: "No businesses yet",
    noOwner: "No owner",
    bookings: (n: number) => (n === 1 ? "1 booking" : `${n} bookings`),
    open: (name: string) => `Open ${name}'s page`,
  },
  owners: {
    none: "No owners yet",
    you: "You",
    admin: "Admin",
    blocked: "Blocked",
    businesses: (n: number) => (n === 1 ? "1 business" : `${n} businesses`),
    block: "Block",
    unblock: "Unblock",
    blockTitle: (name: string) => `Block ${name}?`,
    blockText: "They are signed out and can't log in until unblocked.",
    cancel: "Cancel",
    blockedToast: "Blocked",
    unblockedToast: "Unblocked",
    failed: "That did not work. Please try again.",
  },
  bookings: {
    none: "No bookings yet",
    status: {
      confirmed: "Confirmed",
      completed: "Completed",
      no_show: "No-show",
      cancelled: "Cancelled",
    } as Record<string, string>,
  },
  koblipChat: {
    title: "Koblip WhatsApp number",
    notConnected: "Not connected. Businesses without their own number can't send.",
    connected: (workspace: string) => `Connected to ${workspace}`,
    reconnectNeeded: (workspace: string) => `${workspace}: connect again to keep sending`,
    connect: "Connect",
    reconnect: "Connect again",
    disconnect: "Disconnect",
    disconnectTitle: "Disconnect Koblip's number?",
    disconnectText: "Businesses without their own number stop sending WhatsApp messages.",
    cancel: "Cancel",
    connectedToast: "Connected",
    disconnectedToast: "Disconnected",
    failed: "That did not work. Please try again.",
  },
  error: {
    title: "Something went wrong",
    description: "Try again in a few minutes.",
    retry: "Try again",
  },
}

export type AdminMessages = typeof en

const es: AdminMessages = {
  locale: "es-US",
  admin: "Admin",
  groups: { app: "App" },
  nav: {
    overview: "Resumen",
    businesses: "Negocios",
    owners: "Dueños",
    bookings: "Reservas",
  },
  overview: {
    businesses: "Negocios",
    owners: "Dueños",
    bookings: "Reservas",
    newOwners: "Dueños nuevos esta semana",
  },
  businesses: {
    none: "Aún no hay negocios",
    noOwner: "Sin dueño",
    bookings: (n: number) => (n === 1 ? "1 reserva" : `${n} reservas`),
    open: (name: string) => `Abrir la página de ${name}`,
  },
  owners: {
    none: "Aún no hay dueños",
    you: "Tú",
    admin: "Admin",
    blocked: "Bloqueado",
    businesses: (n: number) => (n === 1 ? "1 negocio" : `${n} negocios`),
    block: "Bloquear",
    unblock: "Desbloquear",
    blockTitle: (name: string) => `¿Bloquear a ${name}?`,
    blockText: "Se cierra su sesión y no puede entrar hasta que lo desbloquees.",
    cancel: "Cancelar",
    blockedToast: "Bloqueado",
    unblockedToast: "Desbloqueado",
    failed: "No funcionó. Inténtalo de nuevo.",
  },
  bookings: {
    none: "Aún no hay reservas",
    status: {
      confirmed: "Confirmada",
      completed: "Completada",
      no_show: "No vino",
      cancelled: "Cancelada",
    },
  },
  koblipChat: {
    title: "Número de WhatsApp de Koblip",
    notConnected: "Sin conectar. Los negocios sin número propio no pueden enviar.",
    connected: (workspace: string) => `Conectado a ${workspace}`,
    reconnectNeeded: (workspace: string) => `${workspace}: vuelve a conectar para seguir enviando`,
    connect: "Conectar",
    reconnect: "Volver a conectar",
    disconnect: "Desconectar",
    disconnectTitle: "¿Desconectar el número de Koblip?",
    disconnectText: "Los negocios sin número propio dejan de enviar mensajes de WhatsApp.",
    cancel: "Cancelar",
    connectedToast: "Conectado",
    disconnectedToast: "Desconectado",
    failed: "No funcionó. Inténtalo de nuevo.",
  },
  error: {
    title: "Algo salió mal",
    description: "Inténtalo de nuevo en unos minutos.",
    retry: "Intentar de nuevo",
  },
}

const MESSAGES: Record<PageLanguage, AdminMessages> = { en, es }

export function adminMessagesFor(language: PageLanguage): AdminMessages {
  return MESSAGES[language]
}
