"use client";

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle2, 
  Lock, 
  ShieldCheck, 
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { acceptInvitation, getCurrentUser, getInvitation } from '@/lib/api/auth';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await getCurrentUser() as any;
      setCurrentUser(response?.success && response?.user ? response.user : (response?.user || response?.data || null));
    } catch {
      setCurrentUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  const verifyInvite = useCallback(async () => {
    console.log(`[Verify] Sending request for token: ${token}, email: ${email}`);
    try {
      const res = await getInvitation(token || '', email || '') as any;
      const info = res.success && res.data ? res.data : res; // handle both wrapped and unwrapped
      console.log(`[Verify] Success:`, info);
      setInviteInfo(info);
      setName(info.name || '');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Invalid or expired invitation";
      console.error(`[Verify] Error:`, msg, err);

      const redirectToken = err.response?.data?.redirectToken;
      const redirectEmail = err.response?.data?.redirectEmail;
      
      if (redirectToken && redirectEmail) {
        const newUrl = `/auth/accept-invite?token=${redirectToken}&email=${encodeURIComponent(redirectEmail)}`;
        router.replace(newUrl);
        return;
      }

      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  }, [email, router, token]);

  useEffect(() => {
    if (token && email) {
      setError(null);
      verifyInvite();
      checkAuth();
    }
    // If we have searchParams but NO token/email, then it's a real error
    else if (searchParams.size > 0 && (!token || !email)) {
      setIsVerifying(false);
      setCheckingAuth(false);
    }
  }, [token, email, searchParams, verifyInvite, checkAuth]);


  const handleLoginRedirect = () => {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    router.push(`/auth/login?redirectTo=${callbackUrl}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteInfo?.userExists) {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: any = {
        token,
        email,
        name
      };
      
      if (!inviteInfo?.userExists) {
        payload.password = password;
      }
      
      if (currentUser) {
        payload.userId = currentUser._id || currentUser.id;
      }

      await acceptInvitation(payload);
      
      setIsSuccess(true);
      toast.success(inviteInfo?.userExists ? "Joined workspace successfully!" : "Account activated!");
      
      window.dispatchEvent(new Event('authChange'));

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || "Failed to accept invitation";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const isWrongUser = currentUser && currentUser.email.toLowerCase() !== email?.toLowerCase();

  if (isVerifying || checkingAuth) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-black uppercase tracking-widest text-primary">Verifying Invite</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">Securing your connection...</p>
        </div>
      </div>
    );
  }

  if (error || !token || !email) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md text-center"
      >
        <div className="w-20 h-20 rounded-[32px] bg-destructive/5 flex items-center justify-center border border-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black">Invitation Error</h1>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            {error || "This invitation link is missing required security tokens or has been tampered with."}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push('/auth/login')} 
          className="font-bold h-12 px-8 rounded-2xl border-border/50"
        >
          Return to Login
        </Button>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-8 max-w-md">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="w-24 h-24 rounded-[40px] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"
        >
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </motion.div>
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight">Welcome to the Team!</h1>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            You have successfully joined <strong>{inviteInfo?.workspaceName}</strong>.<br/>
            Redirecting you to your new dashboard...
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/30 px-6 py-3 rounded-2xl border border-border/50">
           <Loader2 className="h-4 w-4 animate-spin text-primary" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Synchronizing Workspace</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center space-y-3"
      >
        <div className="inline-flex items-center justify-center p-3 bg-primary/5 rounded-2xl mb-2">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Join Workspace</h1>
        <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
          <p className="text-sm text-muted-foreground font-medium">
            You've been invited to join <br/>
            <span className="text-foreground font-black text-lg">{inviteInfo?.workspaceName}</span>
          </p>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-1.5 rounded-[32px] border-border/50 bg-card/50 backdrop-blur-sm shadow-premium overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Your Identity</label>
              <div className="relative group">
                <UserCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Your Full Name" 
                  className="pl-12 h-14 rounded-2xl bg-muted/20 border-border/40 focus:ring-primary/20 font-medium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={inviteInfo?.userExists}
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 ml-1 italic">Joining as: {email}</p>
            </div>

            <AnimatePresence mode="wait">
              {inviteInfo?.userExists ? (
                <motion.div 
                  key="existing-user"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  {isWrongUser ? (
                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-2">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-black text-amber-700">Wrong Account</p>
                          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            You are currently logged in as <strong>{currentUser.email}</strong>, but this invite is for <strong>{email}</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : !currentUser ? (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-2">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm font-black text-primary">Login Required</p>
                          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            You have an existing account. Please sign in to verify your identity and join this workspace.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 space-y-2">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-black text-emerald-700">Account Verified</p>
                          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            Logged in as <strong>{currentUser.email}</strong>. Ready to join the workspace.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="new-user"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 pt-2"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Create Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="password"
                        placeholder="••••••••" 
                        className="pl-12 h-14 rounded-2xl bg-muted/20 border-border/40 focus:ring-primary/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Confirm Password</label>
                    <div className="relative group">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="password"
                        placeholder="••••••••" 
                        className="pl-12 h-14 rounded-2xl bg-muted/20 border-border/40 focus:ring-primary/20"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>

        <div className="space-y-4 pt-2">
          {inviteInfo?.userExists && !currentUser ? (
            <Button 
              type="button"
              onClick={handleLoginRedirect}
              className="w-full h-15 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 bg-primary"
            >
              Log in to Accept Invite
              <ArrowRight className="ml-3 h-5 w-5" />
            </Button>
          ) : isWrongUser ? (
            <Button 
              type="button"
              onClick={handleLoginRedirect}
              variant="outline"
              className="w-full h-15 rounded-2xl font-black text-lg border-amber-500/50 text-amber-700 hover:bg-amber-50"
            >
              Switch Account
              <LogOut className="ml-3 h-5 w-5" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-15 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all bg-primary hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  {inviteInfo?.userExists ? "Confirm & Join Workspace" : "Activate & Join Workspace"}
                  <ArrowRight className="ml-3 h-5 w-5" />
                </>
              )}
            </Button>
          )}
          
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.push('/auth/login')}
            className="w-full h-12 font-bold text-muted-foreground hover:text-primary"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-muted/20">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
           <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Loading Invitation Details...</p>
        </div>
      }>
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
