import { Model } from "@nozbe/watermelondb";
import { date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class PostComment extends Model {
  static table = "post_comments";

  // @ts-ignore
  @text("space_id") spaceId;

  // @ts-ignore
  @text("post_id") postId;

  // @ts-ignore
  @text("author_id") authorId;

  // @ts-ignore
  @text("author_name") authorName;

  // @ts-ignore
  @text("text") textContent;

  // @ts-ignore
  @readonly @date("created_at") createdAt;

  // @ts-ignore
  @readonly @date("updated_at") updatedAt;
}
