import React from 'react';
import { Download, ExternalLink, FileText, Mail, Heart, MessageCircle } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageFrame } from '@/components/layout/PageFrame';
import termsPdf from '../../cx/SquidCloud-Terms-of-Service-Final (1).pdf';

const linkClass = 'text-primary underline underline-offset-4 hover:opacity-80';
const sectionTitleClass = 'text-xl font-semibold md:text-2xl';

const TOS_CSS = `
.tos-content{max-width:760px;margin:0 auto;text-align:left}
.tos-content h2{font-size:20px;line-height:1.3;color:var(--sa-text,#e8e7e1)}
.tos-content :is(p,li){color:var(--sa-mute,#8d8f89);line-height:1.8}
.tos-content :is(.font-semibold,.font-medium){color:var(--sa-text,#e8e7e1)!important}
.tos-content :is(strong){color:var(--sa-text,#e8e7e1);font-weight:500}
.tos-content a{color:var(--sa-text,#e8e7e1);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--sa-line-2,#2f3230)}
.tos-content :is(hr,[data-orientation="horizontal"]){border-color:var(--sa-line,#1f2221)}
.tos-note{padding:20px;border:1px solid var(--sa-line,#1f2221);border-radius:16px;background:var(--sa-bg-2,#0e1110)}
.tos-note p{color:var(--sa-mute,#8d8f89)}
.tos-note svg{color:var(--sa-mute,#8d8f89)}
.tos-download{display:flex;justify-content:center;margin-bottom:32px}
.tos-contact{margin-top:8px}
`;

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
    <PageFrame title="Terms of Service" subtitle="v3.0 · Effective 14 September 2026">
      <style>{TOS_CSS}</style>
      <div className="tos-content">
        <div className="tos-download">
          <Button onClick={downloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>

        <div className="space-y-8 text-sm leading-7 text-foreground md:text-base">

          <div className="tos-note">
            <div className="flex items-start gap-3">
              <Heart className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">We want you to be happy.</p>
                <p className="mt-1 text-muted-foreground">
                  These terms are written in plain language. If anything is unclear, reach out to us at{' '}
                  <a href="mailto:hellosquidcloud@gmail.com" className={linkClass}>hellosquidcloud@gmail.com</a> —
                  we'll explain in person.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>1. Welcome</h2>
            <p>
              Thanks for using SquidCloud! These terms cover everything — the website, API, CLI tools, and any
              related services. By using SquidCloud, you agree to these terms. If you don't, that's okay —
              just stop using the service.
            </p>
            <p>
              When we make changes, we'll let you know at least 7 days in advance through the dashboard (and
              email if we have your address). If you don't agree with the changes, you can stop using SquidCloud
              or cancel your subscription anytime.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>2. Who can use SquidCloud</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You need to be at least 13 years old.</li>
              <li>If you're between 13 and 18, please ask a parent or guardian first.</li>
              <li>One account per person — please don't create multiple accounts to get around limits.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>3. Plans and billing</h2>
            <p>
              SquidCloud has a free tier and paid Supporter tiers. You can see exactly what each plan includes
              on the pricing page. Here's the important stuff:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Payments:</strong> Paid plans are billed in advance (weekly, monthly, or annual) through MaxelPay (cryptocurrency). We never see or store your private keys, wallet seeds, or card details.</li>
              <li><strong>Failed payments:</strong> If a renewal doesn't go through, you'll be moved to the free tier at the end of your billing period. Your files stay safe — you just lose access to paid features until you upgrade again.</li>
              <li><strong>Taxes:</strong> If applicable, taxes are your responsibility.</li>
            </ul>

            <div className="tos-note">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Our refund promise</p>
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    <p>
                      We want you to be happy with SquidCloud. If something isn't working out, talk to us — we're
                      real people and we listen.
                    </p>
                    <p>
                      <strong>If you haven't used much of your paid plan</strong> (haven't pushed close to the
                      limits, haven't used premium features extensively), and you have a valid reason, we can
                      issue a <strong>full refund</strong> — no fixed window, no fine print. We decide on a
                      case-by-case basis and we'll always be fair about it.
                    </p>
                    <p>
                      <strong>How it works:</strong> Open a ticket at <a href="/support" className={linkClass}>/support</a>,
                      tell us what happened, and provide a destination address. Our support team will review your
                      case, check your usage, and if everything looks good, we'll initiate the refund. Refunds
                      are sent to the same address you paid from (or an alternate address you provide). You'll
                      get an email confirmation at every step.
                    </p>
                    <p>
                      <strong>Cancelling stops future renewals</strong> but doesn't automatically refund the
                      current period — unless you qualify under the policy above. Just ask, we're reasonable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>4. What "unlimited" actually means</h2>
            <p>
              Some features on some plans are called "unlimited." Here's exactly what that means:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>We haven't set a fixed number on your account for that feature right now.</li>
              <li>It's still subject to fair use (see section 5) and the actual capacity of our servers.</li>
              <li>It is <strong>not</strong> a promise of infinite speed, guaranteed availability, or dedicated hardware. Our servers are real computers with real limits.</li>
            </ul>
            <p>
              Things that have specific numbers today (and "unlimited" doesn't apply to them): file size limits,
              daily upload counts, concurrent transfers, and API token quotas — all listed on the pricing page.
            </p>
            <p>
              If infrastructure gets tight, we might need to introduce new limits. We'll give you at least
              7 days notice before any changes take effect. Your existing files will never be deleted because
              of a new limit.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>5. Fair use</h2>
            <p>
              "Unlimited" is for normal, personal cloud use — storing your files, sharing them with people you
              choose, and building integrations. What's <strong>not</strong> okay:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Reselling SquidCloud storage or bandwidth to others.</li>
              <li>Running public download mirrors or hotlinking farms.</li>
              <li>Bulk-harvesting content you don't own.</li>
              <li>Cryptocurrency mining or proof-of-storage schemes.</li>
              <li>Splitting workloads across accounts to get around limits.</li>
            </ul>
            <p>
              If we notice something off, we'll reach out first. Repeated or extreme unfair use gets treated
              as abuse — but we'll always talk to you before taking action.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>6. Your account</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Keep your login credentials safe. If something gets compromised, revoke access immediately and let us know.</li>
              <li>You're responsible for everything that happens under your account.</li>
              <li>Please provide accurate information when you sign up.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>7. Storage options</h2>
            <p>SquidCloud supports a few different ways to store your files:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Managed storage:</strong> Files are encrypted on your device before upload. Nobody — not even us — can read them. Storage capacity is shared across all users.</li>
              <li><strong>Bring Your Own Storage (BYOS):</strong> You connect your own provider (Tebi, Cloudflare R2, S3, etc.). Your files stay on your provider, and you're responsible for that provider's terms and costs.</li>
              <li><strong>Bring Your Own Key (BYOK):</strong> You manage the encryption key entirely. If you lose it, we can't recover your data — so please keep a backup.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>8. Safety screening (S-Hawk)</h2>
            <p>
              To keep the platform safe, uploads pass through S-Hawk — our automated safety check. It looks
              at <strong>metadata only</strong>: filename, size, file type, media attributes, and hashes.
              It never reads your actual file content.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>If something trips a rule, the upload is refused <strong>before</strong> anything is stored.</li>
              <li>You get told exactly why, with a plain-language explanation.</li>
              <li>Every refusal can be appealed from Settings → Security → Upload Appeals. Appeals go to a real human.</li>
              <li>Filing an appeal never counts against you.</li>
            </ul>
            <p>
              No screening system is perfect — legitimate files can sometimes be flagged (appeal them!), and
              some bad stuff can slip through (please report it). You're always responsible for what you store.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>9. What you can and can't do</h2>
            <p>You're welcome to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Store personal, professional, or educational files.</li>
              <li>Automate workflows with the CLI, API, or integrations.</li>
              <li>Build apps on top of the SquidCloud API.</li>
            </ul>
            <p>Please don't:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Store pirated content, malware, or anything illegal.</li>
              <li>Try to break into other accounts or our systems.</li>
              <li>Scrape, spam, or abuse the platform in any way.</li>
            </ul>
            <p>
              <strong>Zero tolerance:</strong> Any content involving minors is strictly prohibited, results in
              immediate permanent termination, and will be reported to the relevant authorities. No exceptions.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>10. Your data</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>You own your files. We don't claim any rights over your content.</li>
              <li>We don't read, decrypt, or analyze your file contents — ever.</li>
              <li>SquidCloud isn't a backup service. Please keep your own backups of anything important.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>11. API and developer usage</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>API calls are logged for security purposes.</li>
              <li>Rate limits and quotas are enforced per tier — please don't try to circumvent them.</li>
              <li>If you use BYOS, third-party provider costs are on you.</li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>12. When things go wrong</h2>
            <p>We try to be fair. If rules are broken:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>We start with a warning.</li>
              <li>If it continues, we may temporarily suspend uploads.</li>
              <li>Serious or repeated issues can lead to account suspension.</li>
              <li>The worst cases (CSAM, attacks, ban evasion) skip straight to permanent termination.</li>
            </ul>
            <p>
              You can always appeal. Suspensions can be appealed from Settings → Security → Upload Appeals.
              We aim to respond within 7 business days. Filing an appeal never makes things worse.
            </p>
            <p>
              <strong>Deleting your account:</strong> Email us at{' '}
              <a href="mailto:hellosquidcloud@gmail.com" className={linkClass}>hellosquidcloud@gmail.com</a>{' '}
              with "Account Deletion Request" in the subject. We'll verify your identity, then permanently
              remove your data. BYOS files need to be deleted separately through your provider.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>13. Availability</h2>
            <p>
              We do our best, but we can't promise 100% uptime. SquidCloud is a best-effort service — sometimes
              things go down for maintenance, because of provider issues, or just because the internet is
              complicated. We're not liable for downtime, slowdowns, or third-party outages.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>14. Liability</h2>
            <p>SquidCloud is provided "as is" and "as available." Here's what that means in practice:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>We don't guarantee any specific level of service, uptime, or performance.</li>
              <li>We're not responsible for indirect, incidental, or consequential damages.</li>
              <li>We're not liable for data loss (that's why we recommend backups), screening errors, key loss, or third-party failures.</li>
              <li>Our total liability for any claim is capped at what you paid us in the 3 months before the claim — or ₹500 if that's less.</li>
            </ul>
            <p>
              Nothing here limits liability for fraud, willful misconduct, or anything we can't legally exclude.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className={sectionTitleClass}>15. Legal stuff</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Governing law:</strong> These terms are governed by the laws of India.</li>
              <li><strong>Disputes:</strong> Let's talk first — email us at{' '}
                <a href="mailto:hellosquidcloud@gmail.com" className={linkClass}>hellosquidcloud@gmail.com</a>{' '}
                within 30 days. If we can't work it out, disputes go to Indian courts.</li>
              <li><strong>Severability:</strong> If any part of these terms is found unenforceable, the rest still applies.</li>
              <li><strong>Entire agreement:</strong> These terms plus the Privacy Policy are the full agreement between us.</li>
            </ul>
          </section>

          <Separator />

          <Card className="tos-note tos-contact">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Questions?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                We're real people and we read every message. Reach out anytime:
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
    </PageFrame>
  );
};

export default TermsOfService;
