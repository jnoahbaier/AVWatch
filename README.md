# 🚗 AV Watch

**A Transparent Platform for Autonomous Vehicle Accountability**

AV Watch is a community-driven platform that enables pedestrians, cyclists, and drivers to report autonomous vehicle incidents, fostering transparency and accountability in cities where robotaxis operate.

---

## 🎯 Mission

We believe AV companies can make transportation safer and more accessible, but only if they are held accountable by—and foster trust with—the communities they operate in.

## ✨ Features

- **📱 Incident Reporting** — Submit reports via mobile or web with geolocation, photos, and incident details
- **🗺️ Interactive Map** — Explore incidents across the Bay Area with filtering by type, company, and date
- **📊 Data Dashboard** — City and company-level views with heatmaps and trend analysis
- **🔗 Open Data** — Aggregated public data from NHTSA, CPUC, and CA DMV alongside community reports

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Mapbox account ([Get token](https://account.mapbox.com/))

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/avwatch.git
cd avwatch

# Frontend
cd frontend
npm install

# Create .env.local with your keys
echo "NEXT_PUBLIC_SUPABASE_URL=https://tmhoogcagflhizyghakp.supabase.co" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key" >> .env.local
echo "NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token" >> .env.local

npm run dev
```

Visit `http://localhost:3000` for the application.

### Supabase Project

- **Dashboard**: [supabase.com/dashboard/project/tmhoogcagflhizyghakp](https://supabase.com/dashboard/project/tmhoogcagflhizyghakp)
- **API URL**: `https://tmhoogcagflhizyghakp.supabase.co`

## 📁 Project Structure

```
avwatch/
├── frontend/          # Next.js 14 application
├── backend/           # FastAPI Python API
├── data/              # Raw data files (gitignored)
├── docs/              # Documentation & research
└── docker-compose.yml # Local development stack
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, Mapbox GL, Recharts |
| Backend | Supabase (PostgreSQL + PostGIS, Edge Functions, Auth) |
| Data Sync | pg_cron, NHTSA SGO API |
| CI/CD | GitHub Actions, Vercel |

## 📊 Data Sources

- [NHTSA Standing General Order](https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting) — Crash reports
- [CA DMV Autonomous Vehicle Reports](https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/) — Collision & disengagement reports
- [CPUC Quarterly Reports](https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting) — Operational data

## 👥 Team

- **Noah Baier** — Backend Engineer & Data Scientist
- **Monica Paz Parra** — UX Designer & Frontend Lead
- **Evan Haas** — User Researcher & Product Manager
- **Joshua Mussman** — Research Lead

**Advisor:** Dr. Morgan Ames, UC Berkeley School of Information

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

*Built with ❤️ at UC Berkeley School of Information*

