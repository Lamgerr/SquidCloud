import React from 'react';
import { Download, ExternalLink, Mail, Shield, ShieldCheck, TriangleAlert } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import privacyPdf from '../../cx/SquidCloud-Privacy-Policy-Final (1).pdf';

const linkClass = 'text-primary underline underline-offset-4 hover:opacity-80';
const sectionTitleClass = 'text-xl font-semibold md:text-2xl';

const PrivacyPolicy = () => {
  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = privacyPdf;
    link.download = 'SquidCloud-Privacy-Policy.pdf';
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
                  <Shield className="h-6 w-6 text-primary" />
                  Privacy Policy
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
            <h2 className={sectionTitleClass}>1. Introduction</h2>
            <p>
              SquidCloud (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy.
              This policy applies to all SquidCloud services, platforms, APIs, CLI tools, and web interfaces.
            </p>
            <p>
              By accessing or using SquidCloud, you acknowledge that you have read and understood this Privacy Policy.
              If you do not agree, please discontinue use immediately.
            </p>
            <p>
              Material changes are announced by dashboard notice and email at least 7 days before taking effect.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>2. Information We Collect</h2>
            <h3 className="text-lg font-semibold">2.1 Account and identity</h3>
            <p>
              Username, email, profile fields, account timestamps, authentication events, session tokens, MFA/passkey
              enrollment facts (never secrets), and linked OAuth identifiers.
            </p>
            <h3 className="text-lg font-semibold">2.2 File and storage metadata</h3>
            <p>
              Filenames, sizes, MIME types, folder structure, timestamps, share settings, storage locations, chunk
              maps, and reassembly parameters. Coordination metadata — never content.
            </p>
            <h3 className="text-lg font-semibold">2.3 Safety-screening manifests (S-Hawk)</h3>
            <p>
              Before encryption, your device assembles a metadata manifest per upload/share: filename, size, declared
              and detected file type, media attributes, document/archive structure descriptors, and cryptographic
              hashes. Manifests of cleared files are stored for share re-screening; refused files keep manifests in
              the case file. Manifests never contain content, and screening never decrypts your files.
            </p>
            <h3 className="text-lg font-semibold">2.4 Security and abuse telemetry</h3>
            <p>
              IP address, country-level location, device/session identifiers, request rates, auth failures, screening
              decisions and scores, suspension/ban records, appeals, and admin audit trails.
            </p>
            <h3 className="text-lg font-semibold">2.5 API/CLI diagnostics and billing metadata</h3>
            <p>
              Per-key usage counters, operation logs, error traces, plan tier, billing cadence, payment timestamps
              and references. We never receive card numbers, wallet seeds, or private keys.
            </p>
            <div className="rounded-lg border-l-4 border-primary bg-muted/40 p-4">
              <p className="font-medium">Metadata-only principle</p>
              <p className="mt-1 text-muted-foreground">
                We collect metadata only and do not read, decrypt, or analyze the content of your files — including
                for safety screening.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Managed storage</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Files are split and encrypted into opaque chunks before storage. Finite, shared capacity.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">BYOS</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  External providers like Tebi.io, Cloudflare R2, and Amazon S3 can be connected by you.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">BYOK</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Your encryption key remains under your control and is never stored by SquidCloud.
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>3. How We Use Your Information</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Service delivery (account access, authentication, storage operations, subscriptions).</li>
              <li>Safety screening (manifest evaluation, refusals with reasons, case files, appeals).</li>
              <li>Security (abuse prevention, intrusion detection, rate limiting, suspensions, bans).</li>
              <li>Diagnostics (error tracking, performance analysis, reliability improvements).</li>
              <li>Billing (tier provisioning, renewals, downgrades, disputes).</li>
              <li>Operational communications (policy and service notices).</li>
              <li>Compliance with applicable legal obligations.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>4. Screening Case Files</h2>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">Refused? Here is what we keep — and what you get</p>
                  <p>
                    A case file (account ID, manifest, triggered signals, score, decision, suspension if any) goes
                    to KZA human review where required. You get a notice with the exact reasons plus an appeal path
                    (Settings → Security → Upload Appeals). Case files contain no file content — refused material is
                    never stored.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>5. What We Never Do</h2>
            <div className="rounded-lg border-l-4 border-primary bg-muted/40 p-4">
              <ul className="list-disc space-y-2 pl-6">
                <li>We do not sell your personal data.</li>
                <li>We do not share your information with advertisers or data brokers.</li>
                <li>We do not read, decrypt, or analyze your uploaded file contents — for any purpose.</li>
                <li>We do not use your files to train AI models.</li>
                <li>We do not access your BYOK keys (we never receive them).</li>
                <li>We do not retain data beyond operational necessity and Section 9.</li>
              </ul>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>6. Storage and Protection</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Managed storage holds only client-side encrypted chunks (AES-256-GCM, Res54).</li>
              <li>BYOS stores content on your provider; SquidCloud stores encrypted credentials and metadata only.</li>
              <li>BYOK keeps key management entirely with you.</li>
              <li>HTTPS in transit; vault-encrypted secrets at rest; logged administrative access.</li>
            </ul>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                GitHub Privacy Statement:{' '}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  docs.github.com
                </a>
              </li>
              <li>
                Vercel Privacy Policy:{' '}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  vercel.com
                </a>
              </li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>7. Cookies and Session Technology</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Authentication cookies and session tokens for secure sign-in continuity.</li>
              <li>Local preference storage for display and settings preferences.</li>
              <li>No advertising or third-party tracking cookies.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>8. Third-Party Services and Disclosures</h2>
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Data Involved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Supabase</TableCell>
                  <TableCell>Authentication and metadata database</TableCell>
                  <TableCell>Account information and file metadata</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>GitHub</TableCell>
                  <TableCell>Native storage backend</TableCell>
                  <TableCell>Encrypted chunked JSON blobs only</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Vercel</TableCell>
                  <TableCell>Platform hosting and delivery</TableCell>
                  <TableCell>Request and performance data</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>OAuth providers (Google, GitHub)</TableCell>
                  <TableCell>Optional sign-in</TableCell>
                  <TableCell>Authorized token and profile data</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Tebi.io / Cloudflare R2 / Amazon S3</TableCell>
                  <TableCell>Optional BYOS providers</TableCell>
                  <TableCell>File content if connected by you</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>MaxelPay</TableCell>
                  <TableCell>Paid-tier payment processing</TableCell>
                  <TableCell>Billing metadata only; no card/wallet secrets</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p>
              We disclose data to authorities only where the law requires (e.g. a valid court order), limited to
              what we hold — metadata, manifests, ciphertext — notifying you unless legally prohibited. Illegal
              content surfaced through screening reports is reported as the law requires.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>9. Data Retention</h2>
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Data Type</TableHead>
                  <TableHead>Retention Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Account information</TableCell>
                  <TableCell>Until account deletion</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>File metadata and manifests of stored files</TableCell>
                  <TableCell>Until file or account deletion</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Screening case files and findings</TableCell>
                  <TableCell>12 months after case closure</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Threat and abuse telemetry</TableCell>
                  <TableCell>12 months</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Active ban records</TableCell>
                  <TableCell>Ban duration plus 12 months</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Screening notices and appeals</TableCell>
                  <TableCell>Until account deletion; appeals 12 months after decision</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>API and CLI usage logs</TableCell>
                  <TableCell>90 days</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Daily quota counters</TableCell>
                  <TableCell>Until next UTC-midnight reset</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Billing metadata</TableCell>
                  <TableCell>7 years for tax and accounting compliance</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Session and authentication tokens</TableCell>
                  <TableCell>Until session expiry or logout</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Error and diagnostic logs</TableCell>
                  <TableCell>30 days</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>10. Account Deletion and Your Rights</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Deletion requests are handled via email and verified for account security.</li>
              <li>On confirmed deletion, account data and metadata are permanently removed per Section 9.</li>
              <li>External BYOS data must be deleted on your provider platform separately.</li>
              <li>You may request access (including your screening case files), correction, and deletion of personal data.</li>
              <li>You may nominate another person to exercise your rights in case of death or incapacity.</li>
              <li>
                Grievance redressal: write to hellosquidcloud@gmail.com with subject “Privacy Grievance — [topic]”.
                We acknowledge within 48 hours on business days and resolve within 30 days.
              </li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>11. Children, Law, and Changes</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Services are not intended for children under 13; under-13 accounts are terminated and deleted.</li>
              <li>Operations align with the Digital Personal Data Protection Act, 2023 (India).</li>
              <li>Material policy changes are communicated via dashboard notice or email at least 7 days ahead.</li>
              <li>Confirmed security incidents are disclosed to affected users in reasonable time.</li>
            </ul>
          </section>

          <Separator />

          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Zero-tolerance policy</p>
                <p>
                  CSAM and other illegal content are strictly prohibited and may result in immediate account
                  termination and reporting to relevant authorities. Screening reports contain metadata only — we
                  cannot and do not inspect file content.
                </p>
              </div>
            </div>
          </div>

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

export default PrivacyPolicy;
