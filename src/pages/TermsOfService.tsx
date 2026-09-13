import React from 'react';
import { Download, ExternalLink, FileText, Mail, TriangleAlert, Server, ShieldCheck } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import termsPdf from '../../cx/SquidCloud-Terms-of-Service-Final (1).pdf';

const linkClass = 'text-primary underline underline-offset-4 hover:opacity-80';
const sectionTitleClass = 'text-xl font-semibold md:text-2xl';

const TermsOfService = () => {
  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = termsPdf;
    link.download = 'SquidCloud-Terms-of-Service.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Card className="mb-8">
          <CardHeader className="gap-4 pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-3xl font-bold md:text-4xl">
                  <FileText className="h-6 w-6 text-primary" />
                  Terms of Service
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground md:text-base">
                  Version: 2.0 · Effective Date: 13 September 2026 · Last Updated: 13 September 2026
                </CardDescription>
              </div>
              <Button onClick={downloadPDF} className="w-full md:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-8 text-sm leading-7 text-foreground md:text-base">
          <section className="space-y-4">
            <h2 className={sectionTitleClass}>1. Acceptance of Terms</h2>
            <p>
              By using SquidCloud services, including the web platform, API, CLI, and related features, you agree to
              these Terms of Service.
            </p>
            <p>
              If you do not agree, you must stop using SquidCloud immediately. Material changes are announced by
              dashboard notice (and email where provided) at least 7 days before taking effect. Continued use after
              updates means acceptance of revised terms.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>2. Eligibility</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You must be at least 13 years of age.</li>
              <li>Users 13–18 must have awareness and consent of a parent or legal guardian.</li>
              <li>You must be capable of entering a binding agreement under applicable law.</li>
              <li>You must not be prohibited from using the service in your jurisdiction.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>3. Plans, Billing, and Fees</h2>
            <h3 className="text-lg font-semibold">3.1 Tiers</h3>
            <p>
              SquidCloud offers a Free tier and paid Supporter tiers. The live feature and limit table on the pricing
              page governs day-to-day operation; where marketing copy and these Terms conflict, these Terms prevail.
            </p>
            <h3 className="text-lg font-semibold">3.2 Payments</h3>
            <p>
              Paid plans bill in advance (weekly, monthly, or annual) through our payment processor (currently
              MaxelPay, cryptocurrency). Taxes are your responsibility. We never see or store wallet seeds, private
              keys, or card details.
            </p>
            <h3 className="text-lg font-semibold">3.3 Failed payments</h3>
            <p>
              Failed renewals downgrade you to Free at period end. Stored files stay stored, but anything beyond Free
              limits is refused until you upgrade or return within limits.
            </p>
            <h3 className="text-lg font-semibold">3.4 Refunds</h3>
            <p>
              All fees are non-refundable except where non-excludable applicable law requires otherwise. Cancelling
              stops future renewals; it does not refund the current period.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>4. What “Unlimited” Means</h2>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Short version</p>
                  <p>
                    “Unlimited” means we have not set a fixed number on your account for that feature. It does not
                    mean infinite, guaranteed, instant, or dedicated resources. The servers underneath are finite,
                    shared, and best-effort.
                  </p>
                </div>
              </div>
            </div>
            <h3 className="text-lg font-semibold">4.1 Definition</h3>
            <p>Where a feature is described as “unlimited”, that word means exactly this, and nothing more:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>No fixed numeric cap is configured on your account for that feature at this time.</li>
              <li>It remains subject to fair use (Section 5), abuse controls (Section 10), safety screening (Section 9), and actual infrastructure capacity.</li>
              <li>It is not a guarantee of availability, speed, durability, or infinite capacity. It is not an SLA and promises no dedicated hardware or reserved bandwidth.</li>
            </ul>
            <h3 className="text-lg font-semibold">4.2 What is NOT unlimited today</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>Single-file size: Free 1 GB · Supporter 12 GB.</li>
              <li>Files uploaded per day: Free 20 · Supporter 50 · Supporter+ 100.</li>
              <li>Concurrent transfers: Free 2 · Supporter 10.</li>
              <li>Daily API tokens: Free 1,000 · Supporter 10,000.</li>
              <li>Any quota published with a number next to it.</li>
            </ul>
            <h3 className="text-lg font-semibold">4.3 Server-side reality</h3>
            <p>
              Your account may show no storage cap while buckets, nodes, bandwidth, and database capacity remain
              finite and shared. Uploads may be queued, throttled, or paused during congestion, abuse incidents,
              maintenance, or upstream failures. That is normal best-effort operation — not a service failure and
              not a breach of any “unlimited” statement.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>5. Fair Use</h2>
            <p>“Unlimited” covers normal personal-cloud use: your files, your shares, ordinary integrations. Not fair use:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Reselling or renting SquidCloud storage, bandwidth, or API access to third parties.</li>
              <li>Public download mirrors, mass-redistribution hubs, or hotlinking farms.</li>
              <li>Bulk harvesting or archiving third-party content you do not own; using storage as a high-traffic CDN.</li>
              <li>Mining, farming, plotting, or proof-of-storage schemes.</li>
              <li>Splitting one workload across accounts to evade limits, suspensions, or bans.</li>
            </ul>
            <p>
              Unfair use may be throttled, capped, queued, or suspended with notice where practicable. Repeated or
              egregious unfair use is treated as abuse.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>6. Limits We May Introduce</h2>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <Server className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Reservation of rights</p>
                  <p>
                    We may introduce quotas, rate limits, file-size caps, file-type rules, or retention policies on
                    any feature — including features currently “unlimited” — for stability, security, legal
                    compliance, or viability, with at least 7 days dashboard notice except for emergencies. Stored
                    files are never deleted solely because of a new limit; new operations beyond it are refused.
                    “Unlimited” describes the current configuration, not a promise about the future.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>7. Your Account</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You are responsible for all activity under your account.</li>
              <li>Keep credentials and API keys private and revoke promptly if compromised.</li>
              <li>Provide accurate information and do not impersonate others.</li>
              <li>One account per person; multiplying free quotas or evading bans via extra accounts terminates all related accounts.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>8. Storage Options</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Managed storage</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Client-side encryption and chunking create opaque blobs on SquidCloud-managed buckets. Finite,
                  shared capacity — see Sections 4–6.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">BYOS</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  External provider storage remains under your provider terms and your cost responsibility.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">BYOK</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Your encryption key never reaches SquidCloud; key loss cannot be recovered by us.
                </CardContent>
              </Card>
            </div>
            <p>
              GitHub Terms:{' '}
              <a
                href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service"
                target="_blank"
                rel="noreferrer noopener"
                className={linkClass}
              >
                docs.github.com
              </a>
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>9. Safety Screening (S-Hawk)</h2>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Metadata only — never your content</p>
                  <p>
                    Screening examines a metadata manifest your own device assembles before encryption (filename,
                    size, file type, media attributes, structure descriptors, hashes). Your file content is never
                    decrypted, read, or transmitted for screening.
                  </p>
                </div>
              </div>
            </div>
            <ul className="list-disc space-y-2 pl-6">
              <li>Violating uploads and shares are refused before anything is stored or distributed.</li>
              <li>You are told exactly why, with reason codes and a plain-language explanation, in-app and in your account notices.</li>
              <li>Cases are forwarded to KZA security review; severity and repetition can trigger time-boxed upload suspensions.</li>
              <li>Every refusal can be appealed from Settings → Security (Upload Appeals). Appeals go to human review and never count against you.</li>
              <li>Screening is reasonable-efforts automation, not a guarantee in either direction. You remain responsible for the lawfulness of your content.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>10. Acceptable Use</h2>
            <p>Permitted uses include personal/professional storage, automation, and API-based integrations.</p>
            <h3 className="text-lg font-semibold">10.1 Prohibited Content and Activities</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>Pirated content, malware, fraud tooling, or illegal content.</li>
              <li>Hate speech, violence promotion, terrorism-related content, or abusive spam.</li>
              <li>Unauthorized access attempts, scraping beyond normal API use, or security bypasses.</li>
              <li>Ban evasion, limit evasion, and commercial resale of “unlimited” features.</li>
            </ul>
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Zero-tolerance rule</p>
                  <p>
                    CSAM and content sexualizing minors are strictly prohibited, trigger immediate permanent
                    termination, and are reported to relevant authorities without exception.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>11. Your Data and Files</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You retain ownership of your uploaded and managed data.</li>
              <li>SquidCloud acts as a storage coordination platform and does not read your file content — including for screening.</li>
              <li>You are responsible for lawfulness and rights to any content you store.</li>
              <li>Maintain independent backups. SquidCloud is not a backup service and provides no durability or availability SLA — “unlimited” does not change this.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>12. API and Developer Usage</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>API keys are account-scoped and API calls are logged for security.</li>
              <li>Rate limits, daily quotas (tokens, file counts, file sizes), and concurrency caps are enforced per tier.</li>
              <li>BYOS third-party provider costs remain your responsibility.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>13. Suspension, Termination, Deletion, and Appeal</h2>
            <h3 className="text-lg font-semibold">13.1 Enforcement ladder</h3>
            <p>
              Warning → time-boxed upload suspension → account suspension → permanent termination. CSAM, active
              attacks, and ban evasion skip the ladder: immediate permanent termination plus reporting where the law
              requires.
            </p>
            <h3 className="text-lg font-semibold">13.2 Appeal</h3>
            <p>
              Suspensions and refusals can be appealed from Settings → Security (Upload Appeals) with human review,
              decided within 7 business days where practicable.
            </p>
            <h3 className="text-lg font-semibold">13.3 Deletion by you</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>Request deletion via verified email. Data we control is permanently removed per our retention schedule.</li>
              <li>BYOS content must be deleted through the connected provider.</li>
              <li>Deletion is irreversible and does not refund paid fees.</li>
            </ul>
            <h3 className="text-lg font-semibold">13.4 Termination by us</h3>
            <p>
              We may suspend or terminate for violations, security risk, illegal activity, false registration data,
              chronic non-payment, or sustained unfair use — with notice and a retrieval chance where practicable
              and lawful, except CSAM, attacks, and evasion (no notice, no retrieval).
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>14. Availability and Uptime</h2>
            <p>
              Best-effort service; no uptime, throughput, or performance guarantees. Not liable for downtime,
              congestion-driven queuing or intake pauses, hosting/network/DNS issues, or upstream provider failures.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>15. Limitation of Liability</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Service is provided &quot;as is&quot; and &quot;as available&quot;.</li>
              <li>No warranties, express or implied, of reliability, durability, or fitness for purpose.</li>
              <li>No liability for indirect, incidental, special, consequential, or punitive damages.</li>
              <li>No liability for data loss, screening refusals, suspensions, key loss, or third-party failures.</li>
              <li>Total aggregate liability is capped at the fees you actually paid in the 3 months before the claim — or INR 500 if you paid less or nothing.</li>
              <li>Nothing here limits liability for fraud, willful misconduct, or non-excludable legal obligations.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>16. Indemnification</h2>
            <p>
              You indemnify SquidCloud and its operators against claims, damages, losses, and reasonable legal fees
              arising from your violations, your content, your law-breaking, or your third-party providers.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>17. Intellectual Property</h2>
            <p>
              Platform code, design, branding, and infrastructure belong to SquidCloud. You retain your content
              rights, granting only the limited license needed to store, retrieve, and transmit your encrypted
              chunks at your direction.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>18. Privacy Policy Link</h2>
            <p>
              Your use of SquidCloud is also governed by our Privacy Policy:{' '}
              <a
                href="https://squidcloud.vercel.app/privacy"
                target="_blank"
                rel="noreferrer noopener"
                className={linkClass}
              >
                squidcloud.vercel.app/privacy
              </a>
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>19. Governing Law and Disputes</h2>
            <p>
              Governed by the laws of India. Disputes go first to direct resolution at hellosquidcloud@gmail.com
              within 30 days; unresolved disputes fall under competent Indian courts.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>20. Severability</h2>
            <p>Unenforceable clauses are narrowed or severed; the rest stands.</p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>21. Entire Agreement</h2>
            <p>These Terms plus the Privacy Policy are the entire agreement, superseding all prior understandings.</p>
          </section>

          <Separator />

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <span className="font-medium">Email: </span>
                <a href="mailto:hellosquidcloud@gmail.com" className={linkClass}>
                  hellosquidcloud@gmail.com
                </a>
              </p>
              <p className="flex items-center gap-1">
                <span className="font-medium">Website: </span>
                <a
                  href="https://squidcloud.vercel.app"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  squidcloud.vercel.app
                </a>
                <ExternalLink className="h-4 w-4 text-primary" />
              </p>
              <div className="pt-1">
                <Badge variant="secondary">We aim to respond within 48 hours on business days.</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
