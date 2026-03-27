import { Q } from "@nozbe/watermelondb";
import { database } from "@/model";
import Expense from "@/model/Expense";
import Photo from "@/model/Photo";
import Post from "@/model/Post";
import PostComment from "@/model/PostComment";
import type { SpaceData } from "./mockApp";

const syncedSpaceIds = new Set<string>();

function dedupeImageUris(imageUris: string[]) {
  return Array.from(
    new Set(imageUris.map((item) => item.trim()).filter(Boolean)),
  );
}

export async function syncMockSpaceToDatabase(space: SpaceData) {
  if (syncedSpaceIds.has(space.id)) {
    return;
  }

  const expenseCollection = database.collections.get<Expense>("expenses");
  const postCollection = database.collections.get<Post>("posts");

  const [existingExpenseCount, existingPostCount] = await Promise.all([
    expenseCollection.query(Q.where("space_id", space.id)).fetchCount(),
    postCollection.query(Q.where("space_id", space.id)).fetchCount(),
  ]);

  if (existingExpenseCount > 0 || existingPostCount > 0) {
    syncedSpaceIds.add(space.id);
    return;
  }

  await database.write(async () => {
    const photoCollection = database.collections.get<Photo>("photos");
    const commentCollection =
      database.collections.get<PostComment>("post_comments");

    for (const expense of space.expenses) {
      await expenseCollection.create((row) => {
        row.spaceId = space.id;
        row.payerId = expense.payer_id;
        row.payerName = expense.payer_name;
        row.amount = Math.round(expense.amount * 100);
        row.description = expense.description;
      });
    }

    for (const post of space.posts) {
      let createdPostId = "";
      await postCollection.create((row) => {
        row.spaceId = space.id;
        row.uploaderId = post.uploader_id;
        row.uploaderName = post.uploader_name;
        row.textContent = post.text;
        createdPostId = row.id;
      });

      const imageUris = dedupeImageUris(post.image_uris);
      for (const imageUri of imageUris) {
        await photoCollection.create((photo) => {
          photo.spaceId = space.id;
          photo.postId = createdPostId;
          photo.uploaderId = post.uploader_id;
          photo.localPath = imageUri;
          photo.remoteUrl = imageUri;
        });
      }

      for (const comment of post.comments) {
        await commentCollection.create((row) => {
          row.spaceId = space.id;
          row.postId = createdPostId;
          row.authorId = post.uploader_id;
          row.authorName = comment.author;
          row.textContent = comment.text;
        });
      }
    }
  });

  syncedSpaceIds.add(space.id);
}
