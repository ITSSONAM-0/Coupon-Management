/**
 * Coupon Assignment — server.js
 *
 * Implements:
 * - POST /api/coupons      -> create coupon (unique code)
 * - GET  /api/coupons      -> list coupons
 * - POST /api/best-coupon  -> evaluate and return best coupon for given user+cart
 *
 * In-memory storage:
 * - coupons: Array of coupon objects
 * - userUsage: { [userId]: { [couponCode]: usageCount } }
 *
 * Demo user seeded: hire-me@anshumat.org / HireMe@2025!
 */

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* -----------------------
   In-memory stores
   ----------------------- */
const coupons = []; // stored coupons
const userUsage = {}; // userUsage[userId] = { COUPON_CODE: count }

/* -----------------------
   Utility helpers
   ----------------------- */

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function nowDate() {
  return new Date();
}

function parseDate(s) {
  // Accept Date object or ISO string (YYYY-MM-DD or full ISO)
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d)) return null;
  return d;
}

function computeCartValue(cart) {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((sum, it) => {
    const price = Number(it.unitPrice || 0);
    const qty = Number(it.quantity || 0);
    return sum + price * qty;
  }, 0);
}

function computeItemsCount(cart) {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
}

/* -----------------------
   Seed demo user & coupons
   ----------------------- */

const demoUser = {
  userId: "hire-me",
  email: "hire-me@anshumat.org",
  password: "HireMe@2025!",
  userTier: "NEW",
  country: "IN",
  lifetimeSpend: 0,
  ordersPlaced: 0
};

// Seed example coupons (match assignment schema)
function seedCoupons() {
  coupons.length = 0;
  coupons.push(
    {
      code: "WELCOME100",
      description: "₹100 off for new users",
      discountType: "FLAT",
      discountValue: 100,
      maxDiscountAmount: null,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24), // active since yesterday
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
      usageLimitPerUser: 1,
      eligibility: {
        allowedUserTiers: ["NEW"],
        minLifetimeSpend: 0,
        minOrdersPlaced: 0,
        firstOrderOnly: true,
        allowedCountries: ["IN"]
      }
    },
    {
      code: "FESTIVE50P",
      description: "50% up to ₹500 on cart >= ₹2000",
      discountType: "PERCENT",
      discountValue: 50,
      maxDiscountAmount: 500,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      usageLimitPerUser: 2,
      eligibility: {
        minCartValue: 2000,
        allowedCountries: ["IN", "US"]
      }
    },
    {
      code: "ELECTRO10",
      description: "10% off on electronics, min 1 item from electronics",
      discountType: "PERCENT",
      discountValue: 10,
      maxDiscountAmount: null,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      usageLimitPerUser: null,
      eligibility: {
        applicableCategories: ["electronics"],
        minItemsCount: 1
      }
    },
    {
      code: "EXCLUDE-FASHION",
      description: "Flat ₹150 off if cart has NO fashion items",
      discountType: "FLAT",
      discountValue: 150,
      maxDiscountAmount: null,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      usageLimitPerUser: null,
      eligibility: {
        excludedCategories: ["fashion"],
        minCartValue: 500
      }
    }
  );
}

seedCoupons();

/* -----------------------
   API: create coupon
   POST /api/coupons
   Body: coupon object per assignment schema
   ----------------------- */
