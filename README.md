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
