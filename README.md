# Coupon Management — Assignment Solution

**Assignment name:** Coupon Management

## Project Overview
Simple HTTP service that implements a coupon system for an e-commerce use case. Coupons are stored in-memory and include rich eligibility rules. The service exposes APIs to create coupons, list coupons, compute the best applicable coupon for a user+cart, and to apply a coupon (increment usage).

## Tech Stack
- Node.js (v18+ recommended)
- Express.js
- In-memory storage (no DB required)
- Dev: nodemon (optional)

## Features
- Create coupons (`POST /api/coupons`) — rejects duplicate codes.
- Get coupons (`GET /api/coupons`) — for debugging.
- Best coupon evaluation (`POST /api/best-coupon`) — returns the best coupon according to:
  1. Highest discount amount
  2. If tie, earliest endDate
  3. If still tie, lexicographically smaller code
- Apply coupon (`POST /api/apply-coupon`) — validates and increments usage count for user.
- Demo user seeded (for reviewer login): `hire-me@anshumat.org` / `HireMe@2025!`

## Running locally

Prerequisites: Node.js 18+ and npm

```bash
# 1. install
npm install

# 2. start
npm start
# or for development:
# npm run dev


# API examples
- Service will run on http://localhost:5000 by default.
Create coupon
```bash
curl -X POST http://localhost:5000/api/coupons \
  -H "Content-Type: application/json" \
  -d '{
    "code":"SUMMER100",
    "description":"₹100 off summer special",
    "discountType":"FLAT",
    "discountValue":100,
    "startDate":"2025-01-01",
    "endDate":"2026-01-01",
    "usageLimitPerUser":1,
    "eligibility": { "minCartValue": 500 }
  }'
```
#  List coupons
```bash
  curl http://localhost:5000/api/coupons
```

# Best coupon

- Request body: { "user": {...}, "cart": { items: [ { productId, category, unitPrice, quantity }, ... ] } }
# Example:
```bash
curl -X POST http://localhost:5000/api/best-coupon \
 -H "Content-Type: application/json" \
 -d '{
   "user": { "userId": "u1", "userTier": "NEW", "country":"IN", "lifetimeSpend": 0, "ordersPlaced": 0 },
   "cart": { "items": [ {"productId":"p1","category":"electronics","unitPrice":1500,"quantity":1} ] }
 }'
```
# Apply coupon (to consume usage)
```bash
curl -X POST http://localhost:5000/api/apply-coupon \
 -H "Content-Type: application/json" \
 -d '{
   "user": { "userId": "u1" },
   "cart": { "items": [ {"productId":"p1","category":"electronics","unitPrice":1500,"quantity":1} ] },
   "code": "WELCOME100"
 }'
```


# Tests (manual)

- Use the curl examples above to create coupons and query best coupon. The seeded coupons are available at startup (see server console).
```yaml

---

## 3) Notes / Checklist for submission form
When you submit to the assignment form, include:
- Name: *(your name)*
- GitHub Repo: *push this folder to GitHub and share link*
- Live Demo Link: *if you host (optional). If not hosted, leave blank but indicate how to run locally*
- Tech Stack Used: Node.js, Express
- Notes for Reviewer: Mention demo login `hire-me@anshumat.org / HireMe@2025!`

---

## 4) Extra help I can do next (pick any)
- Convert to a small CLI test script to auto-run test cases (recommended for reviewers)
- Add unit tests (Jest) demonstrating edge cases
- Add persistent storage (file-based JSON) so state survives restarts
- Create a small hosted demo (e.g., Render) and give live URL (I can prepare deployment instructions / Dockerfile)

Tell me which extra you want and I’ll add it immediately.

---

Agar chahiye to abhi main `README.md`, `server.js`, aur `package.json` ka ready zip/gist bana ke de doon — ya seed-test cases add kar doon. Kaunsa karu next?
```
