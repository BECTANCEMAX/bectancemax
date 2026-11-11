// Réglages généraux du site BECTANCEMAX.

export const SITE = {
  name: "BECTANCEMAX",
  /**
   * Lien d'invitation du canal Telegram.
   * Peut être remplacé sans toucher au code via VITE_TELEGRAM_URL (fichier .env).
   */
  telegramUrl: import.meta.env.VITE_TELEGRAM_URL || "https://t.me/+M9qrlCYNm0U0OGM0",
} as const;
