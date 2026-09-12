import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  UserPlus, UserX, LogOut, Crown, Sparkles, Check,
} from '@/lib/icon-map';

interface SwitchAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SwitchAccountSheet: React.FC<SwitchAccountSheetProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [removing, setRemoving] = useState(false);

  const handleAddAccount = async () => {
    onOpenChange(false);
    // End the current session first — otherwise /auth sees a live
    // session and bounces straight back to the dashboard.
    await signOut();
    navigate('/auth');
  };

  const handleRemoveAccount = async () => {
    if (!removing) {
      setRemoving(true);
      return;
    }
    onOpenChange(false);
    setRemoving(false);
    await signOut();
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
  };

  const accounts = user ? [{ id: user.id, email: user.email, name: profile?.full_name, avatar: profile?.avatar_url, isCurrent: true }] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Switch Account</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground">Switch to or manage your accounts</p>
        </div>

        <div className="px-4 pb-3 space-y-1.5 max-h-60 overflow-y-auto">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                'bg-accent/30 border border-border/30',
              )}
            >
              <Avatar className="h-9 w-9 ring-2 ring-border/40">
                <AvatarImage src={account.avatar || ''} alt={account.name || 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {account.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{account.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{account.email}</p>
              </div>
              {account.isCurrent && (
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-primary">Current</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border/20 px-4 py-3 space-y-1.5">
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            profile?.is_premium ? 'bg-amber-500/10 text-amber-500' : 'bg-muted/50 text-muted-foreground',
          )}>
            {profile?.is_premium ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            <span className="text-xs font-semibold">{profile?.is_premium ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter') : 'Free Plan'}</span>
          </div>

          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 px-3 text-sm text-foreground hover:bg-accent/50"
              onClick={handleAddAccount}
            >
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Add Account
            </Button>

            {removing ? (
              <div className="flex items-center gap-2 px-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-9 text-xs text-destructive hover:bg-destructive/10"
                  onClick={handleRemoveAccount}
                >
                  <UserX className="h-4 w-4 mr-1.5" />
                  Confirm Remove
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-muted-foreground"
                  onClick={() => setRemoving(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-10 px-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemoveAccount}
              >
                <UserX className="h-4 w-4" />
                Remove Account
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border/20 px-4 py-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-10 px-3 text-sm text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SwitchAccountSheet;
