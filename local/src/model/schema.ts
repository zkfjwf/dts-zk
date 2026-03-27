import { appSchema, tableSchema } from "@nozbe/watermelondb";

export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: "spaces",
      columns: [
        { name: "title", type: "string" },
        { name: "space_id", type: "string" },
        { name: "created_at", type: "number" },
        { name: "update_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "expenses",
      columns: [
        { name: "space_id", type: "string", isIndexed: true },
        { name: "payer_id", type: "string" },
        { name: "payer_name", type: "string", isOptional: true },
        { name: "amount", type: "number" },
        { name: "description", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "photos",
      columns: [
        { name: "space_id", type: "string", isIndexed: true },
        { name: "post_id", type: "string", isOptional: true, isIndexed: true },
        { name: "uploader_id", type: "string" },
        { name: "local_path", type: "string" },
        { name: "remote_url", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "posts",
      columns: [
        { name: "space_id", type: "string", isIndexed: true },
        { name: "uploader_id", type: "string" },
        { name: "uploader_name", type: "string", isOptional: true },
        { name: "text", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
  ],
});
