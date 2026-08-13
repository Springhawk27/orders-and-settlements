'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@crossval/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { handleFormApiError } from '@/lib/form-errors';
import { useLogin } from '../use-login';

export const LoginForm = () => {
  const router = useRouter();
  const login = useLogin();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => router.replace('/dashboard'),
      onError: (error) => handleFormApiError(error, form.setError),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the account you registered with.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* The schema is the single source of validation, so the browser's own
            rules are turned off rather than allowed to disagree with it. */}
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...form.register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...form.register('password')}
              />
              <FieldError errors={[errors.password]} />
            </Field>

            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Signing in' : 'Sign in'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          No account yet?{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};
