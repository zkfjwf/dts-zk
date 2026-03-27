import { Model } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  readonly,
  relation,
} from "@nozbe/watermelondb/decorators";

export default class Expense extends Model {
  // 瀵瑰簲 schema 涓殑 'expenses' 琛?
  static table = "expenses";

  // 瀹氫箟鍏宠仈锛氳繖涓处鍗曞睘浜庡摢涓┖闂?
  // @ts-ignore
  @relation("spaces", "space_id") space;

  // @ts-ignore
  @text("space_id") spaceId;

  // @ts-ignore
  @text("payer_id") payerId;

  // @ts-ignore
  @text("payer_name") payerName;

  // @ts-ignore
  @field("amount") amount;

  // @ts-ignore
  @text("description") description;

  // WatermelonDB 浼氳嚜鍔ㄧ鐞嗙殑鍒涘缓/鏇存柊鏃堕棿
  // @ts-ignore
  @readonly @date("created_at") createdAt;

  // @ts-ignore
  @readonly @date("updated_at") updatedAt;
}
