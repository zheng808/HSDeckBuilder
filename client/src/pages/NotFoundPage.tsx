import { Link } from 'react-router';
import { buttonClasses } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="That link leads nowhere. Head back to the published decks."
      action={
        <Link to="/" className={buttonClasses('secondary', 'sm')}>
          Go home
        </Link>
      }
    />
  );
}