app.post("/api/coupons", (req, res) => {
  try {
    const body = req.body || {};
    if (!body.code || !body.discountType || (body.discountValue === undefined || body.discountValue === null) || !body.startDate || !body.endDate) {
      return res.status(400).json({ success: false, message: "Missing required fields: code, discountType, discountValue, startDate, endDate" });
    }

    const code = normalizeCode(body.code);

    // Unique code policy: reject duplicates (documented choice)
    if (coupons.some(c => normalizeCode(c.code) === code)) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }

    const coupon = {
      code,
      description: body.description || "",
      discountType: String(body.discountType).toUpperCase(), // FLAT or PERCENT
      discountValue: Number(body.discountValue),
      maxDiscountAmount: body.maxDiscountAmount != null ? Number(body.maxDiscountAmount) : null,
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate),
      usageLimitPerUser: body.usageLimitPerUser != null ? Number(body.usageLimitPerUser) : null,
      eligibility: body.eligibility || {}
    };

    if (!coupon.startDate || !coupon.endDate) {
      return res.status(400).json({ success: false, message: "Invalid startDate or endDate" });
    }

    coupons.push(coupon);
    return res.json({ success: true, coupon });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------
   API: list coupons (debug)
   GET /api/coupons
   ----------------------- */
app.get("/api/coupons", (req, res) => {
  res.json({ success: true, coupons });
});

/* -----------------------
   Eligibility check
   Returns { ok: boolean, reason?: string }
   ----------------------- */
function checkEligibility(coupon, user, cart) {
  const now = nowDate();
  if (!coupon) return { ok: false, reason: "no coupon" };

  // date window
  if (coupon.startDate && now < coupon.startDate) return { ok: false, reason: "not started" };
  if (coupon.endDate && now > coupon.endDate) return { ok: false, reason: "expired" };

  // usage limit:
  if (coupon.usageLimitPerUser != null && user && user.userId) {
    const usedCount = (userUsage[user.userId] && userUsage[user.userId][coupon.code]) || 0;
    if (usedCount >= coupon.usageLimitPerUser) return { ok: false, reason: "usage limit reached" };
  }

  const e = coupon.eligibility || {};

  // User-based attributes
  if (e.allowedUserTiers && e.allowedUserTiers.length > 0) {
    if (!user || !user.userTier || !e.allowedUserTiers.map(x => String(x).toUpperCase()).includes(String(user.userTier).toUpperCase())) {
      return { ok: false, reason: "user tier not allowed" };
    }
  }

  if (e.minLifetimeSpend != null) {
    if (!user || Number(user.lifetimeSpend || 0) < Number(e.minLifetimeSpend)) return { ok: false, reason: "min lifetime spend not met" };
  }

  if (e.minOrdersPlaced != null) {
    if (!user || Number(user.ordersPlaced || 0) < Number(e.minOrdersPlaced)) return { ok: false, reason: "min orders placed not met" };
  }

  if (e.firstOrderOnly === true) {
    // Assumption: firstOrderOnly true means ordersPlaced === 0
    if (!user || Number(user.ordersPlaced || 0) !== 0) return { ok: false, reason: "not first order" };
  }

  if (e.allowedCountries && e.allowedCountries.length > 0) {
    if (!user || !user.country || !e.allowedCountries.map(x => String(x).toUpperCase()).includes(String(user.country).toUpperCase())) {
      return { ok: false, reason: "country not allowed" };
    }
  }

  // Cart-based attributes
  const cartValue = computeCartValue(cart);
  const itemsCount = computeItemsCount(cart);
  const categoriesInCart = new Set((cart.items || []).map(i => String(i.category || "").toLowerCase()));

  if (e.minCartValue != null) {
    if (cartValue < Number(e.minCartValue)) return { ok: false, reason: "min cart value not met" };
  }

  if (e.applicableCategories && e.applicableCategories.length > 0) {
    // valid if at least one item in cart is from these categories
    const accepted = e.applicableCategories.map(x => String(x).toLowerCase());
    const found = [...accepted].some(cat => categoriesInCart.has(cat));
    if (!found) return { ok: false, reason: "no applicable categories in cart" };
  }

  if (e.excludedCategories && e.excludedCategories.length > 0) {
    const excluded = e.excludedCategories.map(x => String(x).toLowerCase());
    const found = [...excluded].some(cat => categoriesInCart.has(cat));
    if (found) return { ok: false, reason: "excluded category present" };
  }

  if (e.minItemsCount != null) {
    if (itemsCount < Number(e.minItemsCount)) return { ok: false, reason: "min items count not met" };
  }

  return { ok: true };
}

/* -----------------------
   Compute discount amount for eligible coupon
   ----------------------- */
function computeDiscountAmount(coupon, cart) {
  const cartValue = computeCartValue(cart);
  if (coupon.discountType === "FLAT") {
    return Math.min(Number(coupon.discountValue || 0), cartValue); // can't exceed cart
  } else if (coupon.discountType === "PERCENT") {
    const raw = (Number(coupon.discountValue || 0) / 100) * cartValue;
    if (coupon.maxDiscountAmount != null) {
      return Math.min(raw, Number(coupon.maxDiscountAmount));
    }
    return raw;
  }
  return 0;
}

/* -----------------------
   API: Best coupon
   POST /api/best-coupon
   Body: { user: {...}, cart: {...} }
   Returns: { success: true, best: { coupon, discountAmount, finalAmount } | null }
   ----------------------- */
app.post("/api/best-coupon", (req, res) => {
  try {
    const { user, cart } = req.body || {};

    if (!cart || !Array.isArray(cart.items)) {
      return res.status(400).json({ success: false, message: "Invalid cart" });
    }
    // user is optional (could be guest); but many eligibility checks rely on user fields supplied as input.

    const now = nowDate();
    const cartValue = computeCartValue(cart);

    // Evaluate coupons
    const eligibleList = [];
    for (const c of coupons) {
      const check = checkEligibility(c, user, cart);
      if (!check.ok) {
        continue;
      }
      // compute discount amount
      const discountAmount = computeDiscountAmount(c, cart);
      if (discountAmount <= 0) continue; // ignore zero discounts
      const finalAmount = Math.max(0, cartValue - discountAmount);
      eligibleList.push({
        coupon: c,
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
      });
    }

    if (eligibleList.length === 0) {
      return res.json({ success: true, best: null });
    }

    // Choose best: highest discountAmount, tie -> earliest endDate, tie -> lexicographically smaller code
    eligibleList.sort((a, b) => {
      if (b.discountAmount !== a.discountAmount) return b.discountAmount - a.discountAmount;
      const aEnd = a.coupon.endDate ? new Date(a.coupon.endDate) : new Date(8640000000000000);
      const bEnd = b.coupon.endDate ? new Date(b.coupon.endDate) : new Date(8640000000000000);
      if (aEnd.getTime() !== bEnd.getTime()) return aEnd.getTime() - bEnd.getTime();
      const ac = normalizeCode(a.coupon.code);
      const bc = normalizeCode(b.coupon.code);
      if (ac < bc) return -1;
      if (ac > bc) return 1;
      return 0;
    });

    const best = eligibleList[0];

    // Do NOT mutate usage unless caller confirms apply. But assignment expects "Not exceeding usageLimitPerUser" check only.
    return res.json({ success: true, best });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------
   Optional: apply coupon endpoint (to consume usage)
   POST /api/apply-coupon
   Body: { user: {...}, cart: {...}, code: "CODE" }
   This will validate and (if valid) increment user's usage in memory.
   ----------------------- */
app.post("/api/apply-coupon", (req, res) => {
  try {
    const { user, cart, code } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: "code required" });
    const coupon = coupons.find(c => normalizeCode(c.code) === normalizeCode(code));
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    // eligibility
    const check = checkEligibility(coupon, user, cart);
    if (!check.ok) return res.status(400).json({ success: false, message: check.reason || "not eligible" });

    // compute amount
    const discountAmount = Math.round(computeDiscountAmount(coupon, cart) * 100) / 100;
    const cartValue = computeCartValue(cart);
    const finalAmount = Math.round((cartValue - discountAmount) * 100) / 100;

    // increment usage
    if (user && user.userId) {
      userUsage[user.userId] = userUsage[user.userId] || {};
      userUsage[user.userId][coupon.code] = (userUsage[user.userId][coupon.code] || 0) + 1;
    }

    return res.json({ success: true, coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue }, discountAmount, finalAmount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------
   Demo route: get demo user (for reviewers)
   GET /api/demo-user
   ----------------------- */
app.get("/api/demo-user", (req, res) => {
  res.json({ success: true, user: demoUser, note: "Demo user seeded for reviewers. Use email/password provided in README." });
});

/* -----------------------
   Start server
   ----------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Coupon assignment server running on port ${PORT}`);
  console.log("Seeded demo user email:", demoUser.email, "password:", demoUser.password);
});
