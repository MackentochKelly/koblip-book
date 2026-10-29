import type en from "../en/shell"

const shell: typeof en = {
  nav: {
    home: "Inicio",
    owner: "Propietario",
    bookings: "Reservas",
    customers: "Clientes",
    services: "Servicios",
    team: "Equipo",
    hours: "Horario",
    integrations: "Integraciones",
    settings: "Ajustes",
    assistant: "Asistente",
    details: "Datos",
  },
  groups: {
    bookings: "Reservas",
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
  // /dashboard before the first business.
  start: {
    welcome: (name: string) => `Hola, ${name}`,
    title: "Encuentra tu negocio",
    hint: "Elígelo en Google Maps para crear tu página de reservas.",
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
