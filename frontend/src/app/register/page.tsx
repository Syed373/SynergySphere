import { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Register - SynergySphere',
  description: 'Create your SynergySphere account and start collaborating with your team today.',
  robots: 'noindex, nofollow',
};

export default function RegisterPage() {
  return <RegisterForm />;
}