import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Center,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { registerAccount } from '@/lib/auth';

export function RegisterPage() {
  const { t, i18n } = useTranslation();

  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      full_name: '',
      password: '',
      confirm: '',
    },
    validate: {
      email: (v) =>
        /^\S+@\S+\.\S+$/.test(v) ? null : t('login.invalidEmail'),
      password: (v) =>
        v.length >= 8 ? null : t('acceptInvite.passwordTooShort'),
      confirm: (v, values) =>
        v === values.password ? null : t('acceptInvite.passwordMismatch'),
    },
  });

  const handleSubmit = form.onSubmit(async ({ email, full_name, password }) => {
    setError(null);
    setSubmitting(true);
    try {
      await registerAccount({
        email,
        password,
        full_name: full_name || null,
        language: i18n.language?.split('-')[0] ?? 'en',
      });
      setSubmitted(email);
    } catch (err) {
      const resp = (err as { response?: { status?: number; data?: { detail?: string } } })
        .response;
      if (resp?.status === 404) {
        setError(t('register.signupClosed'));
      } else if (resp?.status === 409) {
        setError(t('register.emailTaken'));
      } else if (resp?.status === 400) {
        setError(resp.data?.detail ?? t('register.unknownError'));
      } else {
        setError(t('register.unknownError'));
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (submitted) {
    return (
      <Center h="100vh">
        <Container size={420} w="100%">
          <Title ta="center" mb="lg">
            {t('register.checkEmailTitle')}
          </Title>
          <Paper withBorder shadow="md" p="xl" radius="md">
            <Stack>
              <Alert color="teal">
                {t('register.checkEmailBody', { email: submitted })}
              </Alert>
              <Anchor component={Link} to="/login" size="sm" ta="center">
                {t('forgotPassword.backToLogin')}
              </Anchor>
            </Stack>
          </Paper>
        </Container>
      </Center>
    );
  }

  return (
    <Center h="100vh">
      <Container size={420} w="100%">
        <Title ta="center" mb="lg">
          {t('register.title')}
        </Title>
        <Paper withBorder shadow="md" p="xl" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack>
              <Text c="dimmed" size="sm">
                {t('register.intro')}
              </Text>
              <TextInput
                label={t('login.email')}
                placeholder="you@example.com"
                required
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...form.getInputProps('email')}
              />
              <TextInput
                label={t('register.fullName')}
                autoComplete="name"
                {...form.getInputProps('full_name')}
              />
              <PasswordInput
                label={t('acceptInvite.password')}
                required
                autoComplete="new-password"
                {...form.getInputProps('password')}
              />
              <PasswordInput
                label={t('acceptInvite.confirmPassword')}
                required
                autoComplete="new-password"
                {...form.getInputProps('confirm')}
              />
              {error && <Alert color="red">{error}</Alert>}
              <Button type="submit" fullWidth loading={submitting}>
                {t('register.submit')}
              </Button>
              <Anchor component={Link} to="/login" size="sm" ta="center">
                {t('forgotPassword.backToLogin')}
              </Anchor>
            </Stack>
          </form>
        </Paper>
      </Container>
    </Center>
  );
}
