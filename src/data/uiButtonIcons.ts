/** Central paths for menu / tab button icons (PNG, transparent). */
export const UI_BUTTON_ICONS = {
  drawer: {
    fullscreen: "ui/drawer-fullscreen.png",
    messages: "ui/drawer-messages.png",
    news: "ui/drawer-news.png",
    settings: "ui/drawer-settings.png",
    battles: "ui/drawer-battles.png",
    records: "ui/drawer-records.png",
    mapEditor: "ui/drawer-map-editor.png",
    admin: "ui/drawer-admin.png",
    logout: "ui/drawer-logout.png",
    register: "ui/drawer-register.png",
    accounts: "ui/drawer-accounts.png",
  },
  shopTab: {
    brawlers: "ui/nav-character.png",
    pets: "ui/nav-pets.png",
    chests: "ui/nav-chests.png",
    deals: "ui/nav-bonus.png",
    stars: "ui/shop-tab-stars.png",
    donate: "ui/shop-tab-donate.png",
  },
  customTab: {
    pins: "ui/custom-tab-pins.png",
    icons: "ui/custom-tab-icons.png",
    gifts: "ui/nav-gifts.png",
    backgrounds: "ui/custom-tab-backgrounds.png",
    trails: "ui/custom-tab-trails.png",
  },
  character: {
    comic: "ui/nav-comic.png",
    mastery: "ui/nav-mastery.png",
    trails: "ui/nav-trails.png",
    try: "ui/char-btn-try.png",
    pins: "ui/char-btn-pins.png",
  },
  party: {
    speechBubble: "ui/party-speech-bubble.png",
    modeSuggestBubble: "ui/party-mode-suggest-bubble.png",
  },
} as const;
