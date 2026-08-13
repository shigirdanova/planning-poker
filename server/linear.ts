const ENDPOINT = "https://api.linear.app/graphql";

export type LinearIssue = {
  issueId: string;
  identifier: string;
  title: string;
  url: string;
};

export function linearConfigured(): boolean {
  return Boolean(process.env.LINEAR_API_KEY?.trim());
}

function parseQuery(raw: string): string {
  const text = raw.trim();
  const fromUrl = text.match(/([A-Z][A-Z0-9]+-\d+)/i);
  return fromUrl ? fromUrl[1].toUpperCase() : text;
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.LINEAR_API_KEY?.trim();
  if (!key) throw new Error("Set LINEAR_API_KEY to talk to Linear");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message ?? "Linear request failed");
  }
  if (!body.data) throw new Error("Linear returned no data");
  return body.data;
}

export async function lookupIssue(raw: string): Promise<LinearIssue> {
  const q = parseQuery(raw);
  if (!q) throw new Error("Paste a Linear issue ID or URL");

  try {
    const byId = await graphql<{
      issue: { id: string; identifier: string; title: string; url: string } | null;
    }>(
      `query One($id: String!) {
        issue(id: $id) { id identifier title url }
      }`,
      { id: q },
    );
    if (byId.issue) {
      return {
        issueId: byId.issue.id,
        identifier: byId.issue.identifier,
        title: byId.issue.title,
        url: byId.issue.url,
      };
    }
  } catch {
    /* fall through to search */
  }

  const data = await graphql<{
    searchIssues: { nodes: { id: string; identifier: string; title: string; url: string }[] };
  }>(
    `query Search($q: String!) {
      searchIssues(term: $q, first: 5) {
        nodes { id identifier title url }
      }
    }`,
    { q },
  );

  const exact = data.searchIssues.nodes.find(
    (node) => node.identifier.toUpperCase() === q.toUpperCase(),
  );
  const node = exact ?? data.searchIssues.nodes[0];
  if (!node) throw new Error(`No Linear issue matched "${q}"`);
  return {
    issueId: node.id,
    identifier: node.identifier,
    title: node.title,
    url: node.url,
  };
}

export async function saveEstimate(issueId: string, estimate: number): Promise<void> {
  const data = await graphql<{ issueUpdate: { success: boolean } }>(
    `mutation Save($id: String!, $estimate: Int!) {
      issueUpdate(id: $id, input: { estimate: $estimate }) { success }
    }`,
    { id: issueId, estimate },
  );
  if (!data.issueUpdate.success) throw new Error("Linear did not save the estimate");
}
