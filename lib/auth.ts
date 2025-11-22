import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!SUPABASE_CONFIGURED) {
  console.warn('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set. Supabase requests will be skipped in the client.');
}

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
    flowType: 'pkce'
  }
});

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'customer' | 'driver' | 'admin';
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

class AuthService {
  private listeners: ((state: AuthState) => void)[] = [];
  private state: AuthState = {
    user: null,
    loading: true,
    error: null
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeAuth();
    }
  }

  private async initializeAuth() {
    try {
      if (!SUPABASE_CONFIGURED) {
        console.warn('Supabase not configured. Skipping authentication initialization.');
        this.setState({ loading: false });
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error retrieving session:', sessionError);
        this.setState({ loading: false, user: null });
      } else if (session?.user) {
        await this.loadUserProfile(session.user.id);
        this.setState({ loading: false });
      } else {
        this.setState({ loading: false });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.setState({ loading: false, user: null });
    }

    if (!SUPABASE_CONFIGURED) {
      return;
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          await this.loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          this.setState({ user: null, error: null });
        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await this.loadUserProfile(session.user.id);
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        this.setState({ user: null, error: 'Session expired. Please sign in again.' });
      }
    });
  }

  private async loadUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      this.setState({ user: data, error: null });
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.setState({ error: 'Failed to load user profile' });
    }
  }

  private setState(updates: Partial<AuthState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    listener(this.state); // Send current state immediately
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): AuthState {
    return this.state;
  }

  async signUp(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: 'customer' | 'driver' | 'admin';
  }) {
    try {
      this.setState({ loading: true, error: null });

      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase is not configured. Please contact support.');
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user profile with placeholder password_hash
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone,
            role: userData.role || 'customer',
            password_hash: 'supabase_auth_managed' // Placeholder since Supabase Auth handles passwords
          });

        if (profileError) throw profileError;
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (error: any) {
      const message = error.message || 'Failed to create account';
      this.setState({ error: message });
      return { success: false, message };
    } finally {
      this.setState({ loading: false });
    }
  }

  async signIn(email: string, password: string, rememberMe: boolean = false) {
    try {
      this.setState({ loading: true, error: null });

      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase is not configured. Please contact support.');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (rememberMe) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sb-remember-me', 'true');
          localStorage.setItem('sb-remember-me-timestamp', new Date().toISOString());
        }
      }

      return { success: true, message: 'Signed in successfully!' };
    } catch (error: any) {
      const message = error.message || 'Failed to sign in';
      this.setState({ error: message });
      return { success: false, message };
    } finally {
      this.setState({ loading: false });
    }
  }

  async resetPassword(email: string) {
    try {
      this.setState({ loading: true, error: null });

      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase is not configured. Please contact support.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset link sent! Check your email for instructions.'
      };
    } catch (error: any) {
      const message = error.message || 'Failed to send reset email';
      this.setState({ error: message });
      return { success: false, message };
    } finally {
      this.setState({ loading: false });
    }
  }

  async signOut() {
    try {
      this.setState({ loading: true, error: null });

      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase is not configured. Please contact support.');
      }

      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error && error.status !== 404) throw error; // Ignore 404 errors (session already gone)

      // Clear local state
      this.setState({ user: null, error: null });

      return { success: true, message: 'Signed out successfully!' };
    } catch (error: any) {
      const message = error.message || 'Failed to sign out';
      this.setState({ error: message, user: null });
      return { success: false, message };
    } finally {
      this.setState({ loading: false });
    }
  }

  async updateProfile(updates: Partial<User>) {
    try {
      if (!this.state.user) throw new Error('No user logged in');

      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase is not configured. Please contact support.');
      }

      this.setState({ loading: true, error: null });

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', this.state.user.id);

      if (error) throw error;

      // Reload user profile
      await this.loadUserProfile(this.state.user.id);

      return { success: true, message: 'Profile updated successfully!' };
    } catch (error: any) {
      const message = error.message || 'Failed to update profile';
      this.setState({ error: message });
      return { success: false, message };
    } finally {
      this.setState({ loading: false });
    }
  }

  hasRole(role: string): boolean {
    return this.state.user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    return this.state.user ? roles.includes(this.state.user.role) : false;
  }

  async getSessionSafely() {
    try {
      if (!SUPABASE_CONFIGURED) {
        return null;
      }
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Unexpected error getting session:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
