# ⚡ TechPulse AI — Le Journal Technologique Automatisé

> **« Toute l'actualité technologique importante, expliquée par l'IA, directement dans votre boîte mail. »**

**TechPulse AI** est une application web complète, moderne et 100% autonome conçue pour devenir un véritable journal quotidien consacré à l'actualité technologique. 

Sans aucune intervention humaine quotidienne, le système :
1. **Recherche et ingère l'actualité** sur Internet via les principaux médias spécialisés et les newsrooms officielles des constructeurs.
2. **Vérifie, dédoublonne et hiérarchise** les informations grâce à un pipeline d'intelligence artificielle (Google Gemini).
3. **Rédige des articles journalistiques complets** en français avec contexte, chiffres vérifiés et analyse d'impact.
4. **Génère et envoie deux newsletters HTML adaptatives par jour** aux abonnés :
   - **À 06 h 15 (Heure de Paris) :** La grande édition matinale exhaustive (actualités de la nuit, dossiers clés, rubriques thématiques, radar de veille).
   - **À 16 h 30 (Heure de Paris) :** L'édition de l'après-midi (« Ce qu'il faut retenir aujourd'hui », nouveautés parues depuis 6h15 et mises à jour des sujets en cours).

---

## 🏛️ Architecture Technique

```
┌────────────────────────────────────────────────────────┐
│             Sources & Newsrooms Officielles            │
│ (The Verge, TechCrunch, Frandroid, Apple, OpenAI, etc.)│
└──────────────────────────┬─────────────────────────────┘
                           │ (Collecte continue RSS / Scraping)
                           ▼
┌────────────────────────────────────────────────────────┐
│          Moteur d'Ingestion & Déduplication            │
│   - Filtrage temporel (Nuit vs Journée)                │
│   - Nettoyage HTML & Sécurité anti-injection prompt    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│        Rédacteur en Chef IA (Google Gemini 3.5)        │
│   - Hiérarchisation des faits confirmés vs rumeurs     │
│   - Rédaction journalistique, synthèse express & fond  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│         Moteur de Rendu HTML Responsive & Web          │
│   - Tables imbriquées optimisées pour Gmail & Outlook  │
│   - En-têtes RFC 8058 One-Click List-Unsubscribe       │
│   - Lecteur d'archives web public (/editions/:id)      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│        Planificateur Résilient (Fuseau Paris)          │
│   - Tâches cron serveur (05:00/06:15 et 15:45/16:30)   │
│   - Gestion automatique de l'heure d'été / hiver       │
│   - Idempotence stricte (aucun email en double)        │
│   - File d'envoi avec reprise sur incident             │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Fonctionnalités Clés

### 1. Inscription Ultra-Simple par Code Temporaire
- Landing page minimaliste : seul le champ email est requis.
- Pas de compte, pas de mot de passe à mémoriser.
- Code de vérification à 6 chiffres envoyé par email (valide 15 minutes, stocké sous forme de hachage SHA-256 salé, protection anti-bruteforce limitée à 5 tentatives).

### 2. Désinscription Conforme et Fiable
- Bouton clair de désinscription sur le site.
- Lien de désinscription personnalisé à usage unique dans chaque pied de page de newsletter.
- Support natif des en-têtes RFC 8058 (`List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`), exigés par Gmail et Yahoo.
- Désactivation immédiate de tout envoi ultérieur.

### 3. Sources d'Information Diversifiées
- **Médias spécialisés français :** Frandroid, Les Numériques, Numerama, 01net.
- **Médias internationaux de référence :** The Verge, TechCrunch, Ars Technica, Wired, Engadget.
- **Newsrooms officielles :** Apple Newsroom, Google Blog (The Keyword & DeepMind), Microsoft Stories, NVIDIA Blog, OpenAI News, Anthropic, Meta Newsroom.
- **Cybersécurité :** The Hacker News, BleepingComputer.

### 4. Déontologie Journalistique & Sécurité IA
- Interdiction stricte d'inventer des faits, citations ou dates (température basse 0.3).
- Distinction rigoureuse entre annonces officielles, rumeurs et analyses.
- Conservation des liens vers les sources primaires.
- Les contenus aspirés du web sont traités comme des données non fiables (`<raw_scraped_articles>`) pour immuniser le système contre les attaques par injection de prompt (*Prompt Injection*).

---

## 📦 Installation & Démarrage

### Prérequis
- **Node.js** v20+ ou v22+
- **npm** v9+

### 1. Cloner et installer les dépendances
```bash
git clone <url_du_depot> techpulse-ai
cd techpulse-ai
npm install
```

### 2. Configuration des variables d'environnement (`.env`)
Copiez `.env.example` en `.env` et ajustez les paramètres :
```bash
cp .env.example .env
```

Contenu type de `.env` :
```env
PORT=3000
APP_BASE_URL=http://localhost:3000
APP_NAME="TechPulse AI"

