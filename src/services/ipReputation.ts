export interface IpReputation {
  ip: string;
  score: number;
  isVpn: boolean;
  isDatacenter: boolean;
  isProxy: boolean;
  isTor: boolean;
  isTrusted: boolean;
  org: string;
  isp: string;
  asn: string;
  country: string;
  city: string;
}

const DATACENTER_ORGS = [
  'amazon', 'aws', 'ec2', 'google cloud', 'gcp', 'microsoft azure', 'azure',
  'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh', 'scaleway', 'online.net',
  'contabo', 'netcup', 'ionos', '1&1', 'akamai', 'cloudflare', 'incapsula',
  'oracle cloud', 'ibm cloud', 'alibaba cloud', 'tencent cloud', 'huawei cloud',
  'upcloud', 'civo', 'server', 'hosting', 'datacenter', 'data center',
  'dedicated', 'vps', 'kvm', 'xen', 'vmware', 'openstack',
  'rackspace', 'godaddy', 'dreamhost', 'bluehost', 'hostgator', 'a2hosting',
  'namecheap', 'siteground', 'inmotion', 'liquid web', 'knownhost',
  'buyvm', 'lowendbox', 'bandwagon', 'virmach', 'alpha vps',
];

const VPN_ORGS = [
  'nordvpn', 'expressvpn', 'private internet access', 'pia vpn',
  'cyberghost', 'surfshark', 'vyprvpn', 'hotspot shield', 'anchorfree',
  'windscribe', 'protonvpn', 'mullvad', 'tor guard', 'ivpn',
  'perfect privacy', 'airvpn', 'wevpn', 'tunnelbear', 'hidemyass',
  'ipvanish', 'safervpn', 'privatevpn', 'purevpn', 'zenmate',
  'betternet', 'touchvpn', 'hoxx vpn', 'browsec', 'dotvpn',
];

export async function checkIpReputation(ip: string): Promise<IpReputation> {
  const result: IpReputation = {
    ip,
    score: 0,
    isVpn: false,
    isDatacenter: false,
    isProxy: false,
    isTor: false,
    isTrusted: false,
    org: '',
    isp: '',
    asn: '',
    country: '',
    city: '',
  };

  try {
    const resp = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return result;

    const data = await resp.json();
    result.org = data.org || '';
    result.isp = data.isp || '';
    result.asn = data.asn || '';
    result.country = data.country_code || data.country || '';
    result.city = data.city || '';

    const orgLower = result.org.toLowerCase();

    if (VPN_ORGS.some(p => orgLower.includes(p))) {
      result.isVpn = true;
    }

    if (DATACENTER_ORGS.some(p => orgLower.includes(p))) {
      result.isDatacenter = true;
    }

    if (result.isVpn) {
      result.score = Math.min(result.score + 70, 100);
    }
    if (result.isDatacenter) {
      result.score = Math.min(result.score + 50, 100);
    }

    if (result.score >= 70) {
      result.isProxy = true;
    }

    return result;
  } catch {
    return result;
  }
}

export function getReputationLabel(score: number): string {
  if (score >= 80) return 'worse';
  if (score >= 60) return 'bad';
  if (score >= 30) return 'suspected';
  return 'good';
}

export function shouldBlockIp(reputation: IpReputation): boolean {
  return reputation.score >= 60;
}
