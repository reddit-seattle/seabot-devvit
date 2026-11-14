import { vi } from "vitest";
import {
  Listing,
  type ModAction,
  type ModActionDefinition,
  type TriggerContext,
} from "@devvit/public-api";
import LogFirstShadowban from "./logFirstShadowban.js";
import { ShadowbanWarmup } from "./warmShadowbanCache.js";
import { SendContentToWebhook } from "../utils/webhooks.js";

const WEBHOOK = "https://discord.com/api/webhooks/example";
const START = Date.parse("2026-11-14T08:00:00Z");

export function action(
  id: number,
  author = "New",
  changes: Partial<ModAction> = {},
): ModAction {
  return {
    id: `ModAction_${id}`,
    type: "removecomment",
    moderatorName: "AutoModerator",
    moderatorId: "t2_auto",
    subredditName: "Seattle",
    subredditId: "t5_seattle",
    createdAt: new Date(START + id * 1000),
    details: "Removed for negative karma",
    target: {
      id: `t1_${id}`,
      author,
      permalink: `/r/Seattle/comments/post/_/${id}/`,
    },
    ...changes,
  };
}

export function fixture(rows = [action(-10, "Known")]) {
  let stored: string | undefined;
  const seen = new Set<string>();
  const redis = {
    get: vi.fn(async () => stored),
    hSetNX: async (_key: string, user: string) => {
      if (seen.has(user)) return 0;
      seen.add(user);
      return 1;
    },
    watch: async () => {
      const previous = stored;
      const writes: (() => void)[] = [];
      return {
        multi: async () => {},
        unwatch: async () => {},
        set: async (_key: string, value: string) => {
          writes.push(() => {
            stored = value;
          });
        },
        hSet: async (_key: string, users: Record<string, string>) => {
          writes.push(() =>
            Object.keys(users).forEach((user) => seen.add(user)),
          );
        },
        exec: async () => {
          if (stored !== previous) return [];
          writes.forEach((write) => write());
          return writes.map(() => "OK");
        },
      };
    },
  };
  const pages = vi.fn(
    async ({ after, limit = 100 }: { after?: string; limit?: number }) => {
      const start = after ? rows.findIndex((row) => row.id === after) + 1 : 0;
      const children = rows.slice(start, start + limit);
      return {
        children,
        after:
          start + children.length < rows.length
            ? children[children.length - 1]?.id
            : undefined,
      };
    },
  );
  const context = {
    subredditName: "Seattle",
    redis,
    settings: { get: vi.fn(async () => WEBHOOK) },
    reddit: {
      getModerationLog: vi.fn(
        (options) => new (Listing as any)({ ...options, fetch: pages }),
      ),
    },
    scheduler: {
      runJob: vi.fn(async (_job: any) => "job"),
      cancelJob: vi.fn(async (_id: string) => {}),
      listJobs: vi.fn(async (): Promise<any[]> => []),
    },
  };
  const ctx = context as unknown as TriggerContext;
  const run = (record: ModAction) =>
    LogFirstShadowban.onEvent(
      {
        action: record.type,
        id: record.id.replace(/^ModAction_/i, ""),
        actionedAt: record.createdAt,
        moderator: { name: record.moderatorName } as Parameters<
          ModActionDefinition["onEvent"]
        >[0]["moderator"],
      },
      ctx,
    );
  const send = vi
    .mocked(SendContentToWebhook)
    .mockReset()
    .mockResolvedValue(new Response("{}"));
  return {
    context,
    ctx,
    run,
    send,
    pages,
    seen,
    warm: () =>
      ShadowbanWarmup.onRun(
        { name: ShadowbanWarmup.name, data: undefined },
        ctx,
      ),
    state: () => JSON.parse(stored || "{}"),
    prepend: (...items: ModAction[]) => {
      rows = [...items, ...rows];
    },
  };
}
