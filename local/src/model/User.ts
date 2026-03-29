import { Model } from "@nozbe/watermelondb";
import { date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class User extends Model {
  static table = "users";

  // @ts-ignore
  @text("user_id") userId;

  // @ts-ignore
  @text("nickname") nickname;

  // @ts-ignore
  @text("avatar_local_uri") avatarLocalUri;

  // @ts-ignore
  @text("avatar_remote_url") avatarRemoteUrl;

  // @ts-ignore
  @readonly @date("created_at") createdAt;

  // @ts-ignore
  @readonly @date("updated_at") updatedAt;
}
