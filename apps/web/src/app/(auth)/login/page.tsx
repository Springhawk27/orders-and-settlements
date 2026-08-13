import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

const LoginPage = () => <LoginForm />;

export default LoginPage;
