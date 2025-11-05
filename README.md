# Gestion des gardes (Supabase + GitHub Pages)

Ce projet fournit une interface statique (compatible GitHub Pages) pour gérer les comptes et les saisies de gardes en s'appuyant sur Supabase.

## Fonctionnalités

- **Connexion Supabase** : à l'ouverture de chaque page, une fenêtre invite à renseigner l'URL et la clé API Supabase (stockées dans le navigateur).
- **Gestion des utilisateurs** : l'espace administrateur permet de créer, modifier, supprimer des comptes et de changer les mots de passe.
- **Saisie des gardes** : l'espace médecin permet de saisir ses gardes et de les consulter en temps réel.
- **Disponibilités remplaçants** : l'espace remplaçant permet de déclarer ses créneaux disponibles.
- **Mise à jour temps réel** : les listes se mettent à jour automatiquement via les canaux Supabase Realtime.

## Installation et déploiement

1. Déployez ce dossier sur GitHub Pages ou tout autre hébergeur de fichiers statiques.
2. Créez un projet Supabase et exécutez le script [`supabase_schema.sql`](./supabase_schema.sql) dans la console SQL pour créer les tables, l'administrateur initial (`admin` / `Melatonine`) et les politiques de sécurité.
3. Récupérez l'URL Supabase (`https://votre-instance.supabase.co`) et une clé API (clé de service recommandée pour l'administration).
4. Ouvrez `index.html`, saisissez l'URL et la clé API lorsque la fenêtre s'affiche, puis connectez-vous avec le compte `admin` / `Melatonine`.
5. Depuis l'espace administrateur, créez les comptes pour les médecins et remplaçants.

> ℹ️ **Sécurité** : le script SQL fournit des politiques permissives pour simplifier les tests. Adaptez-les pour vos besoins (politiques spécifiques par rôle, restrictions sur les colonnes, etc.). Pour un usage public, préférez utiliser une clé de service côté serveur.

## Structure des pages

- `index.html` : écran de connexion pour tous les utilisateurs.
- `admin.html` : interface d'administration des comptes.
- `medecin.html` : saisie et suivi des gardes pour les médecins.
- `remplacant.html` : saisie des disponibilités pour les remplaçants.

Chaque page importe `js/supabaseClient.js` pour gérer la connexion Supabase et la session utilisateur (stockée dans le `localStorage`).

## Développement

Aucune dépendance additionnelle n'est nécessaire : l'application charge `@supabase/supabase-js` via un CDN. Pour tester en local, servez simplement les fichiers statiques (ex. `npx serve .`).
