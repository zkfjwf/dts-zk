import { Q } from "@nozbe/watermelondb";
import { database } from "@/model";
import User from "@/model/User";
import {
  getCurrentUser,
  updateCurrentUserProfile,
  type UserProfile,
} from "./mockApp";

export type UserProfileData = {
  userId: string;
  nickname: string;
  avatarLocalUri: string;
  avatarRemoteUrl: string;
};

function toData(row: User): UserProfileData {
  return {
    userId: row.userId,
    nickname: row.nickname || "未命名用户",
    avatarLocalUri: row.avatarLocalUri || "",
    avatarRemoteUrl: row.avatarRemoteUrl || "",
  };
}

function toSeed(current: UserProfile): UserProfileData {
  return {
    userId: current.id,
    nickname: current.nickname || current.username || "旅行者",
    avatarLocalUri: "",
    avatarRemoteUrl: current.avatarUrl || "",
  };
}

async function getUserRowByUserId(userId: string) {
  const collection = database.collections.get<User>("users");
  const rows = await collection.query(Q.where("user_id", userId)).fetch();
  return rows[0] ?? null;
}

export async function ensureCurrentUserProfileInDb() {
  const current = getCurrentUser();
  const existed = await getUserRowByUserId(current.id);
  if (existed) {
    return toData(existed);
  }

  const seed = toSeed(current);
  let created: User | null = null;
  await database.write(async () => {
    const collection = database.collections.get<User>("users");
    created = await collection.create((row) => {
      row.userId = seed.userId;
      row.nickname = seed.nickname;
      row.avatarLocalUri = seed.avatarLocalUri;
      row.avatarRemoteUrl = seed.avatarRemoteUrl;
    });
  });

  return created ? toData(created) : seed;
}

export async function getCurrentUserProfileFromDb() {
  const current = getCurrentUser();
  const row = await getUserRowByUserId(current.id);
  if (!row) {
    return ensureCurrentUserProfileInDb();
  }
  return toData(row);
}

export async function updateCurrentUserNicknameInDb(nickname: string) {
  const clean = nickname.trim();
  if (!clean) {
    return getCurrentUserProfileFromDb();
  }

  const current = getCurrentUser();
  const row = await getUserRowByUserId(current.id);
  if (!row) {
    await ensureCurrentUserProfileInDb();
    return updateCurrentUserNicknameInDb(clean);
  }

  await database.write(async () => {
    await row.update((item) => {
      item.nickname = clean;
    });
  });

  updateCurrentUserProfile({ nickname: clean });
  return getCurrentUserProfileFromDb();
}

export async function updateCurrentUserAvatarInDb(
  avatarLocalUri: string,
  avatarRemoteUrl?: string,
) {
  const current = getCurrentUser();
  const row = await getUserRowByUserId(current.id);
  if (!row) {
    await ensureCurrentUserProfileInDb();
    return updateCurrentUserAvatarInDb(avatarLocalUri, avatarRemoteUrl);
  }

  await database.write(async () => {
    await row.update((item) => {
      item.avatarLocalUri = avatarLocalUri;
      if (avatarRemoteUrl !== undefined) {
        item.avatarRemoteUrl = avatarRemoteUrl;
      }
    });
  });

  const nextAvatar = avatarLocalUri || avatarRemoteUrl || "";
  if (nextAvatar) {
    updateCurrentUserProfile({ avatarUrl: nextAvatar });
  }
  return getCurrentUserProfileFromDb();
}
