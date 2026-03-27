import { Model } from "@nozbe/watermelondb";
import { date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class Photo extends Model {
  static table = "photos";

  // @ts-ignore
  @text("space_id") spaceId;

  // @ts-ignore
  @text("post_id") postId;

  // @ts-ignore
  @text("uploader_id") uploaderId;

  // @ts-ignore
  @text("local_path") localPath;

  // @ts-ignore
  @text("remote_url") remoteUrl;

  // @ts-ignore
  @readonly @date("created_at") createdAt;

  // @ts-ignore
  @readonly @date("updated_at") updatedAt;
}
