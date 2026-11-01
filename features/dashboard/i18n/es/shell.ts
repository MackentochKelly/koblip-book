import type en from "../en/shell"

const shell: typeof en = {
  nav: {
    home: "Inicio",
    dashboard: "Panel",
    analytics: "Estadísticas",
    owner: "Propietario",
    bookings: "Reservas",
    customers: "Clientes",
    services: "Servicios",
    team: "Equipo",
    hours: "Horario",
    automations: "Automatizaciones",
    widgets: "Widgets",
    integrations: "Integraciones",
    settings: "Ajustes",
    assistant: "Asistente",
    details: "Datos",
  },
  groups: {
    business: "Tu negocio",
    workspace: "Espacio de trabajo",
  },
  search: "Buscar",
  searchHint: "Buscar páginas y acciones",
  noResults: "Sin resultados",
  pages: "Páginas",
  menu: "Menú",
  viewPage: "Ver página",
  account: "Cuenta",
  appearance: "Apariencia",
  light: "Claro",
  dark: "Oscuro",
  device: "Dispositivo",
  language: "Idioma",
  signOut: "Cerrar sesión",
  greeting: {
    morning: (name?: string) => (name ? `Buenos días, ${name}` : "Buenos días"),
    afternoon: (name?: string) =>
      name ? `Buenas tardes, ${name}` : "Buenas tardes",
    evening: (name?: string) =>
      name ? `Buenas noches, ${name}` : "Buenas noches",
  },
  // /dashboard before the first business.
  start: {
    welcome: (name: string) => `Hola, ${name}`,
    title: "Encuentra tu negocio",
    hint: "Elígelo en Google Maps para crear tu página de reservas.",
  },
  // The menu's business switcher and the Add business page.
  businesses: {
    title: "Negocios",
    switch: "Cambiar de negocio",
    add: "Añadir negocio",
    addTitle: "Añade un negocio",
    addHint: "Encuéntralo en Google Maps para crear su página de reservas.",
    yours: "Tus negocios",
    back: "Volver",
  },
  titles: {
    checkDetails: "Revisa tus datos",
    live: "Ya estás en línea",
  },
  error: {
    title: "Algo salió mal",
    description: "Inténtalo de nuevo en unos minutos.",
    retry: "Intentar de nuevo",
  },
}

export default shell
