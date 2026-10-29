import { language, safeReturnTo } from '@/lib/supabase-auth-flow.mjs';
import styles from './auth.module.css';

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';

const notices: Record<string, { ru: string; en: string }> = {
  invalid: { ru: 'Проверьте введённые данные.', en: 'Check the details you entered.' },
  signin: { ru: 'Не удалось войти. Проверьте данные или попробуйте позже.', en: 'Unable to sign in. Check your details or try again later.' },
  signup: { ru: 'Не удалось создать аккаунт. Проверьте данные и код приглашения или попробуйте позже.', en: 'Unable to create the account. Check your details and invitation code or try again later.' },
  configured: { ru: 'Вход временно недоступен. Попробуйте позже.', en: 'Sign-in is temporarily unavailable. Please try again later.' },
  signedout: { ru: 'Вы вышли из аккаунта.', en: 'You have signed out.' },
  revoked: { ru: 'Код приглашения отозван.', en: 'Invitation code revoked.' },
  invite_error: { ru: 'Не удалось создать или отозвать код. Попробуйте позже.', en: 'Unable to create or revoke the code. Please try again later.' },
};

export function noticeText(key: string, lang: 'ru' | 'en') {
  return notices[key]?.[lang] || '';
}

export default function AuthForm({ mode, params }: { mode: 'signin' | 'signup'; params: Params }) {
  const lang = language(one(params.lang)), ru = lang === 'ru', signup = mode === 'signup';
  const returnTo = safeReturnTo(one(params.return_to)), notice = noticeText(one(params.notice), lang);
  const page = signup ? '/auth/signup' : '/auth/signin';
  const link = (path: string, targetLang = lang) => `${path}?${new URLSearchParams({ lang: targetLang, return_to: returnTo })}`;
  return <main className={styles.frame} lang={lang}>
    <section className={styles.card} aria-labelledby="auth-title">
      <div className={styles.top}><span>NIGHT CITY // RED</span><nav aria-label={ru ? 'Язык' : 'Language'}>
        <a href={link(page, 'ru')} aria-current={ru ? 'page' : undefined}>RU</a>
        <a href={link(page, 'en')} aria-current={!ru ? 'page' : undefined}>EN</a>
      </nav></div>
      <h1 id="auth-title">{signup ? (ru ? 'Создать аккаунт' : 'Create account') : (ru ? 'Войти в аккаунт' : 'Sign in')}</h1>
      <p>{signup
        ? (ru ? 'Для регистрации нужен код приглашения от ведущего.' : 'You need an invitation code from the host to register.')
        : (ru ? 'Ваши персонажи и кампании сохраняются в вашей учётной записи.' : 'Your characters and campaigns are saved to your account.')}</p>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <form method="post" action={signup ? '/auth/register' : '/auth/login'}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="return_to" value={returnTo} />
        <label>{ru ? 'Логин' : 'Username'}<input type="text" name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]{3,32}" required /></label>
        {signup && <p className={styles.hint}>{ru ? 'От 3 до 32 латинских букв, цифр и символов _ . -' : '3 to 32 Latin letters, numbers, or _ . -'}</p>}
        <label>{ru ? 'Пароль' : 'Password'}<input type="password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required /></label>
        {signup && <>
          <p className={styles.hint}>{ru ? 'От 12 до 128 символов. Сохраните пароль: восстановление по почте недоступно.' : '12 to 128 characters. Save your password: email recovery is unavailable.'}</p>
          <label>{ru ? 'Код приглашения' : 'Invitation code'}<input type="text" name="invite_code" autoComplete="off" spellCheck={false} required /></label>
        </>}
        <button type="submit">{signup ? (ru ? 'Зарегистрироваться' : 'Sign up') : (ru ? 'Войти' : 'Sign in')}</button>
      </form>
      <div className={styles.links}>
        <a href={link(signup ? '/auth/signin' : '/auth/signup')}>{signup ? (ru ? 'Уже есть аккаунт? Войти' : 'Already have an account? Sign in') : (ru ? 'Создать аккаунт по приглашению' : 'Register with an invitation')}</a>
        <a href={returnTo}>{ru ? 'Вернуться к игре' : 'Back to game'}</a>
        <a href={link('/auth/account')}>{ru ? 'Управление аккаунтом' : 'Manage account'}</a>
      </div>
    </section>
  </main>;
}
