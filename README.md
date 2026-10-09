# 🏙️ NagarBondhu AI (নগরবন্ধু এআই)
### AI-Powered Urban Problem Intelligence & Planning Support Platform
Admin action recommendations, assignments, progress and persistence: [workflow and API documentation](docs/admin-actions.md), [Render deployment](docs/render-deployment.md).
**Target City:** Rajshahi, Bangladesh  
**Competition:** BIP Apps4Solutions Competition  
**Core Differentiator:** Moving beyond mere citizen complaint collection toward **explainable AI-driven urban problem intelligence, automated duplicate detection, deterministic priority scoring, and spatial planning support.**

---

## 🎯 1. Product Vision & Differentiator

Typical civic apps are merely static ticketing systems where citizen complaints sit unanalyzed in administrative backlogs. **NagarBondhu AI** transforms citizen reports into structured, location-aware intelligence for decision-makers and urban planners:

1. **Bengali Complaint Intelligence:** Citizens submit complaints in natural colloquial Bengali (or English). The AI classifies categories (`ROAD_DAMAGE`, `WATERLOGGING`, `DRAINAGE`, `WASTE`, `FOOTPATH`, `STREETLIGHT`, `OTHER`), generates summaries, gauges severity, and identifies missing information.
2. **Transparent Priority Engine:** Uses a deterministic, explainable multi-factor formula ($P = 20 \times (0.40S + 0.30I + 0.20R + 0.10D)$) instead of opaque black-box guessing. Life-critical hazards automatically trigger safety alerts.
3. **Automated Duplicate Report Detection:** Correlates geographic proximity (Haversine formula), category relevance, and Bengali/English text similarity to prevent duplicated fieldwork and identify recurrence hotspots.
4. **Spatial Planning & Hotspot Analytics:** Visualizes problem clusters across Rajshahi (Shaheb Bazar Zero Point, Talaimari, RU Motihar, Kazihata, Upashahar) with live database aggregations and actionable recommendations.

> **Disclaimer:** *NagarBondhu AI is an independent urban planning and decision-support prototype. It is not an official municipal tool affiliated with or integrated into the internal systems of the Rajshahi City Corporation (RCC).*

---

## ⚡ 2. 90-Second Competition Demo Walkthrough

Judges can test the entire end-to-end loop in 90 seconds:

| Step | Action | What to Observe |
| :--- | :--- | :--- |
| **1. Intro (10s)** | Launch NagarBondhu AI mobile app & backend | Professional civic identity with bilingual Bengali/English branding and live Rajshahi statistics. |
| **2. Report (20s)** | Go to **"সমস্যা রিপোর্ট করুন"**, select **"তালাইমারী শহীদ মিনার"**, enter description: `তালাইমারী মোড়ে ড্রেন উপচে নোংরা পানির তীব্র জলাবদ্ধতা সৃষ্টি হয়েছে` | Tap **"এআই বিশ্লেষণ চালান"** — Watch live AI extract `WATERLOGGING`, 5/5 severity, Bengali reasons, and missing info. |
| **3. Submit (15s)** | Tap **"রিপোর্ট জমা দিন"** | Report is immediately stored in the database, deterministic priority is scored ($P = 86$), and duplicates are checked. |
| **4. Problem Map (15s)** | Switch to **"সমস্যার ম্যাপ"** | See color-coded markers in Rajshahi. Filter by category (e.g., সড়ক ক্ষতি, জলাবদ্ধতা). Tap marker to inspect details card. |
| **5. Duplicate Detection (10s)** | Inspect **Shaheb Bazar Zero Point** reports | View flagged duplicate pair (`rep-001` & `rep-002`) showing 62m distance, 58% text similarity, and moderation buttons. |
| **6. Planning Dashboard (20s)** | Switch to **"ড্যাশবোর্ড"** (Toggle Admin/Planner mode) | View live database aggregates: Category distributions, Ward breakdowns, Hotspots, and top recommended actions to investigate first. |

---

## 🏗️ 3. Tech Stack & Monorepo Structure

```
nagarbondhu-ai/
├── apps/
│   ├── api/                   # Express.js + TypeScript + Prisma + Google Gemini AI
│   │   ├── prisma/            # Schema, migrations, and seed script
│   │   ├── public/            # Dedicated Responsive Web Application (Leaflet Map + Tailwind)
│   │   ├── src/
│   │   │   ├── routes/        # Auth, Reports, AI, Map, Duplicate, Dashboard, Admin
│   │   │   ├── services/      # Gemini AI, Priority Engine, Duplicate Detection, Insights
│   │   │   ├── middleware/    # JWT Auth, Role-based Access Control (RBAC), Error Handler
│   │   │   └── db.ts          # Database repository with PostgreSQL & standalone store
│   │   ├── tests/             # Automated test suite (Jest + Supertest)
│   │   └── Dockerfile         # Multi-stage production container
│   └── mobile/                # React Native / Expo Mobile Application
│       ├── App.tsx            # Bengali-first mobile UI with 5 full screens & modal views
│       └── src/services/      # API client service with configurable endpoint
├── packages/
│   └── shared/                # Shared TypeScript types, Bengali metadata, formulas
│       └── src/
│           ├── types.ts       # Enums, models, interfaces
│           ├── priority.ts    # Deterministic priority calculation formula
│           ├── similarity.ts  # Haversine distance & text similarity algorithms
│           └── bengali.ts     # Bengali category & status metadata, Rajshahi wards
├── docker-compose.yml         # PostgreSQL 16 + PostGIS & API container orchestration
├── .env.example               # Environment template
└── README.md
```