# Clé API Google Gemini
GEMINI_API_KEY=VOTRE_CLE_GEMINI_ICI
GEMINI_MODEL=gemini-3.5-flash

# Base de données SQLite locale
DB_PATH=./data/techpulse.db

# Mode d'envoi : sandbox (développement) | smtp | resend
EMAIL_PROVIDER=sandbox
EMAIL_FROM="TechPulse AI <newsletter@techpulse.ai>"

# Fuseau horaire
TIMEZONE=Europe/Paris
```

### 3. Initialiser les données de test
```bash
npm run seed
```

### 4. Démarrer le serveur et le planificateur
```bash
npm start
```
L'interface web est alors accessible sur `http://localhost:3000`.

---

## 🛠️ Commandes CLI Disponibles

| Commande | Action |
| :--- | :--- |
| `npm start` | Lance le serveur Express et active les tâches planifiées (06h15 et 16h30). |
| `npm run dev` | Lance le serveur en mode rechargement automatique (`--watch`). |
| `npm test` | Exécute la suite complète de 20 tests unitaires et d'intégration. |
| `npm run edition:morning` | Déclenche immédiatement la préparation et l'envoi de l'édition du matin. |
| `npm run edition:afternoon` | Déclenche immédiatement la préparation et l'envoi de l'édition de l'après-midi. |
| `npm run seed` | Enregistre des abonnés de démonstration dans la base locale. |

---

## 💰 Estimation des Coûts Mensuels selon l'Audience

Un des atouts majeurs de l'architecture de **TechPulse AI** réside dans le fait que la synthèse IA n'est exécutée que **deux fois par jour**, quel que soit le volume d'abonnés.

| Abonnés | Volume emails / mois (2/j) | IA Gemini 3.5 Flash | Routage Email | Serveur (VPS) | Coût Total Estimé |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100** | ~6 000 | 0,00 € (Free Tier) | 0,00 € (Offre gratuite Brevo/Resend) | 0 € à 4 € (Render / Hetzner) | **0 € à 4 € / mois** |
| **1 000** | ~60 000 | ~0,50 € / mois | ~15 € / mois (Brevo Starter / Resend) | 4 € / mois (VPS 2 Go RAM) | **~19 € / mois** |
| **10 000** | ~600 000 | ~1,50 € / mois | ~60 $ à 110 € (Amazon SES ~60 $) | 8 € / mois (Hetzner CX22) | **~70 € à 120 € / mois** |
| **50 000** | ~3 000 000 | ~5,00 € / mois | ~300 $ / mois (Amazon SES 0,10 $/1000) | 20 € / mois (VPS 4 vCPU / 8 Go) | **~310 € / mois** |

---

## 🔒 Déploiement en Production 24/7 (Systemd)

Pour garantir que TechPulse AI s'exécute de façon ininterrompue sur un serveur Linux (Ubuntu/Debian) même après un redémarrage :

1. Créez le fichier de service `/etc/systemd/system/techpulse.service` :
```ini
[Unit]
Description=TechPulse AI Automated Newspaper Daemon
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/techpulse-ai
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

2. Activez et démarrez le service :
```bash
sudo systemctl daemon-reload
sudo systemctl enable techpulse
sudo systemctl start techpulse
```

---

## ⚖️ Conformité RGPD & Protection des Données

- **Minimisation stricte :** Seule l'adresse email est collectée. Aucun nom, mot de passe, ou donnée sensible.
- **Hachage des codes :** Les codes de confirmation à 6 chiffres sont chiffrés en SHA-256 avec sel et purgés après usage ou 15 minutes.
- **Désinscription immédiate :** Tout utilisateur peut se désinscrire en un clic sans mot de passe.
- **Aucune transmission commerciale :** Les données ne font l'objet d'aucun partage ni revente.
