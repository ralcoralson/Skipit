# SkipIt 3.0 — Peer-to-Peer Rental Marketplace

> **Tagline:** Skip Buying. Rent Smarter.  
> **Business Model:** 100% Free Open Marketplace • 0% Platform Commission • No Middlemen Payment Gateways • Direct User-to-User Communication & Agreements.

---

## 1. Executive Product Summary

SkipIt is a modern peer-to-peer rental discovery and marketplace platform built from scratch to allow individuals to list items they own and make them available for rent. Other users discover these items, contact the owners directly through real-time chat, agree on rental terms and security deposits, and arrange handovers independently.

### Strict Business Requirements Enforced
- **0% Commission:** The platform does not take cuts from transactions.
- **No Razorpay / No Payment Gateway:** No integrated checkouts, mandatory platform fees, or escrow holds.
- **Direct P2P Negotiations:** Users independently decide rental duration, daily rates, security deposits, and pickup/delivery terms.
- **Trust & Verification Infrastructure:** Built-in mobile phone OTP verification, optional government ID verification (KYC), community trust scores, and two-way reviews.

---

## 2. Technology Architecture

```
skipit 3.0/
├── apps/
│   ├── backend/         # Node.js + Express REST API + Real-time WebSocket Server
│   ├── web/             # Next.js 14 + React + TypeScript + Tailwind CSS Marketplace & Admin
│   └── mobile/          # Flutter 3.38 + Dart 3.10 + Riverpod + Material 3 iOS/Android App
├── infrastructure/
│   └── supabase/        # PostgreSQL Migrations & RLS Policies
├── package.json         # Monorepo Workspace Configuration
└── .env                 # Production-Ready Environment Configuration
```

### Mobile Application (`apps/mobile`)
- **Framework:** Flutter 3.38.2, Dart 3.10
- **State Management:** Riverpod (`flutter_riverpod: ^2.6.1`)
- **Navigation:** Declarative routing with `go_router` and `StatefulShellRoute`
- **UI System:** Material 3 with custom SkipIt Design System (Emerald Green `#059669`, Slate Navy `#0F172A`)
- **Networking:** Dio HTTP Client with auth token interceptor & `web_socket_channel` for real-time messaging
- **Supported Targets:** Android & iOS

### Web Application & Admin Portal (`apps/web`)
- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS with custom typography and brand tokens
- **Marketplace Pages:** Home, Search & Multi-filter Explore, Listing Details, Listing Creation, Real-time Chat, User Profile & Wishlist
- **Administration Dashboard (`/admin`):** Role-based access control (Admin/Moderator), platform metrics, user suspension/reinstatement, KYC document inspection, and report moderation

### Backend & Real-Time Engine (`apps/backend`)
- **Runtime:** Node.js v22 & Express.js
- **Real-Time Communication:** Dedicated WebSocket Server (`ws://localhost:5000`) for live messaging, typing indicators, read receipts, and presence
- **Security:** Helmet, CORS, Express Rate Limiting, JWT authentication, and Zod input validation
- **Storage:** Integrated Supabase Storage client for product image galleries (`listing-images`), avatars (`avatars`), and KYC ID documents (`kyc-documents`)

### Database (`infrastructure/supabase`)
- **Database Engine:** Supabase / PostgreSQL
- **Key Tables:** `profiles`, `categories`, `listings`, `messages`, `wishlists`, `reviews`, `reports`, `notifications`, `audit_log`
- **Security:** Row Level Security (RLS) policies and role-based permissions

---

## 3. Quickstart & Running Instructions

### Prerequisites
- Node.js >= 18
- Flutter SDK >= 3.0
- Git

### 1. Backend Server
```bash
# In apps/backend
cd apps/backend
npm install
npm start
# Server runs on http://localhost:5000 (REST API: /api/v1, WebSocket: ws://localhost:5000)
```

To run automated backend tests:
```bash
npm test
```

### 2. Web Application & Admin Portal
```bash
# In apps/web
cd apps/web
npm install
npm run dev   # Or npm run build && npm run start for production
# Web marketplace is accessible at http://localhost:3000
# Admin portal is accessible at http://localhost:3000/admin
```

### 3. Flutter Mobile Application
```bash
# In apps/mobile
cd apps/mobile
flutter pub get
flutter run
# Or connect directly to local backend:
flutter run --dart-define=API_BASE_URL=http://localhost:5000/api/v1
```

To run mobile automated tests:
```bash
flutter test
```

---

