import { getAccountOverview } from '@/lib/password-auth';
import { language } from '@/lib/supabase-auth-flow.mjs';
import { noticeText } from '../auth-form';
import styles from '../auth.module.css';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const lang = language(typeof params.lang === 'string' ? params.lang : ''), ru = lang === 'ru';
  const notice = noticeText(typeof params.notice === 'string' ? params.notice : '', lang);
  const account = await getAccountOverview();
  const date = (value: number | string) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', { dateStyle: 'medium' }).format(new Date(Number(value)));

  return <main className={styles.frame} lang={lang}><section className={styles.card} aria-labelledby="account-title">
    <div className={styles.top}><span>NIGHT CITY // RED</span><nav aria-label={ru ? 'Язык' : 'Language'}><a href="/auth/account?lang=ru" aria-current={ru ? 'page' : undefined}>RU</a><a href="/auth/account?lang=en" aria-current={!ru ? 'page' : undefined}>EN</a></nav></div>
    <h1 id="account-title">{ru ? 'Управление аккаунтом' : 'Manage account'}</h1>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!account ? <>
      <p>{ru ? 'Войдите, чтобы управлять аккаунтом.' : 'Sign in to manage your account.'}</p>
      <div className={styles.links}><a href={`/auth/signin?lang=${lang}`}>{ru ? 'Войти' : 'Sign in'}</a></div>
    </> : <>
      <p>{ru ? 'Вы вошли как' : 'Signed in as'} <strong>{account.username}</strong>.</p>
      {account.isOwner && <section aria-labelledby="invites-title">
        <h2 id="invites-title">{ru ? 'Приглашения игроков' : 'Player invitations'}</h2>
        <p>{ru ? 'Создайте одноразовый код и передайте его игроку. При создании код показывается только один раз.' : 'Create a single-use code and give it to a player. The code is shown only once when created.'}</p>
        <form method="post" action="/auth/invites">
          <input type="hidden" name="lang" value={lang}/><input type="hidden" name="action" value="create"/>
          <button type="submit">{ru ? 'Создать код' : 'Create code'}</button>
        </form>
        {account.invites.length > 0 && <ul className={styles.inviteList}>
          {account.invites.map(invite => {
            const state = invite.usedAt ? (ru ? 'Использован' : 'Used') : invite.revokedAt ? (ru ? 'Отозван' : 'Revoked') : Number(invite.expiresAt) <= Date.now() ? (ru ? 'Истёк' : 'Expired') : (ru ? 'Действует' : 'Active');
            const active = !invite.usedAt && !invite.revokedAt && Number(invite.expiresAt) > Date.now();
            return <li key={invite.id}><span>{state} · {ru ? 'создан' : 'created'} {date(invite.createdAt)} · {ru ? 'до' : 'expires'} {date(invite.expiresAt)}</span>
              {active && <form method="post" action="/auth/invites"><input type="hidden" name="lang" value={lang}/><input type="hidden" name="action" value="revoke"/><input type="hidden" name="invite_id" value={invite.id}/><button type="submit">{ru ? 'Отозвать' : 'Revoke'}</button></form>}
            </li>;
          })}
        </ul>}
      </section>}
      <p>{ru ? 'Перед выходом дождитесь синхронизации и сохраните незавершённые черновики.' : 'Before signing out, wait for sync and save unfinished drafts.'}</p>
      <form method="post" action="/auth/logout"><input type="hidden" name="lang" value={lang}/><button type="submit">{ru ? 'Выйти' : 'Sign out'}</button></form>
    </>}
    <div className={styles.links}><a href="/game/index.html">{ru ? 'Вернуться к игре' : 'Back to game'}</a></div>
  </section></main>;
}
