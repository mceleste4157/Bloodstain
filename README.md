# bloodstain-c5531

A standalone Firebase app — **Hosting + Auth + Firestore** — self-contained in
this folder and independent of the DERT / Critical Incident dashboard in the
repo root.

**Live:** https://bloodstain-c5531.web.app/

## Structure

```
bloodstain-c5531/
├── .firebaserc              # default project: bloodstain-c5531
├── firebase.json            # Hosting + Firestore config
├── firestore.rules          # security rules (auth required, per-user data)
├── firestore.indexes.json   # composite index for the items query
└── public/
    ├── index.html           # auth-gated home + live Firestore demo
    ├── login.html           # email/password sign in & sign up
    └── firebase-config.js   # SDK init → exports { app, auth, db, analytics }
```

## What's wired up

- **Hosting** — serves `public/`, SPA rewrite to `index.html`.
- **Auth** — email/password. `login.html` signs in or creates an account;
  `index.html` redirects to login when signed out and shows the app when
  signed in. Enable **Email/Password** under Authentication → Sign-in method
  in the Firebase console (one-time).
- **Firestore** — `index.html` demonstrates a live, per-user item list using
  `onSnapshot`. Each item stores `ownerUid` + `createdAt` (`serverTimestamp`).
  Rules restrict every user to only their own `items` and their own
  `users/{uid}` profile doc; everything else is denied.

## Local preview

```bash
cd bloodstain-c5531
npx firebase-tools serve --only hosting
```

## Deploy

```bash
cd bloodstain-c5531
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

Deploying the indexes is what makes the `items` query (filter by `ownerUid` +
order by `createdAt`) work — without it Firestore returns a "requires an index"
error the first time the list loads.

## Extending

The SDK is loaded as ES modules from the gstatic CDN (no build step). Add more
Firebase products by importing them in `public/firebase-config.js`, e.g.
`getStorage`. Add new collections to `firestore.rules` following the `items`
pattern (store an owner UID, check it in the rule).
