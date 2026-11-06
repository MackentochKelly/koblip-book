// The login form's words, in English as ICU messages
// (docs/plans/translations.md, G4).
const words = {
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
  usePhone: "Continue with phone",
  moreOptions: "More options",
  google: "Continue with Google",
  forgotPassword: "Forgot password?",
  resetSent: "Check your email for the link.",
  newPassword: "New password",
  savePassword: "Save password",
  passwordChanged: "Password changed.",
  linkExpired: "This link no longer works. Ask for a new one.",
  backToLogIn: "Back to log in",
  // `min` and `max`: ONBOARDING_RULES' password lengths
  // (hooks/use-auth-error-text.ts).
  errors: {
    email: "Check your email address",
    name: "Add your name",
    password: "{min, plural, other {Use at least # characters}}",
    passwordTooLong: "{max, plural, other {Use no more than # characters}}",
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
  // Phone sign-in (components/phone-code-form.tsx).
  phone: {
    phone: "Phone",
    phoneHelp: "We'll send a code to your WhatsApp.",
    sendCode: "Send code",
    sendingCode: "Sending…",
    code: "Code",
    codeSentTo: "Enter the code sent to {phone}.",
    verify: "Continue",
    checking: "Checking…",
    wrongCode: "That code didn't work. Try again.",
    expiredCode: "That code expired. Ask for a new one.",
    tooManyTries: "Too many tries. Ask for a new code.",
    tooFast: "Too many codes. Wait a minute.",
    phoneTaken: "That phone is on another account.",
    sendFailed: "The code didn't send. Try again.",
    newCode: "Send a new code",
    changePhone: "Change number",
  },
} as const

export default words
