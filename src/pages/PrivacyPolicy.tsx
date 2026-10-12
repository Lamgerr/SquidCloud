import React from 'react';
import { Download, ExternalLink, Mail, Shield, Heart, MessageCircle } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
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
                  v3.0 · Effective 14 September 2026
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

          <div className="rounded-lg border border-primary/40 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Heart className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">We take your privacy seriously.</p>
                <p className="mt-1 text-muted-foreground">
                  This policy explains what we collect, why we collect it, and what we never do with your data.
                  If anything is unclear, please reach out — we're happy to explain.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>1. The short version</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>We <strong>never</strong> read, decrypt, or analyze your file contents.</li>
              <li>We <strong>never</strong> sell your data to anyone.</li>
              <li>We collect only what's needed to run the service — account info, file metadata, and usage logs.</li>
              <li>Your files are encrypted on your device before they reach us. We only see ciphertext.</li>
              <li>You can request deletion of your data anytime.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>2. What we collect</h2>
            <h3 className="text-lg font-semibold">Account info</h3>
            <p>Username, email, profile fields, and authentication details (session tokens, MFA enrollment facts — never your actual secrets).</p>

            <h3 className="text-lg font-semibold">File metadata</h3>
            <p>Filenames, sizes, types, folder structure, timestamps, and storage locations. This is coordination data — never the actual content of your files.</p>

            <h3 className="text-lg font-semibold">Safety screening data (S-Hawk)</h3>
            <p>
              Before encryption, your device builds a metadata manifest (filename, size, file type, hashes).
              S-Hawk checks this manifest — never your file content. Manifests of cleared files are kept for
              re-screening; refused files keep manifests only in the case file.
            </p>

            <h3 className="text-lg font-semibold">Security and usage data</h3>
            <p>IP address, country, device info, request rates, screening decisions, and admin audit trails.</p>

            <h3 className="text-lg font-semibold">Billing data</h3>
            <p>Plan tier, billing cadence, payment timestamps, and transaction references. We never see your card numbers, wallet seeds, or private keys.</p>

            <h3 className="text-lg font-semibold">Support conversations</h3>
            <p>
              When you contact support, we keep your ticket, messages, and activity history. This helps us
              provide better support and resolve issues faster. We retain support data for 12 months after
              your last ticket, and refund records for 7 years (financial compliance).
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>3. How we use your information</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>To run the service (account, authentication, storage, subscriptions).</li>
              <li>To keep the platform safe (abuse prevention, rate limiting, screening).</li>
              <li>To improve reliability (error tracking, performance analysis).</li>
              <li>To handle billing (plan provisioning, renewals, refunds).</li>
              <li>To provide support (ticket management, responses, follow-ups).</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>4. What we never do</h2>
            <div className="rounded-lg border-l-4 border-primary bg-muted/40 p-4">
              <ul className="list-disc space-y-2 pl-6">
                <li>Sell your personal data.</li>
                <li>Share your information with advertisers or data brokers.</li>
                <li>Read, decrypt, or analyze your file contents.</li>
                <li>Use your files to train AI models.</li>
                <li>Access your BYOK keys.</li>
                <li>Retain data longer than necessary.</li>
              </ul>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>5. How we protect your data</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Managed storage: files are split and encrypted (AES-256-GCM) before upload. Only you hold the keys.</li>
              <li>BYOS: your files live on your provider; we store only encrypted credentials.</li>
              <li>BYOK: your encryption key never leaves your device.</li>
              <li>All data is transmitted over HTTPS. Secrets are encrypted at rest.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>6. Cookies</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Authentication cookies to keep you signed in.</li>
              <li>Local storage for display preferences.</li>
              <li>No advertising or tracking cookies. Ever.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>7. Third-party services</h2>
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Data shared</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Supabase</TableCell>
                  <TableCell>Authentication and database</TableCell>
                  <TableCell>Account info and file metadata</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>GitHub</TableCell>
                  <TableCell>Native storage backend</TableCell>
                  <TableCell>Encrypted chunks only</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Vercel</TableCell>
                  <TableCell>Hosting and delivery</TableCell>
                  <TableCell>Request and performance data</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>OAuth providers</TableCell>
                  <TableCell>Optional sign-in</TableCell>
                  <TableCell>Authorized tokens and profile data</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>BYOS providers</TableCell>
                  <TableCell>External storage</TableCell>
                  <TableCell>File content (only if you connect them)</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>MaxelPay</TableCell>
                  <TableCell>Payment processing</TableCell>
                  <TableCell>Billing metadata only — no card/wallet secrets</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Gmail API</TableCell>
                  <TableCell>Transactional email (receipts, support)</TableCell>
                  <TableCell>Email address and message content</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p>
              We share data with authorities only when legally required (valid court order), limited to what
              we hold — metadata, manifests, ciphertext. We notify you unless legally prohibited.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>8. Data retention</h2>
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Data type</TableHead>
                  <TableHead>How long we keep it</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Account info</TableCell>
                  <TableCell>Until you delete your account</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>File metadata</TableCell>
                  <TableCell>Until file or account deletion</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Screening case files</TableCell>
                  <TableCell>12 months after case closure</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Support tickets and messages</TableCell>
                  <TableCell>12 months after last ticket activity</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Refund records</TableCell>
                  <TableCell>7 years (financial compliance)</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Activity logs</TableCell>
                  <TableCell>24 months</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>API and CLI usage logs</TableCell>
                  <TableCell>90 days</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Billing metadata</TableCell>
                  <TableCell>7 years (tax and accounting)</TableCell>
                </TableRow>
                <TableRow className="even:bg-muted/30">
                  <TableCell>Sessions and auth tokens</TableCell>
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
            <h2 className={sectionTitleClass}>9. Your rights</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You can request access to all data we hold about you.</li>
              <li>You can request correction or deletion of your personal data.</li>
              <li>You can request deletion of your account and all associated data.</li>
              <li>You can appeal any screening decision from Settings → Security.</li>
              <li>You can contact us with any privacy concerns at{' '}
                <a href="mailto:hellosquidcloud@gmail.com" className={linkClass}>hellosquidcloud@gmail.com</a>.
              </li>
            </ul>
            <p>
              We acknowledge privacy concerns within 48 hours on business days and resolve within 30 days.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>10. Children and legal compliance</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>SquidCloud is not intended for children under 13. Under-13 accounts are terminated and deleted.</li>
              <li>We operate in compliance with the Digital Personal Data Protection Act, 2023 (India).</li>
              <li>Material policy changes are communicated at least 7 days in advance.</li>
              <li>Security incidents affecting you will be disclosed in reasonable time.</li>
            </ul>
          </section>

          <Separator />

          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Zero tolerance</p>
                <p className="text-muted-foreground">
                  Any content involving minors is strictly prohibited, triggers immediate account termination,
                  and will be reported to the relevant authorities. No exceptions, no warnings.
                </p>
              </div>
            </div>
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Questions about your privacy?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                We're happy to explain anything in this policy. Reach out anytime:
              </p>
              <p>
                <span className="font-medium">Email: </span>
                <a href="mailto:hellosquidcloud@gmail.com" className={linkClass}>
                  hellosquidcloud@gmail.com
                </a>
              </p>
              <p>
                <span className="font-medium">Support: </span>
                <a href="/support" className={linkClass}>
                  squidcloud.vercel.app/support
                </a>
              </p>
              <p className="flex items-center gap-1">
                <span className="font-medium">Website: </span>
                <a href="https://squidcloud.vercel.app" target="_blank" rel="noreferrer noopener" className={linkClass}>
                  squidcloud.vercel.app
                </a>
                <ExternalLink className="h-4 w-4 text-primary" />
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
