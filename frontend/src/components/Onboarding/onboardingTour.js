/**
 * Single source of truth for the post-signup product tour.
 * Keep aligned with AppNav /app destinations.
 */
export const ONBOARDING_TOTAL = 11;

export const tour = {
  home: {
    current: 1,
    next: "/onboarding/network",
    prev: "/onboarding",
    bot: "waverbot1",
    content: [
      {
        title: "Home feed",
        message:
          "Your starting point for climate posts, community reports, and what people around you are sharing.",
      },
      {
        title: "Stay in the loop",
        message:
          "Scroll the feed, open posts, react, and jump into conversations from here.",
      },
    ],
  },
  network: {
    current: 2,
    next: "/onboarding/groups",
    prev: "/onboarding/home",
    bot: "waverbot1",
    content: [
      {
        title: "Network",
        message:
          "Find people to follow, see who is online, and grow your climate circle.",
      },
      {
        title: "Connect with purpose",
        message:
          "Message members, visit profiles, and discover people planting trees near you.",
      },
    ],
  },
  groups: {
    current: 3,
    next: "/onboarding/community",
    prev: "/onboarding/network",
    bot: "waverbot1",
    content: [
      {
        title: "Groups",
        message:
          "Create or join climate groups with a logo, short description, and shared group chat.",
      },
      {
        title: "Tap for group info",
        message:
          "Open a group chat, tap the header, and see members, admins, and the description — WhatsApp-style.",
      },
    ],
  },
  community: {
    current: 4,
    next: "/onboarding/chat",
    prev: "/onboarding/groups",
    bot: "waverbot1",
    content: [
      {
        title: "Community",
        message:
          "Share reports, discuss climate topics, and collaborate with people who care about the planet.",
      },
      {
        title: "Your voice matters",
        message:
          "Post updates, use hashtags and links, and keep conversations grounded in real local context.",
      },
    ],
  },
  chat: {
    current: 5,
    next: "/onboarding/profile",
    prev: "/onboarding/community",
    bot: "waverbot1",
    content: [
      {
        title: "Chats",
        message:
          "Message friends, join Climate Wavers Community, and talk inside your groups in real time.",
      },
      {
        title: "Media, mentions & gifts",
        message:
          "Send photos, @mention people, open profiles, and gift trees from chat with warm invite suggestions.",
      },
    ],
  },
  profile: {
    current: 6,
    next: "/onboarding/plant-tree",
    prev: "/onboarding/chat",
    bot: "waverbot1",
    content: [
      {
        title: "Profile",
        message:
          "Add your photo, bio, and location so friends can find you and gift you trees.",
      },
      {
        title: "Share your impact",
        message:
          "Complete your profile to unlock a stronger share link and tree-gift experience.",
      },
    ],
  },
  plantTree: {
    current: 7,
    next: "/onboarding/alert-settings",
    prev: "/onboarding/profile",
    bot: "waverbot1",
    content: [
      {
        title: "Plant & gift trees",
        message:
          "Fund verified planting projects — for yourself or as a gift dedicated to someone you care about.",
      },
      {
        title: "Celebrate in chat",
        message:
          "From Chats, open gift ideas, send a tree invite, or plant a tree in someone’s name in a few taps.",
      },
    ],
  },
  alertSettings: {
    current: 8,
    next: "/onboarding/disasters",
    prev: "/onboarding/plant-tree",
    bot: "waverbot1",
    content: [
      {
        title: "Alert settings",
        message:
          "Choose email and WhatsApp alerts, set your radius, and verify your phone for Meta WhatsApp delivery.",
      },
      {
        title: "Stay ready",
        message:
          "Tune magnitude and location so you get operational alerts that matter where you are.",
      },
    ],
  },
  disasters: {
    current: 9,
    next: "/onboarding/responder",
    prev: "/onboarding/alert-settings",
    bot: "waverbot1",
    content: [
      {
        title: "Live alerts",
        message:
          "Follow official and community disaster signals with clear source tags — not a government warning system.",
      },
      {
        title: "Act with care",
        message:
          "Read confidence language, follow local emergency guidance, and share responsibly.",
      },
    ],
  },
  responder: {
    current: 10,
    next: "/onboarding/waverx",
    prev: "/onboarding/disasters",
    bot: "waverbot1",
    content: [
      {
        title: "Responder Desk",
        message:
          "Agencies and NGOs can apply for RapidBrief — AI disaster dispatches for coordinated response.",
      },
      {
        title: "Organize together",
        message:
          "Approved orgs get a responder chat room and dispatch inbox for field-ready briefs.",
      },
    ],
  },
  waverx: {
    current: 11,
    next: "/app",
    prev: "/onboarding/responder",
    bot: "Waverbotfull",
    content: [
      {
        title: "WaverX",
        message:
          "Ask Climate Wavers’ assistant for help navigating alerts, planting, and climate questions.",
      },
      {
        title: "You’re ready",
        message:
          "That’s the tour. Open the app to post, chat, gift trees, and stay alert with your community.",
      },
    ],
  },
};
