import type { PageLanguage } from "@/lib/page-language"

// A team member's own area and their invite link
// (docs/plans/team-accounts.md), in their language.
const en = {
  menu: "Menu",
  nav: {
    bookings: "Bookings",
    hours: "Hours",
    profile: "Profile",
  },
  bookings: {
    upcoming: "Upcoming",
    past: "Past",
    emptyUpcoming: "No upcoming bookings",
    emptyPast: "No past bookings yet",
    status: {
      confirmed: "",
      completed: "Done",
      no_show: "No-show",
      cancelled: "Cancelled",
    } as Record<string, string>,
  },
  hours: {
    closed: "Closed",
    // One short helper line under the title.
    note: "The owner sets your hours.",
  },
  profile: {
    jobTitle: "Job title",
    about: "About",
    languages: "Languages",
    noLanguage: "No language found",
    optional: "Optional",
    save: "Save",
    saved: "Saved",
    failed: "Couldn't save. Try again.",
    seePublic: "See my public profile",
    logOut: "Log out",
    photo: (name: string) => `${name}'s photo`,
  },
  photos: {
    change: "Change",
    addPhoto: "Add photo",
    remove: "Remove",
    errors: {
      not_found: "That did not work. Please try again.",
      missing: "Pick a photo.",
      too_big: "That photo is too big.",
      wrong_type: "Use a JPEG, PNG or WebP photo.",
      limit: "That's too many photos.",
    },
  },
  join: {
    title: (business: string) => `Join ${business}`,
    intro: (name: string) => `Your bookings, hours and profile as ${name}.`,
    join: "Join",
    logIn: "Log in to join",
    signedInAs: (email: string) => `Signed in as ${email}`,
    expired: {
      title: "This link doesn't work anymore",
      text: "Ask for a new link.",
    },
    taken: "Someone already joined as this person. Ask for a new link.",
    alreadyMember: "This account already has a place in this business.",
    failed: "Couldn't join. Try again.",
  },
}

export type TeamAreaWords = typeof en

const es: TeamAreaWords = {
  menu: "Menú",
  nav: {
    bookings: "Reservas",
    hours: "Horario",
    profile: "Perfil",
  },
  bookings: {
    upcoming: "Próximas",
    past: "Pasadas",
    emptyUpcoming: "No hay reservas próximas",
    emptyPast: "Aún no hay reservas pasadas",
    status: {
      confirmed: "",
      completed: "Hecha",
      no_show: "No vino",
      cancelled: "Cancelada",
    },
  },
  hours: {
    closed: "Cerrado",
    note: "El dueño fija tu horario.",
  },
  profile: {
    jobTitle: "Cargo",
    about: "Sobre mí",
    languages: "Idiomas",
    noLanguage: "No se encontró el idioma",
    optional: "Opcional",
    save: "Guardar",
    saved: "Guardado",
    failed: "No se pudo guardar. Inténtalo de nuevo.",
    seePublic: "Ver mi perfil público",
    logOut: "Cerrar sesión",
    photo: (name: string) => `Foto de ${name}`,
  },
  photos: {
    change: "Cambiar",
    addPhoto: "Añadir foto",
    remove: "Quitar",
    errors: {
      not_found: "No funcionó. Inténtalo de nuevo.",
      missing: "Elige una foto.",
      too_big: "Esa foto es demasiado grande.",
      wrong_type: "Usa una foto JPEG, PNG o WebP.",
      limit: "Son demasiadas fotos.",
    },
  },
  join: {
    title: (business: string) => `Únete a ${business}`,
    intro: (name: string) => `Tus reservas, tu horario y tu perfil como ${name}.`,
    join: "Unirme",
    logIn: "Inicia sesión para unirte",
    signedInAs: (email: string) => `Sesión iniciada como ${email}`,
    expired: {
      title: "Este enlace ya no funciona",
      text: "Pide un enlace nuevo.",
    },
    taken: "Alguien ya se unió como esta persona. Pide un enlace nuevo.",
    alreadyMember: "Esta cuenta ya tiene un lugar en este negocio.",
    failed: "No se pudo unir. Inténtalo de nuevo.",
  },
}

export function teamAreaWordsFor(language: PageLanguage): TeamAreaWords {
  return language === "es" ? es : en
}