---

## 🧮 4. Core Algorithms

### 1. Explainable Priority Formula
$$P = 20 \times (0.40S + 0.30I + 0.20R + 0.10D)$$
- **$S$ (Severity):** 1 to 5 (from AI complaint classification or inspector)
- **$I$ (Estimated Impact):** 1 to 5 (population density / traffic flow affected)
- **$R$ (Recurrence):** 1 to 5 (frequency of related reports at location)
- **$D$ (Age Factor):** 1 to 5 ($0\text{-}1\text{d}=1, 2\text{-}3\text{d}=2, 4\text{-}7\text{d}=3, 8\text{-}14\text{d}=4, 15+\text{d}=5$)
- **Thresholds:**
  - `CRITICAL` ($\ge 85$ or urgent safety trigger)
  - `HIGH` ($\ge 65$)
  - `MEDIUM` ($\ge 45$)
  - `LOW` ($< 45$)

### 2. Duplicate Detection Engine
Calculates spatial proximity using the **Haversine Great-Circle Formula**:
$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
Combined with **Bengali tokenized Jaccard similarity**:
$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
Reports within 300m sharing related categories and linguistic similarity are flagged for administrator review without deleting citizen submissions.

---

## 🚀 5. Getting Started & Setup

### Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- npm or yarn
- Docker & Docker Compose *(optional for containerized PostgreSQL)*

### Quick Start (Local Development)

1. **Clone and Install Dependencies:**
   ```bash
   # Build shared package
   cd packages/shared
   npm install
   npm run build

   # Install API dependencies
   cd ../../apps/api
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `apps/api/.env`:
   ```bash
   cp .env.example apps/api/.env
   ```
   *(Optional)* Add your free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/):
   ```env
   GEMINI_API_KEY="AIzaSy..."
   ```
   *Note: If no API key is provided, the platform automatically activates its built-in rule-based Bengali heuristic analyzer so all features work seamlessly out of the box!*

3. **Run Automated Tests:**
   ```bash
   cd apps/api
   npm test
   ```
   Verifies report creation, authentication, AI schemas, deterministic priority scores, duplicate detection, and dashboard queries.

4. **Start Backend & Web App (Unified Port 5000):**
   ```bash
   cd apps/api
   npm run dev
   ```
   - 💻 **On your PC Browser:** Open `http://localhost:5000` to launch the **NagarBondhu AI Web App**!
   - 📱 **On your Phone Browser (Chrome / Safari):** Open `http://192.168.0.67:5000` — full responsive touch UI, interactive map, photo reporting & dashboard with **zero app installation required**!

5. **Start Expo Mobile App (Optional):**
   ```bash
   cd apps/mobile
   npm start
   # Press 'w' for web, or scan with Expo Go using --tunnel or --lan
   ```

---

## 🐳 6. Docker Deployment

To launch the full PostgreSQL 16 + PostGIS database and Express API container:
```bash
docker compose up --build -d
```
The API becomes available at `http://localhost:5000/api/v1/health`.

---

## 🔑 7. Demo Accounts & Credentials

The seed database comes preloaded with illustrative Rajshahi sample data:
- **Demo Urban Planner / Admin:**
  - Email: `admin@nagarbondhu.gov.bd`
  - Password: `DemoAdmin123!`
  - Role: `ADMIN`
- **Demo Citizen:**
  - Email: `citizen@rajshahi.test`
  - Password: `Citizen123!`
  - Role: `CITIZEN`

---

## 📡 8. REST API Documentation

### Authentication
- `POST /api/v1/auth/register` — Register a citizen account
- `POST /api/v1/auth/login` — Login & receive JWT token
- `GET /api/v1/auth/me` — Get authenticated profile

### Reports
- `POST /api/v1/reports` — Submit complaint (triggers AI, Priority & Duplicate check)
- `GET /api/v1/reports` — Filterable public report feed (sanitized privacy)
- `GET /api/v1/reports/:id` — Report details with history & AI audit
- `PATCH /api/v1/reports/:id` — Edit report
- `GET /api/v1/users/me/reports` — Citizen's personal submissions

### AI & Planning Intelligence
- `POST /api/v1/ai/analyze-complaint` — Real-time preview of Bengali complaint
- `POST /api/v1/reports/:id/analyze` — Re-analyze existing report
- `GET /api/v1/map/reports` — Lightweight geospatial coordinates & categories
- `GET /api/v1/reports/:id/possible-duplicates` — Duplicate candidates for report
- `POST /api/v1/duplicates/:id/review` — Admin confirms or dismisses duplicate
- `GET /api/v1/dashboard/summary` — Real DB stats (Categories, Wards, Hotspots)
- `GET /api/v1/dashboard/insights` — Synthesized planning intelligence
- `PATCH /api/v1/admin/reports/:id/status` — Status transition with audit trail
- `PATCH /api/v1/admin/reports/:id/priority` — Priority override with audit reason

Citizen tracking, protected operations, GIS/Copilot and planning exports: [implementation and operator setup](docs/full-platform-upgrade.md).
