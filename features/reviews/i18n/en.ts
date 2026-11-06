// Clients' reviews of their visits (docs/plans/client-account.md, D15), in
// English as ICU messages (docs/plans/translations.md, G4).
const words = {
  stars: "{n, plural, one {# star} other {# stars}}",
  // The client's own review, on the booking's page.
  form: {
    title: "Your review",
    rate: "How was it?",
    comment: "Comment",
    commentHelp: "Optional, up to {max} characters",
    save: "Save",
    saved: "Thanks for your review",
    failed: "Couldn't save. Try again.",
    tooLate: "This review can no longer be changed",
  },
  // On the business's page.
  page: {
    title: "Client reviews",
    count: "{n, plural, one {# review} other {# reviews}}",
  },
  // The owner's list (Customers → Reviews).
  owner: {
    none: "No reviews yet",
    hidden: "Hidden",
    hide: "Hide",
    show: "Show again",
    hideHelp: "Hidden reviews leave your page. You can't change what clients write.",
    reason: "Hide because",
    failed: "That did not work. Please try again.",
  },
  reasons: {
    offensive: "Offensive",
    personalInfo: "Personal details",
    notAVisit: "Not a real visit",
    spam: "Spam",
  },
  // The admin's list.
  admin: {
    none: "No reviews yet",
    rules: "Rules",
    maxComment: "Longest comment: {n} characters",
    editDays: "Can be changed for {n} days",
    ask: "Asked {hours} h after the visit, for visits in the last {days} days",
    latestShown: "Business page shows the latest {n}",
  },
}

export default words
