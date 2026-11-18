import { useLocation } from 'react-router';
import { useAuthProviders } from '../../api/hooks';
import { loginUrl, PROVIDER_LABEL } from '../../lib/auth';
import { buttonClasses, type ButtonSize, type ButtonVariant } from '../ui/Button';

interface SignInLinksProps {
  returnTo?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** One link per configured OAuth provider. Full-page navigation (server redirect). */
export function SignInLinks({
  returnTo,
  variant = 'secondary',
  size = 'sm',
  className,
}: SignInLinksProps) {
  const location = useLocation();
  const providers = useAuthProviders();
  const target = returnTo ?? `${location.pathname}${location.search}`;
  const list = providers.data?.providers ?? [];

  if (providers.isPending)
    return <p className="text-xs text-ink-muted">Loading sign-in options…</p>;
  if (list.length === 0) {
    return <p className="text-xs text-ink-muted">Sign-in is not configured on this server.</p>;
  }
  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      {list.map((p) => (
        <a key={p} href={loginUrl(p, target)} className={buttonClasses(variant, size)}>
          Continue with {PROVIDER_LABEL[p]}
        </a>
      ))}
    </div>
  );
}
