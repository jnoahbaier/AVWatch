import Link from 'next/link';
import { MapPin, Shield, BarChart3, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                AV Watch
              </span>
            </h1>
            <p className="mt-4 text-xl text-slate-300">
              A Transparent Platform for Autonomous Vehicle Accountability
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-400">
              Report incidents. Track data. Hold AV companies accountable.
              Together, we're building a safer future for everyone on our
              streets.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/report"
                className="rounded-lg bg-green-500 px-6 py-3 text-lg font-semibold text-white shadow-lg transition hover:bg-green-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
              >
                Report an Incident
              </Link>
              <Link
                href="/map"
                className="rounded-lg border border-slate-600 px-6 py-3 text-lg font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Explore the Map →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Empowering Communities
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              Whether you're a pedestrian, cyclist, or driver, your voice
              matters.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<MapPin className="h-8 w-8" />}
              title="Report Incidents"
              description="Quick, geo-located incident reporting from anywhere in the Bay Area."
              color="green"
            />
            <FeatureCard
              icon={<BarChart3 className="h-8 w-8" />}
              title="Data Dashboard"
              description="Explore trends, heatmaps, and company comparisons in real-time."
              color="blue"
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="Verified Data"
              description="Crowdsourced reports combined with official NHTSA and DMV data."
              color="purple"
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Community Driven"
              description="Built for and by the communities where robotaxis operate."
              color="orange"
            />
          </div>
        </div>
      </section>

      {/* Stats Preview */}
      <section className="bg-slate-100 dark:bg-slate-800/50 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <StatCard value="0" label="Reports Submitted" />
            <StatCard value="0" label="Verified Incidents" />
            <StatCard value="1" label="Cities Covered" />
            <StatCard value="3" label="Data Sources" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 p-8 text-center shadow-xl sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Witnessed an AV incident?
            </h2>
            <p className="mt-4 text-lg text-green-100">
              Your report helps build a comprehensive picture of AV safety in
              our communities.
            </p>
            <Link
              href="/report"
              className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-lg font-semibold text-green-600 shadow-lg transition hover:bg-green-50"
            >
              Submit a Report
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'green' | 'blue' | 'purple' | 'orange';
}) {
  const colorClasses = {
    green:
      'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple:
      'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange:
      'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <div className="flex flex-col items-center rounded-xl bg-white p-6 text-center shadow-sm dark:bg-slate-800">
      <div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-4xl font-bold text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{label}</p>
    </div>
  );
}

