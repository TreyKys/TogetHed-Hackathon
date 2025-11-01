# Netlify Deployment Guide

This document outlines the required settings for deploying the `skillswap-react` frontend application on Netlify.

## Build Settings

These settings should be configured in the Netlify UI or in the `netlify.toml` file.

- **Base directory:** `skillswap-react`
- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`

## Node.js Version

The Node.js version is pinned to `18` via the `.nvr`c file in the repository root. Netlify will automatically use this version.

## Environment Variables

The following client-side environment variables must be configured in the Netlify UI for the site to function correctly:

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_HEDERA_NETWORK`
- `REACT_APP_CONTRACT_ID`
- `REACT_APP_TOKEN_ID`

**Important:** Do not add any sensitive keys, such as `HEDERA_ADMIN_PRIVATE_KEY` or `HEDERA_SUPPLY_KEY`, to the frontend environment variables. These belong only to the backend Cloud Functions environment.
