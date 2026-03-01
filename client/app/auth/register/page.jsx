"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoogleLogin from '@/components/GoogleLogin';
import FacebookLogin from '@/components/FacebookLogin';
import { registerUser, getCurrentUser } from '@/lib/api';
import { FaWhatsapp } from 'react-icons/fa';
import { Mail, Lock, User, ArrowRight, Sparkles, Zap, Shield, Building2, Briefcase, Globe, FileText, BadgeCheck, MapPin, ChevronLeft, ChevronDown } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    industry: '',
    website: '',
    description: '',
    companyLocation: '',
    annualRevenue: '',
    certificationType: '',
    certificationNumber: ''
  });
  const [activePage, setActivePage] = useState(1);
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCard(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSocialError('');
    setLoading(true);

    try {
      const data = await registerUser(formData);
      if (data?.token) {
        localStorage.setItem('token', data.token);
        document.cookie = `auth_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        window.dispatchEvent(new Event('authChange'));
      }
      // Always redirect to email verification after registration
      router.push('/onboarding/verify-email');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError('Please complete name, email, and password to continue.');
      return;
    }
    setError('');
    setActivePage(2);
  };

  const handleSocialSuccess = async (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      document.cookie = `auth_token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');

    // Check email verification status
    const user = await getCurrentUser();
    if (!user.emailVerified) {
      router.push('/onboarding/verify-email');
    } else {
      router.push('/onboarding/esb');
    }
  };

  const handleFacebookSuccess = async (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      document.cookie = `auth_token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');

    // Check email verification status
    const user = await getCurrentUser();
    if (!user.emailVerified) {
      router.push('/onboarding/verify-email');
    } else {
      router.push('/onboarding/esb');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Gradient Illustration Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-emerald-600 to-green-700" />
        {/* Decorative elements */}
        <div className="absolute top-32 right-16 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-16 left-16 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FaWhatsapp className="text-2xl" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}
            </span>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-4">
            Start your journey<br />
            with <span className="text-emerald-300">WhatsApp Business</span>
          </h2>
          <p className="text-lg text-white/70 max-w-md mb-8">
            Join thousands of businesses using our platform to connect, engage, and grow with WhatsApp.
          </p>

          <div className="space-y-4">
            {[
              { icon: Sparkles, text: 'Free trial with all features' },
              { icon: Zap, text: 'Set up in minutes' },
              { icon: Shield, text: 'Enterprise-grade security' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <span className="text-white/80 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Register Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-lg mx-auto px-6 py-4 w-full">
            <Link href="/" className="flex items-center gap-2.5 group lg:hidden">
              <div className="h-9 w-9 relative">
                <Image src="/interact-logo.png" alt={process.env.NEXT_PUBLIC_APP_DOMAIN || ''} fill sizes="36px" className="object-contain" />
              </div>
              <span className="font-bold text-base tracking-tight text-foreground uppercase group-hover:text-primary transition-colors">
                {process.env.NEXT_PUBLIC_APP_DOMAIN}
              </span>
            </Link>
            <div className="text-sm text-muted-foreground ml-auto">
              <span className="hidden sm:inline">Already on {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}?</span>
              <Link href="/auth/login" className="ml-2 font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div
              className={`bg-card border border-border/50 rounded-2xl shadow-premium px-6 sm:px-10 py-10 transition-all duration-500 ${showCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">Create your account</h1>
                <p className="text-sm text-muted-foreground">Get started with your free trial today</p>
                <p className="text-xs text-muted-foreground mt-1">Step {activePage} of 2</p>
              </div>

              {/* Social Login (Step 1 only) */}
              {activePage === 1 && (
                <>
                  <div className="space-y-3 mb-6">
                    <GoogleLogin
                      formType="signup"
                      autoRedirect={false}
                      onError={(msg) => setSocialError(msg)}
                      onSuccess={handleSocialSuccess}
                    />
                    <FacebookLogin
                      autoRedirect={false}
                      onError={(msg) => setSocialError(msg)}
                      onSuccess={handleFacebookSuccess}
                    />
                  </div>

                  <div className="flex items-center gap-4 my-6">
                    <span className="flex-1 h-px bg-border" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">or</span>
                    <span className="flex-1 h-px bg-border" />
                  </div>
                </>
              )}

              {/* Error Messages */}
              {socialError && (
                <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive text-left">
                  {socialError}
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive text-left">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {activePage === 1 ? (
                  <>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        className="input-premium pl-11"
                        placeholder="Full Name"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="input-premium pl-11"
                        placeholder="Email Address"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="input-premium pl-11"
                        placeholder="Password"
                        minLength={6}
                        required
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleNextPage}
                      className="btn-primary w-full flex items-center justify-center gap-2 group"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <p className="text-sm font-semibold text-foreground">Business Details</p>
                      <p className="text-xs text-muted-foreground mt-1">These details help personalize your onboarding and templates.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative sm:col-span-2">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="businessName"
                          name="businessName"
                          type="text"
                          value={formData.businessName}
                          onChange={handleChange}
                          className="input-premium pl-11"
                          placeholder="Business Name"
                          required
                        />
                      </div>

                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                          id="industry"
                          name="industry"
                          value={formData.industry}
                          onChange={handleChange}
                          className="input-premium pl-11 pr-10 appearance-none text-foreground"
                          required
                        >
                          <option value="">Select industry</option>
                          <option value="Retail">Retail</option>
                          <option value="E-commerce">E-commerce</option>
                          <option value="Healthcare">Healthcare</option>
                          <option value="Education">Education</option>
                          <option value="Travel">Travel</option>
                          <option value="Hospitality">Hospitality</option>
                          <option value="Real Estate">Real Estate</option>
                          <option value="Finance">Finance</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="companyLocation"
                          name="companyLocation"
                          type="text"
                          value={formData.companyLocation}
                          onChange={handleChange}
                          className="input-premium pl-11"
                          placeholder="Company Location"
                        />
                      </div>

                      <div className="relative">
                        <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                          id="certificationType"
                          name="certificationType"
                          value={formData.certificationType}
                          onChange={handleChange}
                          className="input-premium pl-11 pr-10 appearance-none text-foreground"
                          required
                        >
                          <option value="">Certification type (GST/MSME/PAN)</option>
                          <option value="gst">GST</option>
                          <option value="msme">MSME</option>
                          <option value="pan">PAN</option>
                          <option value="other">Other Certification</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="relative">
                        <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="certificationNumber"
                          name="certificationNumber"
                          type="text"
                          value={formData.certificationNumber}
                          onChange={handleChange}
                          className="input-premium pl-11"
                          placeholder="Certification Number"
                          required
                        />
                      </div>

                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="website"
                          name="website"
                          type="url"
                          value={formData.website}
                          onChange={handleChange}
                          className="input-premium pl-11"
                          placeholder="Website (optional)"
                        />
                      </div>

                      <div className="relative sm:col-span-2">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                          id="annualRevenue"
                          name="annualRevenue"
                          value={formData.annualRevenue}
                          onChange={handleChange}
                          className="input-premium pl-11 pr-10 appearance-none text-foreground"
                        >
                          <option value="">Annual Revenue (optional)</option>
                          <option value="under_10_lakh">Under ₹10 Lakh</option>
                          <option value="10_lakh_to_1_cr">₹10 Lakh - ₹1 Cr</option>
                          <option value="1_cr_to_10_cr">₹1 Cr - ₹10 Cr</option>
                          <option value="10_cr_plus">₹10 Cr+</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="relative sm:col-span-2">
                        <FileText className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                        <textarea
                          id="description"
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          className="input-premium pl-11 min-h-[88px] resize-none"
                          placeholder="What does your business do?"
                          maxLength={250}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setActivePage(1)}
                        className="w-1/3 inline-flex items-center justify-center rounded-xl border border-border text-foreground px-4 py-2.5"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-2/3 flex items-center justify-center gap-2 group"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Create Account</span>
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>

              {/* Terms */}
              <p className="mt-5 text-xs text-muted-foreground text-center">
                By continuing you agree to our{' '}
                <Link href="/terms" className="font-medium text-foreground hover:text-primary transition-colors">Terms of Service</Link> and{' '}
                <Link href="/privacy" className="font-medium text-foreground hover:text-primary transition-colors">Privacy Policy</Link>.
              </p>

              {/* Login link */}
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}