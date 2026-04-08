import { database } from "@/model";
import Comment from "@/model/Comment";
import Expense from "@/model/Expense";
import Photo from "@/model/Photo";
import Post from "@/model/Post";
import Space from "@/model/Space";
import SpaceMember from "@/model/SpaceMember";
import User from "@/model/User";
import { assignModelId, assignTimestamps } from "@/lib/watermelon";
import type { SpaceData } from "./mockApp";

// syncedSpaceIds 用来防止同一份 mock 初始数据被重复灌入 WatermelonDB。
const syncedSpaceIds = new Set<string>();

// syncMockSpaceToDatabase 负责把一个 mock 旅行空间同步到本地规范化数据表中。
export async function syncMockSpaceToDatabase(space: SpaceData) {
  if (syncedSpaceIds.has(space.id)) {
    return;
  }

  await database.write(async () => {
    const userCollection = database.collections.get<User>("users");
    const spaceCollection = database.collections.get<Space>("spaces");
    const spaceMemberCollection =
      database.collections.get<SpaceMember>("space_members");
    const expenseCollection = database.collections.get<Expense>("expenses");
    const postCollection = database.collections.get<Post>("posts");
    const photoCollection = database.collections.get<Photo>("photos");
    const commentCollection = database.collections.get<Comment>("comments");

    const [
      existingUsers,
      existingSpaces,
      existingSpaceMembers,
      existingExpenses,
      existingPosts,
      existingPhotos,
      existingComments,
    ] = await Promise.all([
      userCollection.query().fetch(),
      spaceCollection.query().fetch(),
      spaceMemberCollection.query().fetch(),
      expenseCollection.query().fetch(),
      postCollection.query().fetch(),
      photoCollection.query().fetch(),
      commentCollection.query().fetch(),
    ]);

    const userMap = new Map(existingUsers.map((item) => [item.id, item]));
    const spaceMap = new Map(existingSpaces.map((item) => [item.id, item]));
    const spaceMemberMap = new Map(
      existingSpaceMembers.map((item) => [item.id, item]),
    );
    const expenseMap = new Map(existingExpenses.map((item) => [item.id, item]));
    const postMap = new Map(existingPosts.map((item) => [item.id, item]));
    const photoMap = new Map(existingPhotos.map((item) => [item.id, item]));
    const commentMap = new Map(existingComments.map((item) => [item.id, item]));

    for (const user of space.users) {
      const existing = userMap.get(user.id);
      if (existing) {
        await existing.update((row) => {
          row.nickname = user.nickname;
          row.avatarLocalUri = user.avatar_local_uri;
          row.avatarRemoteUrl = user.avatar_remote_url;
          row.deletedAt = user.deleted_at;
          assignTimestamps(row, user.created_at, user.updated_at);
        });
        continue;
      }

      const created = await userCollection.create((row) => {
        assignModelId(row, user.id);
        row.nickname = user.nickname;
        row.avatarLocalUri = user.avatar_local_uri;
        row.avatarRemoteUrl = user.avatar_remote_url;
        row.deletedAt = user.deleted_at;
        assignTimestamps(row, user.created_at, user.updated_at);
      });
      userMap.set(created.id, created);
    }

    const existingSpace = spaceMap.get(space.space.id);
    if (existingSpace) {
      await existingSpace.update((row) => {
        row.name = space.space.name;
        assignTimestamps(row, space.space.created_at, space.space.updated_at);
      });
    } else {
      const created = await spaceCollection.create((row) => {
        assignModelId(row, space.space.id);
        row.name = space.space.name;
        assignTimestamps(row, space.space.created_at, space.space.updated_at);
      });
      spaceMap.set(created.id, created);
    }

    for (const member of space.spaceMembers) {
      const existing = spaceMemberMap.get(member.id);
      if (existing) {
        await existing.update((row) => {
          row.spaceId = member.space_id;
          row.userId = member.user_id;
          row.deletedAt = member.deleted_at;
          assignTimestamps(row, member.created_at, member.updated_at);
        });
        continue;
      }

      const created = await spaceMemberCollection.create((row) => {
        assignModelId(row, member.id);
        row.spaceId = member.space_id;
        row.userId = member.user_id;
        row.deletedAt = member.deleted_at;
        assignTimestamps(row, member.created_at, member.updated_at);
      });
      spaceMemberMap.set(created.id, created);
    }

    for (const expense of space.expenses) {
      const existing = expenseMap.get(expense.id);
      if (existing) {
        await existing.update((row) => {
          row.spaceId = expense.space_id;
          row.payerId = expense.payer_id;
          row.amount = Math.round(expense.amount * 100);
          row.description = expense.description;
          row.deletedAt = expense.deleted_at;
          assignTimestamps(row, expense.created_at, expense.updated_at);
        });
        continue;
      }

      const created = await expenseCollection.create((row) => {
        assignModelId(row, expense.id);
        row.spaceId = expense.space_id;
        row.payerId = expense.payer_id;
        row.amount = Math.round(expense.amount * 100);
        row.description = expense.description;
        row.deletedAt = expense.deleted_at;
        assignTimestamps(row, expense.created_at, expense.updated_at);
      });
      expenseMap.set(created.id, created);
    }

    for (const post of space.posts) {
      const existing = postMap.get(post.id);
      if (existing) {
        await existing.update((row) => {
          row.posterId = post.poster_id;
          row.deletedAt = post.deleted_at;
          assignTimestamps(row, post.created_at, post.updated_at);
        });
        continue;
      }

      const created = await postCollection.create((row) => {
        assignModelId(row, post.id);
        row.posterId = post.poster_id;
        row.deletedAt = post.deleted_at;
        assignTimestamps(row, post.created_at, post.updated_at);
      });
      postMap.set(created.id, created);
    }

    for (const photo of space.photos) {
      const existing = photoMap.get(photo.id);
      if (existing) {
        await existing.update((row) => {
          row.spaceId = photo.space_id;
          row.uploaderId = photo.uploader_id;
          row.localUri = photo.local_uri;
          row.remoteUrl = photo.remote_url;
          row.postId = photo.post_id;
          row.shotedAt = new Date(photo.shoted_at);
          row.deletedAt = photo.deleted_at;
          assignTimestamps(row, photo.created_at, photo.updated_at);
        });
        continue;
      }

      const created = await photoCollection.create((row) => {
        assignModelId(row, photo.id);
        row.spaceId = photo.space_id;
        row.uploaderId = photo.uploader_id;
        row.localUri = photo.local_uri;
        row.remoteUrl = photo.remote_url;
        row.postId = photo.post_id;
        row.shotedAt = new Date(photo.shoted_at);
        row.deletedAt = photo.deleted_at;
        assignTimestamps(row, photo.created_at, photo.updated_at);
      });
      photoMap.set(created.id, created);
    }

    for (const comment of space.comments) {
      const existing = commentMap.get(comment.id);
      if (existing) {
        await existing.update((row) => {
          row.content = comment.content;
          row.commenterId = comment.commenter_id;
          row.postId = comment.post_id;
          row.commentedAt = new Date(comment.commented_at);
          row.deletedAt = comment.deleted_at;
          assignTimestamps(row, comment.created_at, comment.updated_at);
        });
        continue;
      }

      const created = await commentCollection.create((row) => {
        assignModelId(row, comment.id);
        row.content = comment.content;
        row.commenterId = comment.commenter_id;
        row.postId = comment.post_id;
        row.commentedAt = new Date(comment.commented_at);
        row.deletedAt = comment.deleted_at;
        assignTimestamps(row, comment.created_at, comment.updated_at);
      });
      commentMap.set(created.id, created);
    }
  });

  syncedSpaceIds.add(space.id);
}
