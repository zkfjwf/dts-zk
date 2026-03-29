const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_REGEX = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

function randomChar() {
  return ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)];
}

function encodeTime(value: number, len: number) {
  let out = "";
  let v = Math.floor(value);
  for (let i = len - 1; i >= 0; i -= 1) {
    out = ULID_ALPHABET[v % 32] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

function createUlid() {
  const timePart = encodeTime(Date.now(), 10);
  let randomPart = "";
  for (let i = 0; i < 16; i += 1) {
    randomPart += randomChar();
  }
  return `${timePart}${randomPart}`;
}

function isUlid(value: string) {
  return ULID_REGEX.test(value);
}

function nowTs() {
  return Date.now();
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function cloneSpace(space: SpaceData): SpaceData {
  return JSON.parse(JSON.stringify(space)) as SpaceData;
}

function createId() {
  return createUlid();
}

function createSpaceCode() {
  let code = "";
  do {
    code = createId();
  } while (spaces.has(code));
  return code;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomOffset() {
  return (Math.random() - 0.5) * 0.008;
}

export type UserProfile = {
  id: string;
  username: string;
  accountName: string;
  avatarUrl: string;
  nickname: string;
};

export type UserRow = {
  id: string;
  nickname: string;
  avatarUrl: string;
};

export type SpaceRow = {
  id: string;
  name: string;
  code: string;
  created_at: number;
};

export type SpaceMemberRow = {
  id: string;
  space_id: string;
  user_id: string;
};

export type PhotoRow = {
  id: string;
  space_id: string;
  uploader_id: string;
  local_uri: string;
  remote_url: string;
  created_at: number;
};

export type Expense = {
  id: string;
  space_id: string;
  payer_id: string;
  payer_name: string;
  amount: number;
  description: string;
  created_at: number;
};

export type LocationItem = {
  id: string;
  user_id: string;
  username: string;
  avatarUrl: string;
  latitude: number;
  longitude: number;
  battery: number;
  sharing: boolean;
  updated_at: number;
};

export type PostComment = {
  id: string;
  text: string;
  author: string;
  created_at: number;
};

export type SpacePost = {
  id: string;
  space_id: string;
  uploader_id: string;
  uploader_name: string;
  text: string;
  photo_ids: string[];
  image_uris: string[];
  created_at: number;
  comments: PostComment[];
};

export type SpaceData = {
  id: string;
  name: string;
  code: string;
  members: string[];
  expenses: Expense[];
  locations: LocationItem[];
  posts: SpacePost[];
  users: UserRow[];
  spaces: SpaceRow[];
  spaceMembers: SpaceMemberRow[];
  photos: PhotoRow[];
};

export type TeamData = SpaceData;

type JoinResult =
  | { ok: true; space: SpaceData }
  | { ok: false; message: string };

type LeaveResult =
  | { ok: true; space: SpaceData | null; message: string }
  | { ok: false; message: string };

const MEMBER_AVATARS: Record<string, string> = {
  me: "https://i.pravatar.cc/200?img=11",
  xiaoli: "https://i.pravatar.cc/200?img=48",
  ajun: "https://i.pravatar.cc/200?img=13",
};

const MEMBER_IDS = {
  me: createId(),
  xiaoli: createId(),
  ajun: createId(),
};

const CURRENT_USER: UserProfile = {
  id: MEMBER_IDS.me,
  username: "旅行者小王",
  accountName: "旅行者小王",
  avatarUrl: MEMBER_AVATARS.me,
  nickname: "小王",
};

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200",
  "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1200",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200",
];

const SAMPLE_TEXTS = [
  "我们到达酒店并顺利办理入住。",
  "今天在本地市场吃到了很好吃的食物。",
  "傍晚山顶风景非常值得。",
  "晚饭后沿河散步很舒服。",
];

const LAT_MIN = 31.215;
const LAT_MAX = 31.24;
const LON_MIN = 121.455;
const LON_MAX = 121.485;

const spaces = new Map<string, SpaceData>();

function randomImage() {
  return SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
}

function randomText() {
  return SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
}

function createPhoto(
  spaceId: string,
  uploaderId: string,
  uri: string,
): PhotoRow {
  return {
    id: createId(),
    space_id: spaceId,
    uploader_id: uploaderId,
    local_uri: uri,
    remote_url: uri,
    created_at: nowTs(),
  };
}

export function getCurrentUser() {
  return CURRENT_USER;
}

export function updateCurrentUserProfile(next: {
  nickname?: string;
  avatarUrl?: string;
}) {
  const prevNickname = CURRENT_USER.username;

  if (next.nickname && next.nickname.trim()) {
    const clean = next.nickname.trim();
    CURRENT_USER.username = clean;
    CURRENT_USER.nickname = clean;
    CURRENT_USER.accountName = clean;
  }

  if (next.avatarUrl && next.avatarUrl.trim()) {
    CURRENT_USER.avatarUrl = next.avatarUrl.trim();
  }

  const latestNickname = CURRENT_USER.username;
  const latestAvatar = CURRENT_USER.avatarUrl;

  for (const space of spaces.values()) {
    space.users = space.users.map((user) =>
      user.id === CURRENT_USER.id
        ? { ...user, nickname: latestNickname, avatarUrl: latestAvatar }
        : user,
    );

    space.members = space.members.map((name) =>
      name === prevNickname ? latestNickname : name,
    );

    space.locations = space.locations.map((item) =>
      item.user_id === CURRENT_USER.id
        ? { ...item, username: latestNickname, avatarUrl: latestAvatar }
        : item,
    );
  }
}

export function createSpaceForCurrentUser() {
  const code = createSpaceCode();
  const createdAt = nowTs();
  const spaceId = createId();

  const users: UserRow[] = [
    {
      id: MEMBER_IDS.me,
      nickname: CURRENT_USER.username,
      avatarUrl: MEMBER_AVATARS.me,
    },
    {
      id: MEMBER_IDS.xiaoli,
      nickname: "小丽",
      avatarUrl: MEMBER_AVATARS.xiaoli,
    },
    { id: MEMBER_IDS.ajun, nickname: "阿军", avatarUrl: MEMBER_AVATARS.ajun },
  ];

  const spaceRow: SpaceRow = {
    id: spaceId,
    name: "春日旅行空间",
    code,
    created_at: createdAt,
  };

  const spaceMembers: SpaceMemberRow[] = [
    { id: createId(), space_id: spaceId, user_id: MEMBER_IDS.me },
    { id: createId(), space_id: spaceId, user_id: MEMBER_IDS.xiaoli },
    { id: createId(), space_id: spaceId, user_id: MEMBER_IDS.ajun },
  ];

  const p1 = createPhoto(spaceId, MEMBER_IDS.xiaoli, randomImage());
  const p2 = createPhoto(spaceId, MEMBER_IDS.xiaoli, randomImage());

  const space: SpaceData = {
    id: spaceId,
    name: spaceRow.name,
    code,
    members: users.map((u) => u.nickname),
    users,
    spaces: [spaceRow],
    spaceMembers,
    photos: [p1, p2],
    expenses: [
      {
        id: createId(),
        space_id: spaceId,
        payer_id: CURRENT_USER.id,
        payer_name: CURRENT_USER.username,
        amount: 86,
        description: "打车去酒店",
        created_at: createdAt,
      },
      {
        id: createId(),
        space_id: spaceId,
        payer_id: MEMBER_IDS.xiaoli,
        payer_name: "小丽",
        amount: 248,
        description: "晚饭",
        created_at: createdAt,
      },
    ],
    locations: [
      {
        id: createId(),
        user_id: CURRENT_USER.id,
        username: CURRENT_USER.username,
        avatarUrl: MEMBER_AVATARS.me,
        latitude: 31.2286,
        longitude: 121.4721,
        battery: 78,
        sharing: true,
        updated_at: createdAt,
      },
      {
        id: createId(),
        user_id: MEMBER_IDS.xiaoli,
        username: "小丽",
        avatarUrl: MEMBER_AVATARS.xiaoli,
        latitude: 31.2331,
        longitude: 121.4663,
        battery: 56,
        sharing: true,
        updated_at: createdAt,
      },
      {
        id: createId(),
        user_id: MEMBER_IDS.ajun,
        username: "阿军",
        avatarUrl: MEMBER_AVATARS.ajun,
        latitude: 31.2215,
        longitude: 121.4796,
        battery: 28,
        sharing: true,
        updated_at: createdAt,
      },
    ],
    posts: [
      {
        id: createId(),
        space_id: spaceId,
        uploader_id: MEMBER_IDS.xiaoli,
        uploader_name: "小丽",
        text: randomText(),
        photo_ids: [p1.id, p2.id],
        image_uris: [p1.remote_url, p2.remote_url],
        created_at: createdAt,
        comments: [
          {
            id: createId(),
            text: "这个景色太棒了！",
            author: "阿军",
            created_at: createdAt,
          },
        ],
      },
      {
        id: createId(),
        space_id: spaceId,
        uploader_id: MEMBER_IDS.ajun,
        uploader_name: "阿军",
        text: "明天早上 8 点酒店大堂集合。",
        photo_ids: [],
        image_uris: [],
        created_at: createdAt - 3600 * 1000,
        comments: [],
      },
    ],
  };

  spaces.set(code, space);
  return cloneSpace(space);
}

export function joinSpaceByCode(inputCode: string): JoinResult {
  const code = normalizeCode(inputCode);
  if (!code) {
    return { ok: false, message: "请输入空间口令。" };
  }
  if (!isUlid(code)) {
    return { ok: false, message: "空间口令必须是 26 位 ULID。" };
  }

  const space = spaces.get(code);
  if (!space) {
    return { ok: false, message: "未找到旅行空间，请确认口令。" };
  }

  const hasMember = space.spaceMembers.some(
    (item) => item.user_id === CURRENT_USER.id,
  );
  if (!hasMember) {
    space.spaceMembers.push({
      id: createId(),
      space_id: space.id,
      user_id: CURRENT_USER.id,
    });

    if (!space.users.find((u) => u.id === CURRENT_USER.id)) {
      space.users.push({
        id: CURRENT_USER.id,
        nickname: CURRENT_USER.username,
        avatarUrl: CURRENT_USER.avatarUrl,
      });
    }

    if (!space.members.includes(CURRENT_USER.username)) {
      space.members.push(CURRENT_USER.username);
    }

    space.locations.push({
      id: createId(),
      user_id: CURRENT_USER.id,
      username: CURRENT_USER.username,
      avatarUrl: CURRENT_USER.avatarUrl,
      latitude: clamp(31.2286 + randomOffset(), LAT_MIN, LAT_MAX),
      longitude: clamp(121.4721 + randomOffset(), LON_MIN, LON_MAX),
      battery: 74,
      sharing: true,
      updated_at: nowTs(),
    });
  }

  return { ok: true, space: cloneSpace(space) };
}

export function leaveSpaceByCode(inputCode: string): LeaveResult {
  const code = normalizeCode(inputCode);
  if (!isUlid(code)) {
    return { ok: false, message: "空间口令必须是 26 位 ULID。" };
  }

  const space = spaces.get(code);
  if (!space) {
    return { ok: false, message: "旅行空间不存在。" };
  }

  space.spaceMembers = space.spaceMembers.filter(
    (item) => item.user_id !== CURRENT_USER.id,
  );
  space.members = space.members.filter(
    (name) => name !== CURRENT_USER.username,
  );
  space.locations = space.locations.filter(
    (item) => item.user_id !== CURRENT_USER.id,
  );

  if (space.members.length === 0) {
    spaces.delete(code);
    return { ok: true, space: null, message: "你已退出，空间已自动结束。" };
  }

  return { ok: true, space: cloneSpace(space), message: "你已退出旅行空间。" };
}

export function getSpaceByCode(inputCode: string) {
  const code = normalizeCode(inputCode);
  if (!isUlid(code)) {
    return null;
  }
  const space = spaces.get(code);
  return space ? cloneSpace(space) : null;
}

export function addPostToSpace(
  inputCode: string,
  text: string,
  imageUris?: string[],
) {
  const space = spaces.get(normalizeCode(inputCode));
  if (!space) {
    return { ok: false as const, message: "旅行空间不存在。" };
  }

  const cleanText = text.trim();
  const cleanImages = (imageUris ?? []).map((u) => u.trim()).filter(Boolean);
  if (!cleanText && cleanImages.length === 0) {
    return { ok: false as const, message: "请至少输入文字或图片地址。" };
  }

  const photos = cleanImages.map((uri) =>
    createPhoto(space.id, CURRENT_USER.id, uri),
  );
  if (photos.length > 0) {
    space.photos.unshift(...photos);
  }

  space.posts.unshift({
    id: createId(),
    space_id: space.id,
    uploader_id: CURRENT_USER.id,
    uploader_name: CURRENT_USER.username,
    text: cleanText,
    photo_ids: photos.map((p) => p.id),
    image_uris: photos.map((p) => p.remote_url),
    created_at: nowTs(),
    comments: [],
  });

  return { ok: true as const, space: cloneSpace(space) };
}

export function addCommentToPost(
  inputCode: string,
  postId: string,
  text: string,
) {
  const space = spaces.get(normalizeCode(inputCode));
  if (!space) {
    return { ok: false as const, message: "旅行空间不存在。" };
  }

  const post = space.posts.find((p) => p.id === postId);
  if (!post) {
    return { ok: false as const, message: "动态不存在。" };
  }

  const content = text.trim();
  if (!content) {
    return { ok: false as const, message: "请输入评论内容。" };
  }

  post.comments.push({
    id: createId(),
    text: content,
    author: CURRENT_USER.username,
    created_at: nowTs(),
  });

  return { ok: true as const, space: cloneSpace(space) };
}

export function addExpenseToSpace(
  inputCode: string,
  title: string,
  amountText: string,
) {
  const space = spaces.get(normalizeCode(inputCode));
  if (!space) {
    return { ok: false as const, message: "旅行空间不存在。" };
  }

  const cleanTitle = title.trim();
  const parsed = Number(amountText);
  if (!cleanTitle) {
    return { ok: false as const, message: "请输入项目名称。" };
  }
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false as const, message: "金额必须大于 0。" };
  }

  space.expenses.unshift({
    id: createId(),
    space_id: space.id,
    payer_id: CURRENT_USER.id,
    payer_name: CURRENT_USER.username,
    amount: Number(parsed.toFixed(2)),
    description: cleanTitle,
    created_at: nowTs(),
  });

  return { ok: true as const, space: cloneSpace(space) };
}

export function simulateOtherMembersLocation(inputCode: string) {
  const space = spaces.get(normalizeCode(inputCode));
  if (!space) {
    return { ok: false as const, message: "旅行空间不存在。" };
  }

  space.locations = space.locations.map((item) => {
    const battery = clamp(Math.round(item.battery - Math.random() * 4), 1, 100);
    return {
      ...item,
      latitude: clamp(item.latitude + randomOffset(), LAT_MIN, LAT_MAX),
      longitude: clamp(item.longitude + randomOffset(), LON_MIN, LON_MAX),
      battery,
      updated_at: nowTs(),
    };
  });

  return { ok: true as const, space: cloneSpace(space) };
}

export function disbandSpaceByCode(inputCode: string) {
  const code = normalizeCode(inputCode);
  if (!isUlid(code)) {
    return false;
  }
  return spaces.delete(code);
}

export function createTeamForCurrentUser() {
  return createSpaceForCurrentUser();
}

export function joinTeamByCode(inputCode: string) {
  const result = joinSpaceByCode(inputCode);
  if (!result.ok) {
    return result;
  }
  return { ok: true as const, team: result.space };
}

export function leaveTeamByCode(inputCode: string) {
  const result = leaveSpaceByCode(inputCode);
  if (!result.ok) {
    return result;
  }
  return { ok: true as const, team: result.space, message: result.message };
}

export function getTeamByCode(inputCode: string) {
  return getSpaceByCode(inputCode);
}

export function addPostToTeam(
  inputCode: string,
  text: string,
  imageUris?: string[],
) {
  const result = addPostToSpace(inputCode, text, imageUris);
  if (!result.ok) {
    return result;
  }
  return { ok: true as const, team: result.space };
}

export function addExpenseToTeam(
  inputCode: string,
  title: string,
  amountText: string,
) {
  const result = addExpenseToSpace(inputCode, title, amountText);
  if (!result.ok) {
    return result;
  }
  return { ok: true as const, team: result.space };
}

export function disbandTeamByCode(inputCode: string) {
  return disbandSpaceByCode(inputCode);
}
