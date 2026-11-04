import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type { PageLanguage } from "@/lib/page-language"

// The login form's words. The page passes its language: the owner area's on
// the login page, English on the home page.
const en = {
  logIn: "Log in",
  signUp: "Sign up",
  or: "or",
  email: "Email",
  useAnotherEmail: "Use another email",
  yourName: "Your name",
  choosePassword: "Choose a password",
  password: "Password",
  continue: "Continue",
  createAccount: "Create account",
  useEmail: "Continue with email",
  google: "Continue with Google",
  forgotPassword: "Forgot password?",
  resetSent: "Check your email for the link.",
  newPassword: "New password",
  savePassword: "Save password",
  passwordChanged: "Password changed.",
  linkExpired: "This link no longer works. Ask for a new one.",
  backToLogIn: "Back to log in",
  errors: {
    email: "Check your email address",
    name: "Add your name",
    password: `Use at least ${ONBOARDING_RULES.minPasswordLength} characters`,
    passwordTooLong: `Use no more than ${ONBOARDING_RULES.maxPasswordLength} characters`,
    invalidPassword: "Check your password",
    tooManyTries: "Too many tries. Wait a moment and try again.",
    connection: "Can't connect. Check your connection and try again.",
    failed: "Something went wrong. Try again.",
    existingAccount: "You have an account. Enter your password.",
    wrongPassword: "Wrong password",
  },
  googleErrors: {
    accountNotLinked:
      "You signed up with email and password. Log in that way below.",
    fallback: "Google sign-in didn't work. Try again.",
  },
}

export type AuthWords = typeof en

const es: AuthWords = {
  logIn: "Iniciar sesión",
  signUp: "Regístrate",
  or: "o",
  email: "Correo",
  useAnotherEmail: "Usar otro correo",
  yourName: "Tu nombre",
  choosePassword: "Elige una contraseña",
  password: "Contraseña",
  continue: "Continuar",
  createAccount: "Crear cuenta",
  useEmail: "Continuar con correo",
  google: "Continuar con Google",
  forgotPassword: "¿Olvidaste tu contraseña?",
  resetSent: "Revisa tu correo para ver el enlace.",
  newPassword: "Contraseña nueva",
  savePassword: "Guardar contraseña",
  passwordChanged: "Contraseña cambiada.",
  linkExpired: "Este enlace ya no funciona. Pide uno nuevo.",
  backToLogIn: "Volver a iniciar sesión",
  errors: {
    email: "Revisa tu correo",
    name: "Escribe tu nombre",
    password: `Usa al menos ${ONBOARDING_RULES.minPasswordLength} caracteres`,
    passwordTooLong: `Usa como máximo ${ONBOARDING_RULES.maxPasswordLength} caracteres`,
    invalidPassword: "Revisa tu contraseña",
    tooManyTries:
      "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    connection: "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.",
    failed: "Algo salió mal. Inténtalo de nuevo.",
    existingAccount: "Ya tienes una cuenta. Escribe tu contraseña.",
    wrongPassword: "Contraseña incorrecta",
  },
  googleErrors: {
    accountNotLinked:
      "Te registraste con correo y contraseña. Inicia sesión así abajo.",
    fallback: "No se pudo entrar con Google. Inténtalo de nuevo.",
  },
}

const WORDS: Record<PageLanguage, AuthWords> = { en, es }

export function authWordsFor(language: PageLanguage): AuthWords {
  return WORDS[language]
}
