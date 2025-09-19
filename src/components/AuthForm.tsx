'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabaseApi } from '@/lib/supabase-api';

interface AuthFormProps {
  onAuthSuccess: (user: { id: string; email: string }) => void;
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = isLogin 
        ? await supabaseApi.signIn(email, password)
        : await supabaseApi.signUp(email, password);
      
      if (result.user) {
        if (isLogin) {
          // For login, proceed as normal
          onAuthSuccess({
            id: result.user.id,
            email: result.user.email || email
          });
        } else {
          // For registration, show success message instead of logging in
          setRegistrationSuccess(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Show registration success message
  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-green-600">Registration Successful!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-lg">✅</div>
            <p className="text-gray-700">
              Your account has been created successfully!
            </p>
            <p className="text-gray-600 text-sm">
              Please check your email <strong>{email}</strong> and click the confirmation link to activate your account.
            </p>
            <Button
              onClick={() => {
                setRegistrationSuccess(false);
                setIsLogin(true);
                setEmail('');
                setPassword('');
              }}
              className="w-full"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? 'Sign In' : 'Sign Up'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}