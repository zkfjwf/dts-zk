import { Model } from "@nozbe/watermelondb";
import { date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class Post extends Model {
  static table = "posts";

  // @ts-ignore
  @text("space_id") spaceId;

  // @ts-ignore
  @text("uploader_id") uploaderId;

  // @ts-ignore
  @text("uploader_name") uploaderName;

  // @ts-ignore
  @text("text") textContent;

  // @ts-ignore
  @readonly @date("created_at") createdAt;

  // @ts-ignore
  @readonly @date("updated_at") updatedAt;
}
