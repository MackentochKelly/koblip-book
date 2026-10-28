import type en from "./server-en"

// The server's own lines in Spanish, typed against English so a missing
// word fails the typecheck. Database names are never translated.
const messages: typeof en = {
  locale: "es-US",
  languageLine: "Responde en español.",
  steps: {
    overview: "Viendo el negocio…",
    services: "Listando servicios…",
    team: "Listando el equipo…",
    bookings: "Buscando reservas…",
    customer: "Buscando cliente…",
    createService: "Creando servicio…",
    updateService: "Actualizando servicio…",
    deleteService: "Eliminando servicio…",
    renameMember: "Renombrando miembro…",
    setBookingStatus: "Actualizando reserva…",
    cancelBooking: "Cancelando reserva…",
    deleteMember: "Eliminando miembro…",
    hours: "Actualizando horario…",
    freeTimes: "Buscando huecos…",
    booking: "Reservando…",
    working: "Trabajando…",
    checking: "Revisando la respuesta…",
  },
  loop: {
    invalidArgs: "esos argumentos no eran válidos, pide lo que falte",
    lookupFailed: "esa búsqueda falló, pregúntalo de otra forma",
    tooMany: "demasiadas confirmaciones pendientes, responde una primero",
    stopped: (maxSteps: number) =>
      `Me quedé sin pasos después de ${maxSteps} búsquedas — pídeme algo más concreto.`,
    unverified: "No pude comprobar esta respuesta, revísala por favor.",
  },
  confirm: {
    unchanged: "Vale, no se cambió nada.",
    unavailable: "Esa acción ya no está disponible.",
  },
  tapFirst: {
    cancel: "cancelar necesita tu toque primero",
    deleteService: "eliminar necesita tu toque primero",
    deleteMember: "eliminar necesita tu toque primero",
    hours: "cambiar el horario necesita tu toque primero",
    booking: "reservar necesita tu toque primero",
    updateService: "cambiar necesita tu toque primero",
  },
  cards: {
    cancel: "¿Cancelar esta reserva?",
    deleteService: "¿Eliminar este servicio?",
    deleteMember: "¿Eliminar a este miembro?",
    hours: "¿Cambiar el horario?",
    book: "¿Reservar esta cita?",
    updateService: "¿Cambiar este servicio?",
  },
  actions: {
    cancelBooking: "Cancelar reserva",
    deleteService: "Eliminar",
    deleteMember: "Eliminar",
    hours: "Cambiar horario",
    book: "Reservar",
    updateService: "Cambiar",
  },
  booking: {
    minutes: (durationMinutes: number) => `${durationMinutes} min`,
    anyone: "Cualquiera",
    noPrice: "Sin precio",
    free: "Gratis",
    closedWeek: "Cerrado toda la semana",
    at: (day: string, time: string) => `${day} a las ${time}`,
    booked: (name: string, service: string, when: string) =>
      `Cita reservada para ${name}: ${service}, el ${when}.`,
    couldNotBook: (reason: string) => `No se pudo reservar: ${reason}.`,
    conflictClosed: "el negocio está cerrado a esa hora",
    conflictTaken: "ese hueco se acaba de ocupar",
    fields: {
      service: "servicio desconocido",
      teamMember: "miembro desconocido",
      date: "fecha inválida",
      time: "hora inválida",
      name: "nombre de cliente inválido",
      phone: "número de teléfono inválido",
      note: "nota demasiado larga",
      addons: "complementos inválidos",
    },
    invalidFallback: "entrada inválida",
    failed: "No se pudo reservar: algo salió mal.",
  },
  cancel: {
    unknown: "No se pudo cancelar: reserva desconocida.",
    failed: (error: string) => `No se pudo cancelar la reserva (${error}).`,
    done: "Reserva cancelada.",
  },
  deleteService: {
    unknown: "No se pudo eliminar: servicio desconocido.",
    failed: (error: string) => `No se pudo eliminar el servicio (${error}).`,
    done: "Servicio eliminado.",
  },
  updateService: {
    unknown: "No se pudo cambiar: servicio desconocido.",
    failed: (error: string) => `No se pudo cambiar el servicio (${error}).`,
    done: "Servicio cambiado.",
    nothing: "No hay nada que cambiar.",
  },
  deleteMember: {
    unknown: "No se pudo eliminar: miembro desconocido.",
    failed: (error: string) => `No se pudo eliminar al miembro (${error}).`,
    done: "Miembro eliminado.",
  },
  hours: {
    invalid: "No se pudo guardar: horario inválido.",
    failed: (error: string) => `No se pudo guardar el horario (${error}).`,
    done: "Horario actualizado.",
  },
  errors: {
    serviceIdRequired:
      "serviceId es obligatorio: lista los servicios primero y usa un id de la lista",
    serviceUnknown:
      "id de servicio desconocido: lista los servicios primero y usa un id de la lista",
    memberIdRequired:
      "memberId es obligatorio: lista el equipo primero y usa un id de la lista",
    memberUnknown:
      "id de miembro desconocido: lista el equipo primero y usa un id de la lista",
    teamMemberInvalid: "teamMemberId debe ser un id de list_team u omitirse",
    dateInvalid: "date debe ser una fecha real YYYY-MM-DD",
    timeInvalid: "time debe ser HH:mm",
    nameRequired: "el nombre del cliente es obligatorio",
    phoneInvalid: "número de teléfono inválido",
    noteInvalid: "nota inválida",
    noteTooLong: "nota demasiado larga",
    datePast: "date está en el pasado: reserva hoy o después",
    rangeInvalid: "range debe ser upcoming o past",
    dayInvalid: (key: string) => `${key} debe ser YYYY-MM-DD`,
    statusUnknown: "estado desconocido",
    queryInvalid: "query debe tener 1-80 caracteres",
    nameInvalid: "name debe tener 1-80 caracteres",
    minutesInvalid: (options: string) => `minutes debe ser uno de ${options}`,
    priceInvalid: "priceMinor debe ser null o un entero dentro del rango",
    descriptionInvalid: "description debe tener como máximo 300 caracteres",
    bookingIdRequired:
      "bookingId es obligatorio: lista las reservas primero y usa un id de la lista",
    bookingUnknown:
      "id de reserva desconocido: lista las reservas primero y usa un id de la lista",
    statusInvalid:
      "status debe ser confirmed, completed o no_show (cancelar necesita un toque)",
    rowsInvalid:
      "rows debe tener como máximo 14 filas de weekday 0-6 con open y close HH:mm",
    freeTimesUnknown:
      "servicio o miembro desconocido: lístalos primero y usa un id de la lista",
    fromInvalid: "from debe ser una fecha real YYYY-MM-DD, hoy o después",
    toInvalid: "to debe ser una fecha real YYYY-MM-DD igual o posterior a from",
    spanInvalid: "pide como máximo 14 días a la vez",
  },
}

export default messages
