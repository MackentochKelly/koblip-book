import type { PageLanguage } from "@/lib/page-language"
import type { BookingMessage } from "@/types/whatsapp"

// The bell's words (docs/plans/in-app-notifications.md, N4 and N7), in the
// owner area's language. On screen they are "Updates" ("Novedades"), so they
// never clash with the business's Notifications page (N-D12). Spanish is
// typed against English, so a missing word fails the typecheck.
const en = {
  locale: "en-US",
  bell: "Updates",
  bellUnread: (n: number) =>
    n === 1 ? "Updates, 1 unread" : `Updates, ${n} unread`,
  title: "Updates",
  markAll: "Mark all as read",
  settings: "Updates settings",
  today: "Today",
  earlier: "Earlier",
  unread: "Unread",
  more: "Show more",
  empty: "You're all caught up",
  failed: "Couldn't load updates.",
  retry: "Try again",
  someone: "A customer",
  // Each kind's title, from its facts.
  kinds: {
    newBooking: (who: string) => `New booking: ${who}`,
    customerCancelled: (who: string) => `${who} cancelled`,
    customerConfirmed: (who: string) => `${who} will be there`,
    customerCantCome: (who: string) => `${who} can't make it`,
    customerReplied: (who: string) => `${who} wrote on WhatsApp`,
    messageFailed: (who: string) => `A message to ${who} didn't go`,
    templateApproved: (message: string) => `Meta approved ${message}`,
    templateRejected: (message: string) => `Meta rejected ${message}`,
    koblipLimitNear: (sent: string, limit: string) =>
      `${sent} of ${limit} messages used this month`,
    koblipLimitReached: "Monthly message limit reached",
    connectionRenew: "Connect Koblip Chat again",
  },
  // The same names as the WhatsApp page.
  messages: {
    confirmed: "Booking confirmed",
    reminder: "Reminder",
    changed: "Booking changed",
    cancelled: "Booking cancelled",
    ownerNewBooking: "New booking alert",
    ownerCantCome: "Customer can't come alert",
    ownerCancelled: "Customer cancelled alert",
    ownerFailed: "Message failed alert",
  } satisfies Record<BookingMessage, string>,
  aMessage: "a message",
  // The owner's choices screen (N7).
  choices: {
    title: "Updates",
    groups: { bookings: "Bookings", whatsapp: "WhatsApp" },
    names: {
      newBooking: "New bookings",
      customerCancelled: "Customer cancelled",
      customerConfirmed: "Customer will be there",
      customerCantCome: "Customer can't make it",
      customerReplied: "Customer wrote",
      messageFailed: "Message didn't go",
      templateApproved: "Meta approved a message",
      templateRejected: "Meta rejected a message",
      koblipLimitNear: "Monthly limit almost used",
      koblipLimitReached: "Monthly limit reached",
      connectionRenew: "Connection to renew",
    },
    open: "Choose which updates you get",
    failed: "Couldn't save. Try again.",
  },
}

export type NotificationMessages = typeof en

const es: NotificationMessages = {
  locale: "es-US",
  bell: "Novedades",
  bellUnread: (n: number) =>
    n === 1 ? "Novedades, 1 sin leer" : `Novedades, ${n} sin leer`,
  title: "Novedades",
  markAll: "Marcar todo como leído",
  settings: "Ajustes de novedades",
  today: "Hoy",
  earlier: "Antes",
  unread: "Sin leer",
  more: "Ver más",
  empty: "Estás al día",
  failed: "No se pudieron cargar las novedades.",
  retry: "Intentar de nuevo",
  someone: "Un cliente",
  kinds: {
    newBooking: (who: string) => `Nueva reserva: ${who}`,
    customerCancelled: (who: string) => `${who} canceló`,
    customerConfirmed: (who: string) => `${who} confirmó que irá`,
    customerCantCome: (who: string) => `${who} no podrá ir`,
    customerReplied: (who: string) => `${who} escribió por WhatsApp`,
    messageFailed: (who: string) => `No salió un mensaje a ${who}`,
    templateApproved: (message: string) => `Meta aprobó ${message}`,
    templateRejected: (message: string) => `Meta rechazó ${message}`,
    koblipLimitNear: (sent: string, limit: string) =>
      `${sent} de ${limit} mensajes usados este mes`,
    koblipLimitReached: "Se alcanzó el límite mensual de mensajes",
    connectionRenew: "Vuelve a conectar Koblip Chat",
  },
  messages: {
    confirmed: "Reserva confirmada",
    reminder: "Recordatorio",
    changed: "Reserva cambiada",
    cancelled: "Reserva cancelada",
    ownerNewBooking: "Aviso de nueva reserva",
    ownerCantCome: "Aviso de cliente que no puede venir",
    ownerCancelled: "Aviso de cliente que canceló",
    ownerFailed: "Aviso de mensaje no enviado",
  },
  aMessage: "un mensaje",
  choices: {
    title: "Novedades",
    groups: { bookings: "Reservas", whatsapp: "WhatsApp" },
    names: {
      newBooking: "Nuevas reservas",
      customerCancelled: "El cliente canceló",
      customerConfirmed: "El cliente confirmó",
      customerCantCome: "El cliente no podrá ir",
      customerReplied: "El cliente escribió",
      messageFailed: "Un mensaje no salió",
      templateApproved: "Meta aprobó un mensaje",
      templateRejected: "Meta rechazó un mensaje",
      koblipLimitNear: "Límite mensual casi usado",
      koblipLimitReached: "Límite mensual alcanzado",
      connectionRenew: "Conexión por renovar",
    },
    open: "Elige qué novedades recibes",
    failed: "No se pudo guardar. Inténtalo de nuevo.",
  },
}

const MESSAGES: Record<PageLanguage, NotificationMessages> = { en, es }

export function notificationMessagesFor(
  language: PageLanguage
): NotificationMessages {
  return MESSAGES[language]
}
