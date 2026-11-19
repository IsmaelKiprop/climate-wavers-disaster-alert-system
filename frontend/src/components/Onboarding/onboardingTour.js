/**
 * Single source of truth for the post-signup product tour.
 * Keep aligned with AppNav /app destinations.
 */
export const ONBOARDING_TOTAL = 16;

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
    next: "/onboarding/calendar",
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
  calendar: {
    current: 6,
    next: "/onboarding/profile",
    prev: "/onboarding/chat",
    bot: "waverbot1",
    content: [
      {
        title: "Calendar",
        message:
          "See planting days, campaigns, and community events in one place so you never miss a climate action.",
      },
      {
        title: "Plan ahead",
        message:
          "Open Calendar from the sidebar to track what’s coming up and coordinate with your network.",
      },
    ],
  },
  profile: {
    current: 7,
    next: "/onboarding/plant-tree",
    prev: "/onboarding/calendar",
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
    current: 8,
    next: "/onboarding/plastic-pulse",
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
  plasticPulse: {
    current: 9,
    next: "/onboarding/bag-scanner",
    prev: "/onboarding/plant-tree",
    bot: "waverbot1",
    content: [
      {
        title: "Plastic Pulse",
        message:
          "Partners and Tree Admins run plastic recovery projects — track bags, issue certificates, and show verified impact.",
      },
      {
        title: "Partner desk",
        message:
          "Approved Tree Admins open Plastic Pulse from the sidebar to manage projects and recovery proof.",
      },
    ],
  },
  bagScanner: {
    current: 10,
    next: "/onboarding/alert-settings",
    prev: "/onboarding/plastic-pulse",
    bot: "waverbot1",
    content: [
      {
        title: "Bag scanner",
        message:
          "Invited recyclers scan bag QR codes to confirm recovery weight and close the loop on Plastic Pulse bags.",
      },
      {
        title: "Intake when invited",
        message:
          "Once you’re approved as a recycler, Bag scanner appears in your sidebar for fast on-site intake.",
      },
    ],
  },
  alertSettings: {
    current: 11,
    next: "/onboarding/disasters",
    prev: "/onboarding/bag-scanner",
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
    current: 12,
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
    current: 13,
    next: "/onboarding/champions",
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
  champions: {
    current: 14,
    next: "/onboarding/campaigns",
    prev: "/onboarding/responder",
    bot: "waverbot1",
    content: [
      {
        title: "Community Champions",
        message:
          "Champions help grow local climate action — apply from the sidebar, then run your Champion Desk once approved.",
      },
      {
        title: "Lead locally",
        message:
          "Use the desk to coordinate outreach, support community efforts, and keep neighbors engaged.",
      },
    ],
  },
  campaigns: {
    current: 15,
    next: "/onboarding/waverx",
    prev: "/onboarding/champions",
    bot: "waverbot1",
    content: [
      {
        title: "Campaigns",
        message:
          "Start or join climate and relief campaigns — set goals, rally support, and track progress with your community.",
      },
      {
        title: "Mobilize together",
        message:
          "Open Campaigns from the sidebar to discover active drives or launch one of your own.",
      },
    ],
  },
  waverx: {
    current: 16,
    next: "/app",
    prev: "/onboarding/campaigns",
    bot: "Waverbotfull",
    content: [
      {
        title: "WaverX",
        message:
          "Ask Climate Wavers’ assistant for help navigating alerts, planting, plastic recovery, and climate questions. WaverX also shares verified alerts and creative climate tips in your feed.",
      },
      {
        title: "You’re ready",
        message:
          "That’s the tour. Open the app to post, chat, gift trees, scan recovery bags, and stay alert with your community.",
      },
    ],
  },
};
