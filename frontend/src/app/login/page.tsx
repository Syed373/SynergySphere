import { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Login - SynergySphere',
  description: 'Sign in to your SynergySphere account to access your team collaboration platform.',
  robots: 'noindex, nofollow',
};

export default function LoginPage() {
  return <LoginForm />;
}