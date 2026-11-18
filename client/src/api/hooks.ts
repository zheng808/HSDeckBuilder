import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CandidateStatus, Card, CardClass, DeckInput, DeckUpdate } from '@hsdeck/shared';
import { api } from './client';
import type {
  ArchetypesResponse,
  CandidatesResponse,
  CollectResponse,
  DeckListParams,
  DeckListResponse,
  DeckResponse,
  DecodeResponse,
  LikeResponse,
  MeResponse,
  MetaResponse,
  MyDecksResponse,
  ProfileResponse,
  ProvidersResponse,
} from './types';

export const queryKeys = {
  meta: ['meta'] as const,
  cards: (cls: CardClass | null) => ['cards', cls] as const,
  decks: (params: DeckListParams) => ['decks', params] as const,
  deck: (id: string) => ['deck', id] as const,
  myDecks: ['my-decks'] as const,
  archetypes: ['archetypes'] as const,
  me: ['me'] as const,
  providers: ['auth-providers'] as const,
  profile: (id: string) => ['profile', id] as const,
  candidates: (status: CandidateStatus) => ['candidates', status] as const,
};

export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: () => api<MetaResponse>('/api/meta'),
    staleTime: Infinity,
  });
}

/**
 * All cards a class may run (class + neutral + multi-class), in both formats.
 * Standard legality is filtered client-side via `card.standard` so toggling
 * the format never refetches.
 */
export function useCards(cls: CardClass | null) {
  return useQuery({
    queryKey: queryKeys.cards(cls),
    queryFn: () => api<Card[]>('/api/cards', { query: { class: cls } }),
    enabled: cls !== null,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  });
}

export function useDecks(params: DeckListParams) {
  return useQuery({
    queryKey: queryKeys.decks(params),
    queryFn: () => api<DeckListResponse>('/api/decks', { query: { ...params } }),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useArchetypes() {
  return useQuery({
    queryKey: queryKeys.archetypes,
    queryFn: () => api<ArchetypesResponse>('/api/archetypes'),
    staleTime: 1000 * 60,
  });
}

export function useDeck(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deck(id ?? ''),
    queryFn: () => api<DeckResponse>(`/api/decks/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    staleTime: 1000 * 10,
    retry: false,
  });
}

export function useMyDecks() {
  return useQuery({
    queryKey: queryKeys.myDecks,
    queryFn: () => api<MyDecksResponse>('/api/my/decks'),
    staleTime: 1000 * 10,
  });
}

function useInvalidateLists() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['decks'] });
    void qc.invalidateQueries({ queryKey: queryKeys.myDecks });
  };
}

export function useCreateDeck() {
  const qc = useQueryClient();
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (input: DeckInput) =>
      api<DeckResponse>('/api/decks', { method: 'POST', body: input }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.deck(data.deck.id), data);
      invalidate();
    },
  });
}

export function useUpdateDeck() {
  const qc = useQueryClient();
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DeckUpdate }) =>
      api<DeckResponse>(`/api/decks/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.deck(data.deck.id), data);
      invalidate();
    },
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/api/decks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.deck(id) });
      invalidate();
    },
  });
}

function usePublishMutation(action: 'publish' | 'unpublish') {
  const qc = useQueryClient();
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (id: string) =>
      api<DeckResponse>(`/api/decks/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.deck(data.deck.id), data);
      invalidate();
    },
  });
}

export function usePublishDeck() {
  return usePublishMutation('publish');
}

export function useUnpublishDeck() {
  return usePublishMutation('unpublish');
}

export function useDecodeDeckCode() {
  return useMutation({
    mutationFn: (code: string) =>
      api<DecodeResponse>('/api/deckcode/decode', { method: 'POST', body: { code } }),
  });
}

// ---------- accounts ----------

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<MeResponse>('/api/auth/me'),
    staleTime: 1000 * 60,
    retry: false,
  });
}

export function useAuthProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => api<ProvidersResponse>('/api/auth/providers'),
    staleTime: Infinity,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(id ?? ''),
    queryFn: () => api<ProfileResponse>(`/api/users/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    staleTime: 1000 * 30,
    retry: false,
  });
}

// ---------- likes ----------

function useLikeMutation(method: 'PUT' | 'DELETE') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<LikeResponse>(`/api/decks/${encodeURIComponent(id)}/like`, { method }),
    onSuccess: (data, id) => {
      qc.setQueryData<DeckResponse>(queryKeys.deck(id), (old) =>
        old ? { ...old, liked: data.liked, deck: { ...old.deck, likes: data.likes } } : old,
      );
      void qc.invalidateQueries({ queryKey: ['decks'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: queryKeys.myDecks });
    },
  });
}

export function useLikeDeck() {
  return useLikeMutation('PUT');
}

export function useUnlikeDeck() {
  return useLikeMutation('DELETE');
}

// ---------- admin: pro-list candidates ----------

export function useCandidates(status: CandidateStatus) {
  return useQuery({
    queryKey: queryKeys.candidates(status),
    queryFn: () => api<CandidatesResponse>('/api/admin/candidates', { query: { status } }),
    staleTime: 1000 * 10,
    retry: false,
  });
}

function useInvalidateCandidates() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['candidates'] });
    void qc.invalidateQueries({ queryKey: ['decks'] });
    void qc.invalidateQueries({ queryKey: queryKeys.archetypes });
  };
}

export interface ApproveCandidateInput {
  id: string;
  name?: string;
  archetype?: string | null;
}

export function useApproveCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: ({ id, ...body }: ApproveCandidateInput) =>
      api<{ candidate: CandidatesResponse['items'][number]; deck: DeckResponse['deck'] }>(
        `/api/admin/candidates/${encodeURIComponent(id)}/approve`,
        { method: 'POST', body },
      ),
    onSuccess: invalidate,
  });
}

export function useRejectCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ candidate: CandidatesResponse['items'][number] }>(
        `/api/admin/candidates/${encodeURIComponent(id)}/reject`,
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  });
}

export function useCollectNow() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: () => api<CollectResponse>('/api/admin/collect', { method: 'POST' }),
    onSuccess: invalidate,
  });
}
