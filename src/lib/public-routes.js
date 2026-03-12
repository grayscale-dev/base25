export const publicRoutes = {
  home: "/",
  about: "/about",
  features: "/features",
  pricing: "/pricing",
  feedback: "/feedback",
  roadmap: "/roadmap",
  changelog: "/changelog",
  signIn: "/auth/sign-in",
  workspaceHub: "/workspaces",
};

export const publicRouteAnchors = {
  feedbackManagement: publicRoutes.feedback,
  productRoadmap: publicRoutes.roadmap,
  changelog: publicRoutes.changelog,
  workflowAutomation: `${publicRoutes.features}#workflow`,
  whyBase25: `${publicRoutes.home}#why-base25`,
  comparison: `${publicRoutes.home}#comparison`,
  faq: `${publicRoutes.home}#faq`,
  pricing: `${publicRoutes.home}#pricing`,
};
