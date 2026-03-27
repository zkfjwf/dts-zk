import {
  addColumns,
  createTable,
  schemaMigrations,
} from "@nozbe/watermelondb/Schema/migrations";

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: "expenses",
          columns: [{ name: "payer_name", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "photos",
          columns: [{ name: "post_id", type: "string", isOptional: true }],
        }),
        createTable({
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
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "post_comments",
          columns: [
            { name: "space_id", type: "string", isIndexed: true },
            { name: "post_id", type: "string", isIndexed: true },
            { name: "author_id", type: "string" },
            { name: "author_name", type: "string", isOptional: true },
            { name: "text", type: "string" },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
          ],
        }),
      ],
    },
  ],
});
