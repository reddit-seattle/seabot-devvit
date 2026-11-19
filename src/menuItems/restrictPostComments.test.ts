import { Context, MenuItemOnPressEvent } from "@devvit/public-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { restrictedFlairMenuItems } from "./restrictPostComments.js";

describe.each([
  {
    label: "Require Flair for Comments",
    description: "Restrict this post to flaired users",
    flairText: "Market Traffic Only",
    otherFlair: "Market Bollards",
  },
  {
    label: "Raise Market Bollards",
    description: "Apply strict contributor requirements to this thread",
    flairText: "Market Bollards",
    otherFlair: "Market Traffic Only",
  },
])("$flairText menu", ({ label, description, flairText, otherFlair }) => {
  const menu = restrictedFlairMenuItems.find((item) => item.label === label)!;
  const getPostById = vi.fn();
  const setPostFlair = vi.fn();
  const showToast = vi.fn();
  const context = {
    reddit: { getPostById, setPostFlair },
    ui: { showToast },
    subredditName: "testsubreddit",
  } as unknown as Context;
  const event = { targetId: "t3_abc", location: "post" } as MenuItemOnPressEvent;
  const post = { id: "t3_abc", permalink: "/r/testsubreddit/comments/abc/test/" };

  beforeEach(() => {
    vi.resetAllMocks();
    getPostById.mockResolvedValue(post);
  });

  it("has the expected label and is available only to moderators on posts", () => {
    expect(menu).toMatchObject({ label, description, location: "post", forUserType: "moderator" });
  });

  it.each([undefined, null, { text: "Discussion" }, { text: otherFlair }])(
    "applies the selected mode over existing flair %j",
    async (flair) => {
      getPostById.mockResolvedValue({ ...post, flair });
      await menu.onPress(event, context);
      expect(getPostById).toHaveBeenCalledExactlyOnceWith("t3_abc");
      expect(setPostFlair).toHaveBeenCalledExactlyOnceWith({
        postId: "t3_abc",
        text: flairText,
        subredditName: "testsubreddit",
      });
      expect(showToast).toHaveBeenCalledExactlyOnceWith({
        text: `${flairText} applied to this post.`,
        appearance: "success",
      });
    },
  );

  it("does not reapply an already selected mode", async () => {
    getPostById.mockResolvedValue({ ...post, flair: { text: flairText } });
    await menu.onPress(event, context);
    expect(setPostFlair).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledExactlyOnceWith(
      `${flairText} is already applied to this post.`,
    );
  });

  it.each([
    [undefined, "testsubreddit"],
    ["", "testsubreddit"],
    ["t3_abc", undefined],
  ])("rejects missing context (post: %s, subreddit: %s)", async (targetId, subredditName) => {
    await menu.onPress(
      { ...event, targetId } as MenuItemOnPressEvent,
      { ...context, subredditName },
    );
    expect(getPostById).not.toHaveBeenCalled();
    expect(setPostFlair).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledExactlyOnceWith("Unable to identify this post or subreddit.");
  });

  it.each([
    ["fetch", new Error("Post not found")],
    ["flair", new Error("Flair setting failed")],
    ["fetch", "Unknown error"],
    ["fetch", null],
    ["fetch", ""],
  ])("reports a %s failure (%s) without claiming success", async (step, error) => {
    (step === "fetch" ? getPostById : setPostFlair).mockRejectedValue(error);
    await menu.onPress(event, context);
    expect(showToast).toHaveBeenCalledExactlyOnceWith(
      `Failed to apply ${flairText}. Please try again.`,
    );
    if (step === "fetch") expect(setPostFlair).not.toHaveBeenCalled();
  });
});
