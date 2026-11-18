import { useState } from 'react';
import type { CandidateStatus } from '@hsdeck/shared';
import { useCandidates, useCollectNow, useMe } from '../api/hooks';
import { errorMessage } from '../api/client';
import { CandidateCard } from '../components/admin/CandidateCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';

export function AdminQueuePage() {
  const me = useMe();
  if (me.isPending) return <Spinner label="Loading" />;
  if (!me.data?.user?.isAdmin) {
    return <EmptyState title="Not found" description="There is nothing at this address." />;
  }
  return <Queue />;
}

function Queue() {
  const [status, setStatus] = useState<CandidateStatus>('pending');
  const candidates = useCandidates(status);
  const collect = useCollectNow();
  const toast = useToast();

  const onCollect = () =>
    collect.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(`Collected: ${r.scanned} scanned, ${r.added} new, ${r.skipped} skipped.`),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pro list queue</h1>
          <p className="text-sm text-ink-muted">
            Deck codes collected from creator sources. Approve to import as a published pro list.
          </p>
        </div>
        <Button variant="secondary" loading={collect.isPending} onClick={onCollect}>
          Collect now
        </Button>
      </div>
      <SegmentedControl<CandidateStatus>
        label="Candidate status"
        size="sm"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />
      {candidates.isPending && <Spinner label="Loading candidates" />}
      {candidates.isError && (
        <EmptyState
          title="Could not load candidates"
          description={errorMessage(candidates.error)}
        />
      )}
      {candidates.data && candidates.data.items.length === 0 && (
        <EmptyState
          title={`No ${status} candidates`}
          description={
            status === 'pending'
              ? 'Run "Collect now" or wait for the scheduled collection.'
              : undefined
          }
        />
      )}
      {candidates.data && candidates.data.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {candidates.data.items.map((c) => (
            <li key={c.id}>
              <CandidateCard candidate={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
