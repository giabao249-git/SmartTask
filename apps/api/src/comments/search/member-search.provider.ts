export interface MemberSuggestion {
  id: string;
  fullName: string;
  shortName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  score: number;
}

/** Một cách tìm thành viên cho @mention. Có hai hiện thực: Elasticsearch (khi cấu hình) và pg_trgm (luôn có). */
export interface MemberSearchProvider {
  readonly name: string;
  suggestProjectMembers(
    projectId: string,
    q: string | undefined,
    limit: number,
  ): Promise<MemberSuggestion[]>;
}
