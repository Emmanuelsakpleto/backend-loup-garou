# 🗄️ Guide de configuration PostgreSQL sur Render

## Étapes pour créer une nouvelle base de données

### 1. Créer une nouvelle PostgreSQL Database sur Render

1. Allez sur [Render Dashboard](https://dashboard.render.com/)
2. Cliquez sur **"New +"** → **"PostgreSQL"**
3. Configurez :
   - **Name** : `loup-garou-db`
   - **Database** : `loupgarou` (ou laissez par défaut)
   - **User** : `loupgarou` (ou laissez par défaut)
   - **Region** : Oregon
   - **PostgreSQL Version** : 16
   - **Plan** : **Free** (limité mais suffisant pour débuter)

4. Cliquez sur **"Create Database"**

### 2. Récupérer la chaîne de connexion

Une fois la base créée, allez dans l'onglet **"Info"** :

- **Internal Database URL** : Pour connexion depuis le même datacenter Render
- **External Database URL** : Pour connexion depuis l'extérieur

Copiez l'**Internal Database URL** (commence par `postgres://`)

Format : 
```
postgres://user:password@hostname:5432/database
```

### 3. Configurer le backend sur Render

1. Allez sur votre service backend : `backend-loup-garou`
2. Allez dans **"Environment"**
3. Ajoutez/Modifiez la variable :
   - **Key** : `DATABASE_URL`
   - **Value** : Collez l'URL interne de la DB
4. Cliquez sur **"Save Changes"**

Le backend va automatiquement redéployer.

### 4. Vérifier la migration

Le backend va automatiquement :
- Se connecter à PostgreSQL
- Créer les tables `games` et `players`
- Créer les index nécessaires

Pour vérifier, consultez les logs du backend :
```
✅ PostgreSQL connected and initialized
Backend server listening on 5174
```

### 5. Tester manuellement les migrations (optionnel)

Si vous voulez exécuter les migrations manuellement :

```bash
# Dans le terminal de votre backend Render (ou en local)
npm run migrate
```

## Configuration locale pour tester avec PostgreSQL

### Option 1 : PostgreSQL local

1. Installer PostgreSQL localement
2. Créer une base de données :
```sql
CREATE DATABASE loupgarou;
```

3. Créer un fichier `.env` :
```env
DATABASE_URL=postgresql://postgres:votrepassword@localhost:5432/loupgarou
PORT=5174
```

4. Lancer les migrations :
```bash
npm run migrate
```

5. Démarrer le serveur :
```bash
npm run dev
```

### Option 2 : Utiliser le store mémoire (développement rapide)

Ne définissez pas `DATABASE_URL` dans `.env` :

```env
PORT=5174
# DATABASE_URL non défini = utilise memory-store
```

Le backend utilisera automatiquement le store en mémoire.

## Alternatives gratuites à Render PostgreSQL

Si la limite gratuite de Render ne suffit pas :

### 1. **Neon** (Recommandé)
- URL : https://neon.tech
- Free tier : 3 projets, 10 GB
- Serverless PostgreSQL
- Très simple d'utilisation

### 2. **Supabase**
- URL : https://supabase.com
- Free tier : 500 MB, 2 projets
- Bonus : Auth, Storage, Real-time intégrés

### 3. **ElephantSQL**
- URL : https://www.elephantsql.com
- Free tier : 20 MB (très limité)
- Parfait pour les tests

### 4. **Railway**
- URL : https://railway.app
- $5 de crédits gratuits/mois
- Facile à configurer

## Configuration avec Neon (Alternative recommandée)

1. Créez un compte sur https://neon.tech
2. Créez un nouveau projet : `loup-garou`
3. Copiez la **Connection string**
4. Dans Render, remplacez `DATABASE_URL` par cette nouvelle URL
5. Redéployez

## Schéma de la base de données

```sql
-- Table des parties
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_token TEXT NOT NULL,
  status TEXT NOT NULL,
  settings_json TEXT,
  created_at BIGINT NOT NULL
);

-- Table des joueurs
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Index pour performance
CREATE INDEX idx_games_code ON games(code);
CREATE INDEX idx_players_game ON players(game_id);
```

## Dépannage

### Erreur "SASL: SCRAM-SERVER-FIRST-MESSAGE"

➡️ La DATABASE_URL est mal formatée ou les identifiants sont incorrects.
- Vérifiez que vous avez copié l'URL complète
- Essayez l'External URL si l'Internal ne fonctionne pas

### Erreur "Too many connections"

➡️ Limite du plan gratuit atteinte
- Redémarrez la base de données
- Passez à un plan payant
- Ou utilisez une alternative (Neon, Supabase)

### Le backend ne se connecte pas

➡️ Vérifiez les logs Render :
```bash
# Dans le dashboard Render, onglet "Logs"
```

### Tables non créées

➡️ Exécutez manuellement :
```bash
npm run migrate
```

## Monitoring

Pour surveiller votre base de données :

1. **Render Dashboard** : Metrics tab (CPU, Connexions)
2. **pgAdmin** : Connectez-vous avec l'External URL
3. **TablePlus** : Client PostgreSQL moderne (gratuit)

---

**Votre backend est maintenant prêt avec PostgreSQL ! 🚀**
