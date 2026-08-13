import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata: Metadata = {
  title: 'Create an account',
};

const RegisterPage = () => <RegisterForm />;

export default RegisterPage;
