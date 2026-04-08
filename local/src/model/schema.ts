import { appSchema, tableSchema } from "@nozbe/watermelondb";

// schema 定义了 docs/data-design.md 中约定的本地离线数据表结构。
export default appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: "users",
      columns: [
        { name: "nickname", type: "string" },
        { name: "avatar_local_uri", type: "string", isOptional: true },
        { name: "avatar_remote_url", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "deleted_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "spaces",
      columns: [
        { name: "name", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "space_members",
      columns: [
        { name: "space_id", type: "string", isIndexed: true },
        { name: "user_id", type: "string", isIndexed: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "deleted_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "expenses",
      columns: [
        { name: "space_id", type: "string", isIndexed: true },
        { name: "payer_id", type: "string" },
        { name: "amount", type: "number" },
        { name: "description", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "deleted_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "photos",
      columns: [
        { name: "space_id", type: "string", isIndexed: true },
        { name: "uploader_id", type: "string" },
        { name: "local_uri", type: "string", isOptional: true },
        { name: "remote_url", type: "string", isOptional: true },
        { name: "post_id", type: "string", isIndexed: true },
        { name: "shoted_at", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "deleted_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "posts",
      columns: [
        { name: "poster_id", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "deleted_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "comments",
      columns: [
        { name: "post_id", type: "string", isIndexed: true },
        { name: "content", type: "string" },
        { name: "commenter_id", type: "string" },
        { name: "commented_at", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "deleted_at", type: "number", isOptional: true },
      ],
    }),
  ],
});
