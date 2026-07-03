import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Copy, Trash2, Users, Calendar, DollarSign, User, Crown as CrownIcon } from '@/lib/icon-map';

interface RedeemCode {
  id: string;
  code: string;
  plan_type: string;
  billing_period: string;
  price: number;
  currency: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  for_user_id?: string;
}

export default function RedeemCodeManager() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState({
    plan_type: 'supporter',
    billing_period: 'monthly',
    price: 0,
    max_uses: 1,
    days_valid: 30,
    for_user_id: ''
  });

  useEffect(() => {
    if (profile?.is_admin) {
      fetchRedeemCodes();
    }
  }, [profile?.is_admin]);

  const fetchRedeemCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('redeem_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRedeemCodes(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch redeem codes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 18; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const createRedeemCode = async () => {
    try {
      const code = await generateCode();
      
      // Check if code already exists
      const { data: existing } = await supabase
        .from('redeem_codes')
        .select('id')
        .eq('code', code)
        .single();
      
      if (existing) {
        toast({
          title: 'Error',
          description: 'Code already exists, generating new one...',
          variant: 'destructive',
        });
        return createRedeemCode();
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + newCode.days_valid);

      const { error } = await supabase
        .from('redeem_codes')
        .insert({
          code,
          plan_type: newCode.plan_type,
          billing_period: newCode.billing_period,
          price: newCode.price,
          max_uses: newCode.max_uses,
          expires_at: expiresAt.toISOString(),
          created_by: user?.id,
          for_user_id: newCode.for_user_id || null
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Redeem code created successfully',
      });

      setDialogOpen(false);
      setNewCode({
        plan_type: 'supporter',
        billing_period: 'monthly',
        price: 0,
        max_uses: 1,
        days_valid: 30,
        for_user_id: ''
      });
      fetchRedeemCodes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create redeem code',
        variant: 'destructive',
      });
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast({
      title: 'Copied!',
      description: 'Redeem code copied to clipboard',
    });
  };

  const deleteCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('redeem_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Redeem code deleted',
      });

      fetchRedeemCodes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete redeem code',
        variant: 'destructive',
      });
    }
  };

  const getPlanLabel = (plan: string) => {
    return plan === 'supporter' ? 'Supporter' : 'Supporter+';
  };

  const getPlanColor = (plan: string) => {
    return plan === 'supporter' 
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Redeem Code Manager</h2>
          <p className="text-muted-foreground">Create and manage redeem codes for users</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Redeem Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Redeem Code</DialogTitle>
              <DialogDescription>
                Generate a redeem code that users can use to activate their plan.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Type</Label>
                  <Select value={newCode.plan_type} onValueChange={(v) => setNewCode(p => ({ ...p, plan_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supporter">Supporter</SelectItem>
                      <SelectItem value="supporter-plus">Supporter+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Period</Label>
                  <Select value={newCode.billing_period} onValueChange={(v) => setNewCode(p => ({ ...p, billing_period: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" placeholder="0.00" className="pl-10" value={newCode.price} onChange={(e) => setNewCode(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Input type="number" min="1" value={newCode.max_uses} onChange={(e) => setNewCode(p => ({ ...p, max_uses: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Days Valid</Label>
                  <Input type="number" min="1" value={newCode.days_valid} onChange={(e) => setNewCode(p => ({ ...p, days_valid: parseInt(e.target.value) || 30 }))} />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createRedeemCode}>
                Create Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {redeemCodes.map((code) => (
            <Card key={code.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-lg">{code.code}</CardTitle>
                  <Badge className={getPlanColor(code.plan_type)}>
                    {getPlanLabel(code.plan_type)}
                  </Badge>
                </div>
                <CardDescription>
                  {code.billing_period} - ${code.price}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {code.used_count}/{code.max_uses} used
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Expires {new Date(code.expires_at || '').toLocaleDateString()}
                    </div>
                    {code.for_user_id && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Assigned User
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCode(code.code)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCode(code.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {redeemCodes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No redeem codes found. Create your first one!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
