import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center py-10 px-4 md:px-8">
      <div className="w-full max-w-4xl bg-card rounded-2xl border border-border shadow-sm p-6 md:p-10">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-muted-foreground">Last updated: September 12, 2025</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="size-4 mr-1.5" />
              Home
            </Link>
          </Button>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Introduction</h2>
            <p>
              At myHisaab, we take your privacy seriously. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you visit our website and use our attendance,
              payroll, and field tracking services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Location Data Usage</h2>
            <p className="mb-2">
              myHisaab collects and processes location data for specific features of our workforce
              management platform:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Attendance Verification:</strong> Location data is
                captured when you clock in or clock out to verify designated workplace boundaries.
              </li>
              <li>
                <strong className="text-foreground">Live Tracking:</strong> Realtime coordinates are
                optionally recorded during designated shift hours for field teams and visit reporting.
              </li>
              <li>
                <strong className="text-foreground">Geofencing:</strong> Virtual fences determine
                authorized check-in radii around office sites or client locations.
              </li>
              <li>
                <strong className="text-foreground">Data Security:</strong> All location payloads are
                encrypted in transit and stored safely according to regulatory standards.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Data Retention & Rights</h2>
            <p>
              We retain attendance, payroll, and personal data as required to fulfill our contractual
              obligations with your employing firm. You may request corrections or export of your personal
              profile records through your organization's administrative team.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
