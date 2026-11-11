/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Lien d'invitation du canal Telegram (ex. https://t.me/moncanal). */
  readonly VITE_TELEGRAM_URL?: string;
  /** "1" = affiche le jeu de données de démonstration (jamais en production). */
  readonly VITE_DEMO?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
