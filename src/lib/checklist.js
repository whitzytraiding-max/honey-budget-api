/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

export function buildSetupChecklist({ currentUser, partnerUser, coachProfile, recurringBills, goals }) {
  const hasPartner = Boolean(partnerUser);
  const incomeComplete = hasPartner
    ? Boolean(currentUser?.monthlySalary > 0 && partnerUser?.monthlySalary > 0 && currentUser?.incomeDayOfMonth && partnerUser?.incomeDayOfMonth)
    : Boolean(currentUser?.monthlySalary > 0 && currentUser?.incomeDayOfMonth);

  return [
    {
      key: "partner",
      title: "Link your partner",
      description: "Connect both accounts so the app can act like one shared household.",
      completed: hasPartner,
      route: "settings",
    },
    {
      key: "income",
      title: hasPartner ? "Set both income profiles" : "Set your income profile",
      description: hasPartner
        ? "Make sure income, split, and income day are saved for both partners."
        : "Make sure your income, split, and income day are saved.",
      completed: incomeComplete,
      route: "settings",
    },
    {
      key: "bills",
      title: "Add your recurring bills",
      description: "Rent, subscriptions, and utilities should auto-fill each month.",
      completed: recurringBills.length > 0,
      route: "planner",
    },
    {
      key: "goals",
      title: "Create your first savings goal",
      description: "Give the coach and planner something concrete to aim toward.",
      completed: goals.length > 0,
      route: "savings",
    },
    {
      key: "coach",
      title: hasPartner ? "Finish the couples coach questionnaire" : "Finish your personal coach questionnaire",
      description: hasPartner
        ? "Tell Honey Budget where you want help and where tension usually starts."
        : "Tell Honey Budget where you want help and what habits trip you up.",
      completed: Boolean(coachProfile?.completed),
      route: "coach",
    },
  ];
}