## 4. REST API Endpoint Directory

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/v1/health` | Health & mode check | No |
| `POST` | `/api/v1/auth/otp/send` | Send mobile verification OTP | No |
| `POST` | `/api/v1/auth/otp/verify` | Verify OTP & issue session token | No |
| `POST` | `/api/v1/auth/login` | Email/password sign-in | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | Yes |
| `PUT` | `/api/v1/auth/profile` | Update profile information | Yes |
| `POST` | `/api/v1/auth/kyc/submit` | Upload government ID & selfie | Yes |
| `GET` | `/api/v1/categories` | List all rental categories | No |
| `GET` | `/api/v1/listings` | Search & filter listings | Optional |
| `GET` | `/api/v1/listings/featured` | Fetch trending & featured listings | No |
| `GET` | `/api/v1/listings/:id` | Listing details with owner & reviews | Optional |
| `POST` | `/api/v1/listings` | Publish new rental item with images | Yes |
| `PATCH`| `/api/v1/listings/:id/toggle-status` | Pause / resume listing | Yes |
| `DELETE`| `/api/v1/listings/:id` | Delete personal listing | Yes |
| `GET` | `/api/v1/chat/conversations` | List user chat conversations | Yes |
| `GET` | `/api/v1/chat/messages/:peerId` | Fetch message history with peer | Yes |
| `POST` | `/api/v1/chat/messages` | Send message (REST fallback) | Yes |
| `POST` | `/api/v1/chat/inquiry` | Send rental inquiry from listing | Yes |
| `GET` | `/api/v1/wishlist` | Fetch saved wishlist listings | Yes |
| `POST` | `/api/v1/wishlist` | Add item to wishlist | Yes |
| `DELETE`| `/api/v1/wishlist/:id` | Remove item from wishlist | Yes |
| `POST` | `/api/v1/reviews` | Submit 2-way peer review & rating | Yes |
| `POST` | `/api/v1/reports` | Submit Trust & Safety flag | Yes |
| `GET` | `/api/v1/admin/metrics` | Dashboard analytics | Admin/Mod |
| `GET` | `/api/v1/admin/users` | List platform users | Admin/Mod |
| `PATCH`| `/api/v1/admin/users/:id/ban` | Suspend / reinstate user | Admin |
| `GET` | `/api/v1/admin/kyc/submissions` | Inspect KYC queue | Admin/Mod |
| `PATCH`| `/api/v1/admin/kyc/submissions/:id/review` | Approve / reject KYC | Admin |

---

## 5. Security, Trust & Rental Pricing Architecture

### Tiered Rental Pricing Formula
SkipIt calculates rental totals dynamically based on the listing's configured duration rates:
1. **Monthly Tier:** If `price_per_month` is configured and duration >= 30 days: `full_months = Math.floor(days / 30)`. Charges `full_months * price_per_month`.
2. **Weekly Tier:** If `price_per_week` is configured and remaining days >= 7: `full_weeks = Math.floor(remaining_days / 7)`. Charges `full_weeks * price_per_week`.
3. **Daily Tier:** Remaining days are charged at `remaining_days * price_per_day`.
4. **Fallback:** If neither weekly nor monthly rate is set, the total is `total_days * price_per_day`.
5. **Security Deposit:** Any refundable deposit is displayed separately and settled directly between owner and renter upon equipment handover.

### Mobile Release & Distribution
Mobile application binaries are distributed through standard, sanctioned distribution channels rather than being served via local server disk paths:
- **Android:**
  - Build signed release APK / AAB:
    ```bash
    cd apps/mobile
    flutter build appbundle --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1 --dart-define=WS_URL=wss://api.yourdomain.com
    ```
  - Distribution via Google Play Console (Internal Testing / Production tracks) or signed standalone APKs via GitHub Releases.
- **iOS:**
  - Build signed IPA:
    ```bash
    cd apps/mobile
    flutter build ipa --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1 --dart-define=WS_URL=wss://api.yourdomain.com
    ```
  - Distribution via Apple TestFlight and App Store Connect.

---

## 6. Security & Trust Architecture
- **No Client Exposure:** Elevated service-role Supabase keys remain strictly server-side.
- **Audit Trails:** Administrative suspensions, KYC approvals, and moderation actions are logged to `audit_log`.
- **Image Validation:** Multi-part file uploads validate file size (<= 10MB) and MIME formats (JPEG, PNG, WebP).
- **Rate Limiting:** Protects authentication and general endpoints from brute-force attempts.
