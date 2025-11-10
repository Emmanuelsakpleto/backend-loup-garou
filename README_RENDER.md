# Déploiement sur Render

Ce fichier décrit les étapes recommandées pour déployer le backend `backend-loup-garou` sur Render.

Prérequis
- Un compte Render (https://dashboard.render.com)
- Le repository https://github.com/Emmanuelsakpleto/backend-loup-garou accessible depuis Render

Étapes rapides

1. Pousser la branche `main` sur GitHub (si ce n'est pas déjà fait).

2. Créer la base PostgreSQL sur Render
- Dashboard → New → PostgreSQL Database → créer la base
- Copiez la `Connection String` (Internal ou External selon votre besoin)

3. Créer le Web Service
- Dashboard → New → Web Service
- Connectez le repo GitHub `Emmanuelsakpleto/backend-loup-garou` et sélectionnez la branche `main`.
- Build Command: `npm ci && npm run build`
- Start Command: `npm run migrate && npm start`
  - `initDb()` est idempotent; `npm run migrate` appliquera la création des tables au démarrage.

4. Configurer les variables d'environnement
- Dans la page du Web Service → Environment → Add Environment Variable
- Ajoutez `DATABASE_URL` = la Connection String fournie par Render (ou la vôtre)

5. Déployer et vérifier
- Déployez le service et vérifiez l'URL fournie par Render.
- Vérifiez l'endpoint `/health` (ex: `https://<your-service>.onrender.com/health`) doit renvoyer `{"status":"ok"}`.

Notes de sécurité
- Ne committez jamais de secrets (mot de passe, DATABASE_URL). Utilisez les environnements du provider (Render) ou `.env` local que vous excluez via `.gitignore`.

Conseils supplémentaires
- Pour des workflows plus robustes, remplacez le script de migration par un outil de migration dédié (node-pg-migrate, migrate, knex, Flyway...)
- Vous pouvez ajouter un `render.yaml` (ex: le fichier `render.yaml` à la racine) pour déclarer le service via IaC; renseignez la variable d'environnement dans le dashboard.
