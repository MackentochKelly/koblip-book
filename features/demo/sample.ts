import type { HoursRow } from "@/lib/hours-rules"

// The home page demo's sample business: a made-up studio, full enough to
// try everything (services, team, hours, a week of bookings) the moment a
// copy opens. The same names as the home page pictures (Lumen Studio, Ana,
// Marta…). Bookings are placed relative to the copy's own today, so the
// calendar is always busy around now.
export const DEMO_SAMPLE = {
  name: "Lumen Studio",
  slugPrefix: "lumen-demo",
  description:
    "A bright studio in the heart of Madrid for hair, colour, nails and skin care. Book online any time.",
  category: "Beauty studio",
  address: "Calle Mayor 12, 28013 Madrid, Spain",
  timezone: "Europe/Madrid",
  currency: "EUR",
  seats: 3,
  // The studio's photos, in order (the first is the cover): free Unsplash
  // photos (unsplash.com/license, no credit needed), all from one salon
  // shoot by unsplash.com/@unsplashbydan so they read as one business,
  // cropped to 4:3 and saved in public/demo/lumen. Their ids (each at
  // unsplash.com/photos/<id>): PnDr2j28gXA, KMvUcGanzPc, iTliv_qGUgc,
  // Ui6DZ9A1eXU, 7b6TE7yBDyc, iOQ0VZN-apo, Ql0hvzr4wVM, 1pnLnKoO1Y0,
  // W2IZ8ZA4w7I, 0MrQ5RvqI6I, ENXUyhgWGlU.
  photos: Array.from(
    { length: 11 },
    (_, index) => `/demo/lumen/${String(index + 1).padStart(2, "0")}.jpg`
  ),
  // weekday: 0 = Sunday, as on business_hours. Closed on Sundays.
  hours: [
    { weekday: 1, opensAt: "09:00", closesAt: "19:00" },
    { weekday: 2, opensAt: "09:00", closesAt: "19:00" },
    { weekday: 3, opensAt: "09:00", closesAt: "19:00" },
    { weekday: 4, opensAt: "09:00", closesAt: "19:00" },
    { weekday: 5, opensAt: "09:00", closesAt: "19:00" },
    { weekday: 6, opensAt: "10:00", closesAt: "16:00" },
  ],
  // Its service categories, in order. Not `category` above, which is the
  // studio's own type.
  serviceCategories: ["Hair", "Nails", "Face & brows"],
  // `category`: an index into serviceCategories above.
  services: [
    {
      name: "Haircut",
      description: "Wash, cut and style.",
      category: 0,
      durationMinutes: 45,
      priceMinor: 2500,
    },
    {
      name: "Colour",
      description: "All-over colour with a gloss finish.",
      category: 0,
      durationMinutes: 90,
      priceMinor: 6000,
    },
    {
      name: "Blow-dry",
      description: "Wash and a smooth blow-dry.",
      category: 0,
      durationMinutes: 30,
      priceMinor: 2000,
    },
    {
      name: "Manicure",
      description: "Shape, cuticle care and polish.",
      category: 1,
      durationMinutes: 40,
      priceMinor: 1800,
    },
    {
      name: "Facial",
      description: "Deep clean and hydration for every skin type.",
      category: 2,
      durationMinutes: 60,
      priceMinor: 4500,
    },
    {
      name: "Brows",
      description: "Shape and tidy.",
      category: 2,
      durationMinutes: 20,
      priceMinor: 1200,
    },
  ],
  // Extras offered after picking a service. `services`: indexes into
  // services above.
  extras: [
    {
      name: "Hair extras",
      prompt: "Add something to your visit?",
      services: [0, 1, 2],
      options: [
        {
          name: "Deep conditioning",
          description: "A rich mask for soft, shiny hair.",
          durationMinutes: 15,
          priceMinor: 1200,
        },
        {
          name: "Scalp massage",
          description: "Ten relaxing minutes at the basin.",
          durationMinutes: 10,
          priceMinor: 800,
        },
        {
          name: "Gloss toner",
          description: "Refreshes tone and adds shine.",
          durationMinutes: 15,
          priceMinor: 1500,
        },
      ],
    },
    {
      name: "Care extras",
      prompt: "Treat yourself a little more?",
      services: [3, 4, 5],
      options: [
        {
          name: "Nail art",
          description: "Simple designs on two nails.",
          durationMinutes: 15,
          priceMinor: 1000,
        },
        {
          name: "Eye mask",
          description: "Cooling mask for tired eyes.",
          durationMinutes: 10,
          priceMinor: 900,
        },
      ],
    },
  ],
  // `services`: indexes into services above. Photos: portraits made for
  // the demo with Muse Image, saved in public/demo/lumen.
  team: [
    {
      name: "Marta Gil",
      description: "Cuts and colour",
      photoUrl: "/demo/lumen/team-01.webp",
      services: [0, 1, 2],
      hours: [] as HoursRow[],
    },
    {
      name: "Sofía León",
      description: "Nails, facials and brows",
      photoUrl: "/demo/lumen/team-02.webp",
      services: [3, 4, 5],
      hours: [] as HoursRow[],
    },
    {
      name: "Luis Romero",
      description: "Cuts and blow-dry",
      photoUrl: "/demo/lumen/team-03.webp",
      services: [0, 2],
      hours: [] as HoursRow[],
    },
  ],
  customers: [
    "Ana Morales",
    "Pablo Ruiz",
    "Laura Sanz",
    "Diego Navarro",
    "Elena Ortiz",
    "Javier Molina",
    "Carmen Vidal",
    "Lucía Herrera",
    "Hugo Castro",
    "Irene Prieto",
  ],
  // `day`: days from the copy's today (business time zone); a booking that
  // lands on a closed day (Sunday) is skipped. `service`, `member`,
  // `customer`: indexes above. No two overlap for one team member.
  bookings: [
    { day: -3, time: "10:00", service: 1, member: 0, customer: 2 },
    { day: -3, time: "12:00", service: 3, member: 1, customer: 4 },
    { day: -2, time: "09:30", service: 0, member: 2, customer: 1 },
    { day: -2, time: "16:00", service: 4, member: 1, customer: 6 },
    { day: -1, time: "11:00", service: 0, member: 0, customer: 0 },
    { day: -1, time: "13:00", service: 5, member: 1, customer: 7 },
    { day: 0, time: "10:00", service: 0, member: 0, customer: 3 },
    { day: 0, time: "11:30", service: 2, member: 2, customer: 5 },
    { day: 0, time: "16:30", service: 4, member: 1, customer: 4 },
    { day: 1, time: "09:00", service: 1, member: 0, customer: 8 },
    { day: 1, time: "12:30", service: 3, member: 1, customer: 9 },
    { day: 2, time: "10:30", service: 0, member: 2, customer: 4 },
    { day: 2, time: "17:00", service: 2, member: 0, customer: 2 },
    { day: 3, time: "11:00", service: 5, member: 1, customer: 1 },
    { day: 4, time: "14:00", service: 1, member: 0, customer: 6 },
  ],
} as const
