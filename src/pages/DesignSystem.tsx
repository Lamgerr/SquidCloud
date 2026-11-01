import React, { useState } from 'react';
import { useM3Theme, useRestoreDark } from '@/components/m3/theme';
import {
  Button, IconButton, Fab, Card, Chip, ListItem, IconWell, BadgeM3 as Badge,
  Divider, Progress, Ring, Switch, SegmentedButton, TextField, SearchBar,
  EmptyState, Skeleton, Kbd, ListGroup,
} from '@/components/m3/primitives';
import { NavigationDrawer, DrawerSection, DrawerLabel, NavItemM3, NavigationBar, TopAppBar } from '@/components/m3/navigation';
import { Home, FileStack, Trash2, Activity, Settings2, Search, Plus, X, Check, Star } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

const DesignSystem: React.FC = () => {
  const { seed, setSeed, seeds, mode, setMode } = useM3Theme();
  useRestoreDark();
  const [seg, setSeg] = useState('list');
  const [sw, setSw] = useState(true);
  const [search, setSearch] = useState('');
  const [nav, setNav] = useState('home');

  const navItems = [
    { id: 'home', label: 'Home', icon: <Home /> },
    { id: 'files', label: 'Files', icon: <FileStack /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 /> },
  ];

  return (
    <div className="m3-app min-h-screen p-6 space-y-8">
      <TopAppBar
        title="Material 3 Design System"
        actions={
          <>
            <select
              value={seed}
              onChange={(e) => setSeed(e.target.value as any)}
              className="m3-field__input h-9 rounded-full px-3 text-sm border border-[hsl(var(--m3-outline-hsl))]"
              aria-label="Seed"
            >
              {seeds.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <Button variant="tonal" size="sm" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
              {mode === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </>
        }
      />

      <section className="space-y-3">
        <h2 className="m3-title-large">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>filled</Button>
          <Button variant="tonal">tonal</Button>
          <Button variant="outlined">outlined</Button>
          <Button variant="text">text</Button>
          <Button variant="elevated">elevated</Button>
          <Button variant="danger">danger</Button>
          <Button loading>loading</Button>
          <Button size="sm" icon={<Plus />}>small</Button>
          <Button size="lg" trailingIcon={<ArrowRightIcon />}>large</Button>
          <IconButton label="search" variant="tonal"><Search /></IconButton>
          <IconButton label="star" selected><Star /></IconButton>
          <Fab icon={<Plus />} label="Create" extended />
          <Fab icon={<Plus />} size="sm" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><div className="m3-title-medium">Filled</div><div className="m3-body-medium m3-on-surface-variant">body text</div></Card>
          <Card variant="elevated"><div className="m3-title-medium">Elevated</div></Card>
          <Card variant="outlined"><div className="m3-title-medium">Outlined</div></Card>
          <Card variant="hero" className="md:col-span-3"><div className="m3-title-large">Hero card</div><div className="m3-body-medium">with tonal container</div></Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Chips</h2>
        <div className="flex flex-wrap gap-2">
          <Chip>assist</Chip>
          <Chip variant="filter" selected>filter selected</Chip>
          <Chip variant="suggestion" icon={<Star />}>suggestion</Chip>
          <Chip onRemove={() => {}}>removable</Chip>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">List</h2>
        <ListGroup outlined>
          <ListItem leading={<IconWell icon={<FileStack />} tone="image" size="sm" />} headline="Headline" supporting="supporting text" trailing={<Kbd>Enter</Kbd>} />
          <ListItem leading={<IconWell icon={<Trash2 />} tone="error" size="sm" />} headline="Selected" supporting="supporting" selected />
          <ListItem leading={<IconWell icon={<Activity />} tone="tonal" size="sm" />} headline="Three line" supporting="long supporting text that may wrap" threeLine />
        </ListGroup>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Inputs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <TextField label="Email" type="email" />
          <TextField label="Password" type="password" error="Required" />
          <SearchBar value={search} onChange={setSearch} placeholder="Search files" className="md:col-span-2" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Progress & Ring</h2>
        <Progress value={42} />
        <Progress indeterminate />
        <div className="flex items-center gap-6">
          <Ring value={68} max={100} size={96} strokeWidth={8}><text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="m3-title-medium" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>68%</text></Ring>
          <Switch checked={sw} onCheckedChange={setSw} label="toggle" />
          <SegmentedButton options={[{value:'grid',label:'Grid'},{value:'list',label:'List'},{value:'compact',label:'Compact'}]} value={seg} onChange={setSeg} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NavigationDrawer collapsed={false} header={<div className="m3-drawer__brand"><span className="m3-drawer__brand-name">SquidCloud</span></div>} footer={<div className="text-xs m3-on-surface-variant">footer</div>}>
            <DrawerSection label="Workspace">
              <NavItemM3 icon={<Home />} label="Home" active={nav === 'home'} onClick={() => setNav('home')} />
              <NavItemM3 icon={<FileStack />} label="Files" active={nav === 'files'} onClick={() => setNav('files')} badge={3} />
            </DrawerSection>
          </NavigationDrawer>
          <div>
            <NavigationBar items={navItems} value={nav} onChange={setNav} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Empty & Skeleton</h2>
        <EmptyState icon={<FileStack />} title="No files yet" body="Upload your first file to get started." action={<Button>Create</Button>} />
        <div className="flex gap-2"><Skeleton width={120} height={16} /><Skeleton width={80} height={16} /></div>
      </section>

      <section className="space-y-3">
        <h2 className="m3-title-large">Badges</h2>
        <div className="flex gap-2">
          <Badge>3</Badge>
          <Badge variant="tonal">tonal</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="dot" />
        </div>
      </section>
    </div>
  );
};

// small helper icon
const ArrowRightIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M5 12h14M13 5l7 7-7 7" /></svg>;

export default DesignSystem;
